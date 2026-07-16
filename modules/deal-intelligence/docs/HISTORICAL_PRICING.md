# Historical Pricing Engine

`historical-pricing` records `PriceObservation` entries and computes
`PriceHistoryStats`: lowestObserved, medianObserved, recentAverage,
priceFrequency, priceVolatility, freshness.

Storage adapters: in-memory (implemented), SQLite-interface,
PostgreSQL-interface, time-series-extension-interface (contracts only).

Does NOT claim complete market history from sparse observations.
