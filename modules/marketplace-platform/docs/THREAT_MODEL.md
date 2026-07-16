# Threat Model

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Threats

34 threats modeled: seller/buyer account takeover, channel credential theft, inventory oversell, duplicate orders, replayed webhooks, fake orders, fee/commission/settlement manipulation, affiliate hijacking, counterfeit listings, stolen goods, prohibited goods, fake shipping, tracking manipulation, return/chargeback fraud, review manipulation, message phishing, off-platform payment scams, malicious listing HTML, image payload attacks, SSRF, malicious URLs, cross-tenant access, privilege escalation, hidden marketplace enrollment, dark pattern publication, fake scarcity/authenticity, API abuse, denial-of-wallet, rate-limit abuse, browser-automation compromise, suspicious pricing/messaging, identity mismatch, inventory ownership concerns.

## Per-Threat Documentation

For each threat: likelihood, impact, mitigation, detection, tests, residual risk. See packages/sdk/test/workflows.test.ts for runtime tests.
