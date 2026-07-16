# Deal Validation

Every candidate deal passes through `validateDeal`. Deal states:
DISCOVERED, VALIDATING, VERIFIED, VERIFIED_WITH_CONDITIONS,
COMMUNITY_REPORTED, NEEDS_REVIEW, STALE, DEAD, EXPIRED, REJECTED,
BLOCKED, PUBLISHED, ARCHIVED, FAILED.

A deal MUST NOT be published as VERIFIED without sufficient evidence.
`isTerminal` and `isPublishable` helpers expose the lifecycle.
