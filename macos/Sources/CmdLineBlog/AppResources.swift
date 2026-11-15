import Foundation

enum AppResources {
    static let bundle = Bundle.main.url(forResource: "CmdLineBlog_CmdLineBlog", withExtension: "bundle")
        .flatMap { Bundle(url: $0) } ?? Bundle.module

    static func webRoot() throws -> URL {
        guard let root = bundle.url(forResource: "Web", withExtension: nil),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path)
        else { throw CocoaError(.fileReadNoSuchFile) }
        return root
    }
}
