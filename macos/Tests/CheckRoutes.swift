import Foundation

// Command Line Tools may omit Testing; this standalone harness also exercises
// the real HTTP listener, rather than only checking the response builder.
@main
enum CheckRoutes {
    static func main() async throws {
        let site = Site(url: URL(string: "http://127.0.0.1:47836/")!)
        let blog = URL(string: "blog.html?u=someone%20else%26name&p=post&t=swift#comments", relativeTo: site.url)!.absoluteURL
        precondition(site.contains(site.url))
        precondition(site.isBlog(blog))
        precondition(!site.opensInBrowser(site.url))
        let preview = site.browserURL(for: blog)!
        precondition(preview.absoluteString == "https://kate0115.cc/apps/cmdline-blog/blog.html?u=someone%20else%26name&p=post&t=swift#comments")
        precondition(site.browserURL(for: site.url) == nil)
        precondition(!site.contains(URL(string: "http://127.0.0.1:47837/index.html")!))
        precondition(site.browserURL(for: URL(string: "https://elsewhere.com/")!)?.host == "elsewhere.com")
        precondition(site.browserURL(for: URL(string: "javascript:alert(1)")!) == nil)
        precondition(site.browserURL(for: URL(string: "file:///tmp/test.html")!) == nil)

        let fixture = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let root = fixture.appendingPathComponent("Web")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: fixture) }
        try Data("<h1>Bundled UI</h1>".utf8).write(to: root.appendingPathComponent("index.html"))
        try Data("secret".utf8).write(to: fixture.appendingPathComponent("secret.html"))
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("link.html"), withDestinationURL: fixture.appendingPathComponent("secret.html"))

        let assets = WebAssets(root: root, origin: site.url)
        func response(_ target: String, method: String = "GET", host: String = "127.0.0.1:47836", extra: String = "") -> WebAssets.Response {
            assets.response(for: Data("\(method) \(target) HTTP/1.1\r\nHost: \(host)\r\n\(extra)\r\n".utf8))
        }
        precondition(response("/").status == 200)
        precondition(response("/index.html?v=8").status == 200)
        precondition(response("/missing.js").status == 404)
        precondition(response("/../secret.html").status == 403)
        precondition(response("/%2e%2e/secret.html").status == 403)
        precondition(response("/link.html").status == 403)
        precondition(response("/", host: "example.com").status == 403)
        precondition(response("/", extra: "Origin: https://example.com\r\n").status == 403)
        precondition(response("/", method: "POST").status == 405)
        let head = response("/", method: "HEAD")
        precondition(head.status == 200 && !String(decoding: head.data, as: UTF8.self).contains("<h1>"))

        let server = try LocalServer(root: root, port: 47837)
        try await server.start()
        defer { server.stop() }
        let (body, result) = try await URLSession.shared.data(from: server.url)
        precondition((result as? HTTPURLResponse)?.statusCode == 200)
        precondition(String(decoding: body, as: UTF8.self) == "<h1>Bundled UI</h1>")
        print("Passed URL mapping, asset isolation, and real loopback HTTP checks.")
    }
}
