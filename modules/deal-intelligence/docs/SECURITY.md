# Security

## Implemented controls

- Official-domain validation (`affiliate-engine.buildAffiliateLink`)
- URL normalization (`crawler-contracts.normalizeUrl`)
- Redirect validation (`crawler-contracts.validateRedirectChain`)
- SSRF resistance (`crawler-contracts.assertSafeUrl`)
- Malicious HTML handling (evidence is captured as references, never executed)
- Untrusted JSON handling (typed parse with validation)
- Prompt-injection resistance at AI boundaries (no AI integration in this package)
- Affiliate-link substitution detection (`affiliate-engine.detectAffiliateHijack`)
- Tenant isolation (`tenant-config.canAccessRetailer` / `canAccessCampaign`)
- Input limits (URLs capped, titles truncated to 500 chars)
- Output limits (publication fields bounded)
- Rate-limit hooks (`Retailer.rateLimitMetadata`, `ThrottlingContract`)
- Crawl throttling (`ThrottlingContract`)
- Retry limits (`AdapterCapability.retrySemantics`)
- Circuit breakers (`ThrottlingContract.circuitBreaker`)
- Secrets as references only (no raw credentials anywhere)
- No customer PII logging (`evidence.redactPii`)
- Evidence redaction (`evidence.redactEvidence`)
- Malicious community submission handling (moderation queue)
- Duplicate suppression (`alert-engine` suppression window)
- Replay resistance (evidence hash chain)
- Content correction (`publishing-contracts.correctionPolicyText`)
- Disclosure enforcement (`affiliate-engine` rejects links without disclosure)

## Reporting

Report security issues via the VERIDIAN security disclosure process
(integration pending).
