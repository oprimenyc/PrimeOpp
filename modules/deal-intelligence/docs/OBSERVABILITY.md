# Observability

24 structured event kinds (source-check-started, deal-discovered,
deal-validated, deal-rejected, deal-scored, alert-queued,
alert-delivered, deal-rechecked, deal-corrected, deal-expired,
dead-deal-detected, community-submission-received, moderation-completed,
amos-job-created, runtime-failed, etc.).

15 required metric hooks (deals-discovered, verified-deal-rate,
rejected-deal-rate, false-positive-rate, stale-deal-rate,
dead-deal-latency, retailer-health, source-success, crawl-cost,
browser-requirement-rate, affiliate-eligibility, alert-delivery,
premium-alert-latency, community-accuracy, resale-opportunity-rate,
amos-job-creation).

`ObservabilityBus.assertNoSilentFailures` verifies that every event with
a `fallback` declares `executed: true`. No silent failures permitted.

Does NOT build a competing observability platform; exposes integration
contracts only.
