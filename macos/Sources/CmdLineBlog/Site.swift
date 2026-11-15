import Foundation

struct Site {
    // Only blog previews use the public website. The editor runs locally.
    static let productionURL = URL(string: "https://kate0115.cc/apps/cmdline-blog/")!
    let url: URL

    init(url: URL) { self.url = url }

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

    func browserURL(for candidate: URL) -> URL? {
        if isBlog(candidate) {
            var result = URLComponents(url: Self.productionURL.appendingPathComponent("blog.html"), resolvingAgainstBaseURL: false)
            let source = URLComponents(url: candidate, resolvingAgainstBaseURL: false)
            result?.percentEncodedQuery = source?.percentEncodedQuery
            result?.percentEncodedFragment = source?.percentEncodedFragment
            return result?.url
        }
        return opensInBrowser(candidate) ? candidate : nil
    }
}
