import Foundation

struct Site {
    // The existing public app URL in register.html.
    static let productionURL = URL(string: "https://kate0115.net/apps/cmdline-blog/")!
    let url: URL

    init(address: String? = nil) throws {
        guard let address else {
            url = Self.productionURL
            return
        }
        guard let candidate = URL(string: address),
              let host = candidate.host,
              candidate.user == nil, candidate.password == nil,
              candidate.query == nil, candidate.fragment == nil,
              candidate.scheme == "https" ||
                (candidate.scheme == "http" && ["localhost", "127.0.0.1", "[::1]"].contains(host))
        else { throw ConfigurationError.invalidURL }
        url = candidate.path.isEmpty || candidate.pathExtension.isEmpty
            ? (candidate.absoluteString.hasSuffix("/") ? candidate : candidate.appendingPathComponent(""))
            : candidate
    }

    func contains(_ candidate: URL) -> Bool {
        let directory = url.hasDirectoryPath ? url : url.deletingLastPathComponent()
        let prefix = directory.path.hasSuffix("/") ? directory.path : directory.path + "/"
        let path = candidate.standardized.path
        return candidate.scheme == url.scheme && candidate.host == url.host &&
            candidate.port == url.port && (path == directory.path || path.hasPrefix(prefix))
    }

    func isBlog(_ candidate: URL) -> Bool {
        contains(candidate) && candidate.lastPathComponent == "blog.html"
    }

    func opensInBrowser(_ candidate: URL) -> Bool {
        ["http", "https", "mailto"].contains(candidate.scheme ?? "") &&
            (isBlog(candidate) || !contains(candidate))
    }

    enum ConfigurationError: LocalizedError {
        case invalidURL
        var errorDescription: String? {
            "Use an HTTPS app URL, or HTTP on localhost for development."
        }
    }
}
