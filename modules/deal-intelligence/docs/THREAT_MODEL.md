# Threat Model

| Threat | Mitigation |
|--------|------------|
| Fake retailer | Official domain validation, legal review status |
| Fake deal | Evidence chain, validation state machine, NEVER publish without evidence |
| Price manipulation | Historical pricing stats, discount validation |
| Coupon fraud | Coupon stack evaluation, uncertainty preservation |
| Affiliate hijacking | `detectAffiliateHijack`, redirect validation |
| Redirect hijacking | `validateRedirectChain` against allowed domains |
| Comp poisoning | Multiple comp median, conservative recommendations |
| Scarcity manipulation | `detectScarcityManipulation` |
| Community spam | Duplicate detection, moderation queue, reputation scoring |
| Scraper traps | `termsBasis` requirement, fixture-only by default |
| Malicious page content | Evidence captured as references, not executed |
| Account takeover | (Out of scope; identity runtime integration pending) |
| Bot blocking | (Out of scope; browser operator integration pending) |
| Rate-limit abuse | Throttling contracts, circuit breakers |
| Denial-of-wallet | Cost metadata on adapters, rate limits |
| False availability | `safeQuantityEstimate` never fabricates |
| Stale deal publication | Recheck engine, expiration events |
| Illegal/restricted publication | `knownExclusions`, `PROHIBITED_PRODUCTS.md` |
