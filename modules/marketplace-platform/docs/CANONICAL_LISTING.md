# Canonical Listing

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

One canonical listing supports distribution to many channels. Each channel receives a transformed payload suited to its capabilities.

## Listing States

- DRAFT, INCOMPLETE, READY, NEEDS_REVIEW, APPROVAL_REQUIRED, APPROVED
- PUBLISHING, PARTIALLY_PUBLISHED, ACTIVE, PAUSED
- SOLD, PARTIALLY_SOLD, ENDED, EXPIRED
- ERROR, NEEDS_ATTENTION, ARCHIVED

## State Machine

All transitions are deterministic and tested. See packages/canonical-listing/src/index.ts for the full transition table.

## Destination Selection

Every listing has a destinations array. Each entry declares channelId, enabled, explicitlySelected, primeOppMarketplace flag, and selectedAt timestamp. This is the visible default mechanism.
