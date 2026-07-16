# Inventory Synchronization

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

Inventory sync uses locks + allocations to prevent oversell.

## Sale Flow

- 1. Receive channel event
- 2. Validate order
- 3. Acquire inventory lock
- 4. Reserve or allocate inventory
- 5. Mark sold quantity
- 6. Pause or end competing listings
- 7. Verify channel updates
- 8. Record failures
- 9. Escalate unresolved oversell risk

## Concurrency Controls

- Idempotency keys
- Inventory locks (TTL-based)
- Event deduplication
- Stale-event detection
- Replay protection
- Compensating updates
