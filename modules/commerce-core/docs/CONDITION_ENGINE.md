# Condition Engine

The condition engine lives in `packages/condition-engine/src/index.ts`.

## Canonical Conditions

16 conditions: NEW, NEW_WITH_TAGS, NEW_WITHOUT_TAGS, NEW_OPEN_BOX, LIKE_NEW, EXCELLENT, VERY_GOOD, GOOD, FAIR, POOR, FOR_PARTS, REFURBISHED, SELLER_REFURBISHED, MANUFACTURER_REFURBISHED, DAMAGED, CUSTOM.

## Category Grading Profiles

11 built-in profiles: ELECTRONICS, SNEAKERS, APPAREL, BOOKS, COLLECTIBLES, TOOLS, TOYS, FURNITURE, APPLIANCES, MEDIA, GENERAL.

Each profile defines:

- required assessment dimensions
- defect severity map (LOW / MEDIUM / HIGH / CRITICAL)
- default condition when no defects are observed (NEVER `NEW`)
- whether authenticity verification is required

## Condition Derivation

`deriveCondition(defects, profile)` picks the most severe defect and maps to a canonical condition:

- CRITICAL → DAMAGED
- HIGH → FAIR
- MEDIUM → GOOD
- LOW → VERY_GOOD
- (no defects) → profile default (e.g. NEW_OPEN_BOX for electronics)

## Critical Rule

**Never infer "NEW" from appearance alone.** The only way to assert `NEW` is via `createNewConditionAssessment()` which requires explicit packaging/seal evidence.

## Marketplace Mapping

`mapMarketplaceCondition(label)` converts arbitrary marketplace labels to canonical conditions.
`toMarketplaceCondition(condition, marketplace)` converts canonical conditions to marketplace-specific labels (ebay, amazon, goat examples built in).
