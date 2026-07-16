# PrimeOpp Integration Guide

This package exposes stable seams for integration with the PrimeOpp
public website and feed.

## Publication

Use `publishing-contracts.buildPublication({ target: 'primeopp-website', ... })`
to produce a `Publication` object. The `InMemoryPublishingCaptureAdapter`
is test-only; production deployments register a `PublishingAdapter` that
delivers to the PrimeOpp website via `sdk.adapters.register(...)`.

## Alerts

Use `alert-engine` with channel `'website'` to capture alerts destined
for the PrimeOpp website feed. The default `InMemoryAlertCaptureAdapter`
is test-only.

## Premium membership

Use `tenant-config` to define premium tiers. The `AlertRule.premiumTier`
field filters alerts by tier. Billing and entitlement adapters are
exposed via the adapter SDK; this package does NOT implement payment
processing.
