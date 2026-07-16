# Prohibited Products

Default workflows refuse to publish deals in these categories:
- weapons and firearms
- illegal goods
- recalled products
- prescription drugs
- tobacco and nicotine (regional restrictions apply)
- adult content (regional restrictions apply)

The `knownExclusions` parameter on `validateDeal` accepts a list of
excluded categories. A deal in an excluded category is set to `BLOCKED`.

Tenants MAY override the default prohibited list via
`TenantConfig.isolatedData`, but never to permit categories prohibited
by law in the tenant's operating region.
