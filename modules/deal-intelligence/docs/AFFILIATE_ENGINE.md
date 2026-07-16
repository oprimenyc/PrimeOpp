# Affiliate Engine

`affiliate-engine` builds, validates and detects hijacking of affiliate
links. Rules:

- Never conceal affiliate status (disclosureRequired = true always)
- Always support disclosure
- Never rewrite links for unauthorized merchants
- Never fabricate expected commission (returns undefined when pct missing)
- Preserve original destination
- Detect malicious redirect substitution
- Validate official domains
- Support link expiration
- Support campaign attribution

Local test adapters only. No affiliate credentials required.
