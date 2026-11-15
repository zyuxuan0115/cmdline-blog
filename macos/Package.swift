// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "CmdLineBlog",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "CmdLineBlog", targets: ["CmdLineBlog"])],
    targets: [
        .executableTarget(
            name: "CmdLineBlog",
            resources: [.copy("Resources/desktop.js")],
            swiftSettings: [
                .defaultIsolation(MainActor.self),
                .enableUpcomingFeature("NonisolatedNonsendingByDefault")
            ]
        )
    ]
)
