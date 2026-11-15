import Foundation

/// Serves only the packaged front end. There are no write or backend endpoints.
struct WebAssets {
    let root: URL
    let origin: URL

    struct Response {
        let status: Int
        let contentType: String
        let body: Data
        var headOnly = false

        var data: Data {
            let reason = [200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed"][status]!
            let headers = "HTTP/1.1 \(status) \(reason)\r\nContent-Type: \(contentType)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"
            return Data(headers.utf8) + (headOnly ? Data() : body)
        }
    }

    func response(for request: Data) -> Response {
        let lines = String(decoding: request, as: UTF8.self).components(separatedBy: "\r\n")
        let parts = lines[0].split(separator: " ")
        guard parts.count == 3, ["HTTP/1.1", "HTTP/1.0"].contains(parts[2]) else { return error(400) }
        guard parts[0] == "GET" || parts[0] == "HEAD" else { return error(405) }
        let headers = lines.dropFirst().prefix { !$0.isEmpty }.compactMap { line -> (String, String)? in
            let pair = line.split(separator: ":", maxSplits: 1)
            guard pair.count == 2 else { return nil }
            return (pair[0].lowercased(), pair[1].trimmingCharacters(in: .whitespaces))
        }
        let hosts = headers.filter { $0.0 == "host" }
        guard hosts.count == 1, hosts[0].1 == "\(origin.host!):\(origin.port!)" else { return error(403) }
        if let source = headers.first(where: { $0.0 == "origin" })?.1,
           source != String(origin.absoluteString.dropLast()) { return error(403) }

        let target = String(parts[1]).components(separatedBy: "?")[0]
        guard target.hasPrefix("/"), let path = target.removingPercentEncoding,
              !path.contains("\0"), !path.split(separator: "/").contains("..") else { return error(403) }
        let file = root.appendingPathComponent(path == "/" ? "index.html" : String(path.dropFirst()))
            .standardizedFileURL.resolvingSymlinksInPath()
        let rootPath = root.resolvingSymlinksInPath().path
        guard file.path.hasPrefix(rootPath + "/") else { return error(403) }
        let types = [
            "html": "text/html; charset=utf-8", "css": "text/css; charset=utf-8",
            "js": "application/javascript; charset=utf-8", "json": "application/json",
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
            "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf"
        ]
        guard let type = types[file.pathExtension.lowercased()], let data = try? Data(contentsOf: file) else { return error(404) }
        return Response(status: 200, contentType: type, body: data, headOnly: parts[0] == "HEAD")
    }

    private func error(_ status: Int) -> Response {
        Response(status: status, contentType: "text/plain; charset=utf-8", body: Data("Request failed (\(status)).".utf8))
    }
}
