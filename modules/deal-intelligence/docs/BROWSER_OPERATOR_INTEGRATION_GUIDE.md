# Browser Operator Integration Guide

This package does NOT implement a Browser Operator. It defines the seam
(`browser-contracts.BrowserOperatorAdapter`) through which a future
VERIDIAN Browser Operator implementation will be plugged in.

To integrate:

1. Implement `BrowserOperatorAdapter` in a separate package.
2. Register it via `sdk.adapters.register(browserOperator)`.
3. Ensure `legalReviewStatus: 'approved'` before any live retrieval.
4. Set `testOnly: false` only after human legal review.
