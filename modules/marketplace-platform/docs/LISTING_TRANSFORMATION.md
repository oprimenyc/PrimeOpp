# Listing Transformation

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

The listing transformer produces a channel-specific payload from a canonical listing, recording all modifications, omissions, and warnings.

## Transformation Output

- transformedPayload — channel-specific payload
- omittedFields — fields not sent to channel
- modifiedFields — fields changed during transformation
- unsupportedFields — fields the channel cannot accept
- warnings — informational messages
- requiredSellerActions — actions seller must take
- confidence — 0..1 transformation confidence
- evidence — transformation metadata

## Rules

- Title length truncated to channel max
- Description truncated to 50000 chars
- Bullets limited to 10
- Images limited to channel max
- Videos omitted if unsupported
- Local pickup disabled if unsupported
- Required identifiers checked
- Prohibited terms flagged
