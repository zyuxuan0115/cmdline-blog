import Foundation

// A standalone harness also runs with Command Line Tools, which may omit Testing.
@main
enum CheckRoutes {
    static func main() throws {
        let site = try Site()
        let blog = URL(string: "blog.html?u=someone%20else&p=post&t=swift", relativeTo: site.url)!.absoluteURL
        precondition(site.isBlog(blog))
        precondition(site.opensInBrowser(blog))
        precondition(URLComponents(url: blog, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "someone else")
        precondition(!site.opensInBrowser(site.url))

        let nested = try Site(address: "https://example.com/apps/blog/")
        precondition(nested.contains(URL(string: "https://example.com/apps/blog/index.html")!))
        precondition(!nested.contains(URL(string: "https://example.com/apps/blog-elsewhere/index.html")!))
        precondition(!nested.contains(URL(string: "https://example.com/apps/blog/../admin/")!))
        precondition(!nested.contains(URL(string: "https://example.com:8443/apps/blog/")!))
        precondition(nested.opensInBrowser(URL(string: "https://elsewhere.com/")!))
        precondition(!nested.opensInBrowser(URL(string: "javascript:alert(1)")!))
        precondition(!nested.opensInBrowser(URL(string: "file:///tmp/test.html")!))

        let local = try Site(address: "http://localhost:8080")
        let localBlog = URL(string: "blog.html?u=test", relativeTo: local.url)!.absoluteURL
        precondition(localBlog.absoluteString == "http://localhost:8080/blog.html?u=test")
        precondition(local.isBlog(localBlog))
        let withoutSlash = try Site(address: "https://example.com/apps/blog")
        precondition(withoutSlash.url.absoluteString == "https://example.com/apps/blog/")

        for address in ["http://example.com/", "file:///tmp/index.html", "javascript:alert(1)",
                        "https://user:pass@example.com/", "https://example.com/?secret=123"] {
            do {
                _ = try Site(address: address)
                fatalError("Accepted invalid URL: \(address)")
            } catch Site.ConfigurationError.invalidURL {
                // Expected.
            }
        }
        print("Passed macOS URL routing checks.")
    }
}
