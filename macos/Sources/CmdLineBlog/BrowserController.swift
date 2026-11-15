import AppKit
import WebKit

final class BrowserController: NSViewController, WKNavigationDelegate, WKUIDelegate,
    WKScriptMessageHandlerWithReply {
    private let site: Site
    private let webView: WKWebView
    private let status = NSTextField(wrappingLabelWithString: "Loading CmdLine Blog…")
    // A short-lived child lets older deployed versions use window.open without
    // incorrectly reporting a blocked popup. It never becomes a visible window.
    private var popups: [WKWebView] = []

    init(site: Site) throws {
        self.site = site
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        let resources = Bundle.main.url(forResource: "CmdLineBlog_CmdLineBlog", withExtension: "bundle")
            .flatMap { Bundle(url: $0) } ?? Bundle.module
        guard let scriptURL = resources.url(forResource: "desktop", withExtension: "js") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let script = try String(contentsOf: scriptURL, encoding: .utf8)
        configuration.userContentController.addUserScript(WKUserScript(
            source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true
        ))
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "openBlog")
        webView.navigationDelegate = self
        webView.uiDelegate = self
    }

    required init?(coder: NSCoder) { nil }

    override func loadView() {
        view = NSView()
        webView.translatesAutoresizingMaskIntoConstraints = false
        status.translatesAutoresizingMaskIntoConstraints = false
        status.alignment = .center
        view.addSubview(webView)
        view.addSubview(status)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            status.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            status.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            status.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, multiplier: 0.8)
        ])
        webView.load(URLRequest(url: site.url))
    }

    @objc func reload(_ sender: Any?) {
        status.stringValue = "Loading CmdLine Blog…"
        status.isHidden = false
        webView.load(URLRequest(url: site.url))
    }

    func userContentController(_ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame,
              let source = message.frameInfo.request.url, site.contains(source),
              let address = message.body as? String,
              let url = URL(string: address), site.isBlog(url)
        else {
            replyHandler(nil, "Invalid blog URL.")
            return
        }
        replyHandler(NSWorkspace.shared.open(url), nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        let isPopup = popups.contains(webView)
        // Subframe navigation belongs to WebKit (including Firebase helpers).
        if action.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        // Let WebKit create the child first so window.open receives a valid
        // window. Its navigation is then handled below by the child's delegate.
        if action.targetFrame == nil && !isPopup { decisionHandler(.allow); return }
        if site.opensInBrowser(url) || (isPopup && ["https", "http"].contains(url.scheme ?? "")) {
            if !NSWorkspace.shared.open(url) { showError("Could not open the default browser.") }
            decisionHandler(.cancel)
            popups.removeAll { $0 === webView }
        } else if site.contains(url) || url.absoluteString == "about:blank" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let popup = WKWebView(frame: .zero, configuration: configuration)
        popup.navigationDelegate = self
        popups.append(popup)
        return popup
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView === self.webView { status.isHidden = true }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError(error.localizedDescription) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError(error.localizedDescription) }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showError("The web content process stopped.")
    }

    private func showError(_ message: String) {
        status.stringValue = "\(message)\n\(site.url.absoluteString)\nPress ⌘R to retry."
        status.isHidden = false
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
        alert(message).runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        let panel = alert(message)
        panel.addButton(withTitle: "Cancel")
        completionHandler(panel.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?, initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (String?) -> Void) {
        let panel = alert(prompt)
        panel.addButton(withTitle: "Cancel")
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        input.stringValue = defaultText ?? ""
        panel.accessoryView = input
        completionHandler(panel.runModal() == .alertFirstButtonReturn ? input.stringValue : nil)
    }

    private func alert(_ message: String) -> NSAlert {
        let panel = NSAlert()
        panel.messageText = "CmdLine Blog"
        panel.informativeText = message
        panel.addButton(withTitle: "OK")
        return panel
    }
}
