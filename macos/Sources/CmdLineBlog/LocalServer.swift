import Foundation
import Network

/// A stable loopback origin keeps Firebase/IndexedDB storage across launches.
final class LocalServer {
    static let port: UInt16 = 47836
    let url: URL
    private let assets: WebAssets
    private let listener: NWListener
    private var startup: CheckedContinuation<Void, any Error>?
    private var connections: [UUID: NWConnection] = [:]

    init(root: URL, port: UInt16 = LocalServer.port) throws {
        url = URL(string: "http://127.0.0.1:\(port)/")!
        assets = WebAssets(root: root, origin: url)
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        listener = try NWListener(using: parameters)
    }

    func start() async throws {
        try await withCheckedThrowingContinuation { continuation in
            startup = continuation
            listener.stateUpdateHandler = { [weak self] state in
                Task { @MainActor in
                    guard let self else { return }
                    switch state {
                    case .ready:
                        self.startup?.resume()
                        self.startup = nil
                    case .failed(let error):
                        self.startup?.resume(throwing: error)
                        self.startup = nil
                        self.stop()
                    default: break
                    }
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                Task { @MainActor in self?.accept(connection) }
            }
            listener.start(queue: .main)
        }
    }

    func stop() {
        listener.cancel()
        for connection in connections.values { connection.cancel() }
        connections.removeAll()
    }

    private func accept(_ connection: NWConnection) {
        let id = UUID()
        connections[id] = connection
        connection.start(queue: .main)
        receive(id, buffer: Data())
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(10))
            self?.close(id)
        }
    }

    private func receive(_ id: UUID, buffer: Data) {
        guard let connection = connections[id] else { return }
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, complete, error in
            Task { @MainActor in
                guard let self, self.connections[id] != nil else { return }
                let request = buffer + (data ?? Data())
                guard error == nil, request.count <= 16_384 else { self.close(id); return }
                if request.range(of: Data("\r\n\r\n".utf8)) != nil {
                    let response = self.assets.response(for: request)
                    connection.send(content: response.data, completion: .contentProcessed { [weak self] _ in
                        Task { @MainActor in self?.close(id) }
                    })
                } else if complete {
                    self.close(id)
                } else {
                    self.receive(id, buffer: request)
                }
            }
        }
    }

    private func close(_ id: UUID) {
        connections.removeValue(forKey: id)?.cancel()
    }
}
