# Retailer Access Policy

Every retailer entry has:

- `termsReference.legalReviewStatus` — currently `pending` for all
  starter retailers.
- `termsReference.termsUrl` and `robotsUrl` — placeholders pointing to
  the retailer's official terms/robots URLs.
- `permittedAutomationModes` — currently `['fixture-evidence',
  'manual-verification']` for all starter retailers.
- `robotsPolicyRef` — placeholder reference.

**No live retrieval is enabled by this package.** Any production
deployment MUST perform human legal review of each retailer's terms and
robots policy before enabling any non-fixture adapter.

The `BrowserOperatorAdapter` seam is provided for future VERIDIAN
Browser Operator integration; it MUST NOT be used to bypass retailer
terms.
