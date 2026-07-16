# Foundry Integration Guide

Foundry is the sole canonical execution runtime in the VERIDIAN
ecosystem. This package does NOT implement Foundry; it exposes the
seam through which Foundry will execute deal-intelligence jobs.

Every adapter's `healthCheck()` and `retrySemantics` are designed to be
composed by Foundry's scheduler. The `ObservabilityBus` emits 24
structured event kinds that Foundry may consume for runtime verification.

Foundry integration is PENDING.
