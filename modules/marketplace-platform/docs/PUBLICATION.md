# Publication

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

The listing publisher orchestrates multi-channel publication with explicit terminal states.

## Workflow

- 1. Validate listing for publication context
- 2. Verify PrimeOpp Marketplace visible default
- 3. Run moderation (counterfeit / prohibited)
- 4. Run counterfeit risk check
- 5. Transition through READY → APPROVED → PUBLISHING
- 6. Publish to each enabled destination
- 7. Determine final state (ACTIVE / PARTIALLY_PUBLISHED / ERROR)
- 8. Record destination selection evidence
- 9. Emit publication receipt
