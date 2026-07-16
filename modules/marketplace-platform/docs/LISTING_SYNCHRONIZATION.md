# Listing Synchronization

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

Listing sync detects conflicts between local and remote state.

## Conflict Outcomes

- LOCAL_WINS, REMOTE_WINS, NEWEST_WINS, MANUAL_REVIEW, POLICY_DECISION, UNSUPPORTED

## Detects

- External edit, conflicting edit, stale local/remote version
- Unauthorized change, unsupported field, channel error
- Rate limit, missing listing, listing removed externally
