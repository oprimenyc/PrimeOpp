# Availability Engine

15 availability states: IN_STOCK, LOW_STOCK, LIMITED, STORE_ONLY,
ONLINE_ONLY, PICKUP_ONLY, DELIVERY_ONLY, PREORDER, BACKORDER,
RESTOCK_EXPECTED, OUT_OF_STOCK, DISCONTINUED, UNKNOWN, REQUIRES_LOGIN,
REQUIRES_MEMBERSHIP.

`safeQuantityEstimate` NEVER fabricates quantity from a vague state.
`freshnessOf` reports staleness based on `staleAfter` or default 24h.
