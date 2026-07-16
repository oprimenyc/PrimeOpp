# Crawler and Browser Contracts

`crawler-contracts` defines provider-agnostic HTTP crawler adapters and
page parsers. `browser-contracts` defines the Browser Operator adapter
seam for future VERIDIAN Browser Operator integration.

This package does NOT implement a competing Browser Operator. It only defines
the contract through which a Browser Operator implementation will be plugged
in. The `StubBrowserOperatorAdapter` is test-only.

Security: `assertSafeUrl` blocks internal addresses (SSRF resistance),
`normalizeUrl` drops tracking parameters, `validateRedirectChain` rejects
cross-domain redirects.
