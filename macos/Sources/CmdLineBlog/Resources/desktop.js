// Runs only inside the macOS app; ordinary browsers keep their existing behavior.
Object.defineProperty(window, 'cmdlineDesktop', {
  value: Object.freeze({
    openBlog: url => window.webkit.messageHandlers.openBlog.postMessage(
      new URL(url, document.baseURI).href
    )
  }),
  writable: false,
  configurable: false
});
