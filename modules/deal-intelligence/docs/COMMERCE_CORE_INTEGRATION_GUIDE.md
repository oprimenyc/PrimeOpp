# Commerce Core Integration Guide

This package exposes two stable seams for integration with future
PrimeOpp Commerce Core:

1. `ProductCandidate` (in `contracts`) — the canonical product identity
   type. Commerce Core should consume and produce this type.

2. `ResaleAnalysis` (in `contracts`) — the canonical resale analysis
   output. Commerce Core's marketplace comp lookup should produce inputs
   compatible with `ResaleInput`.

The `MarketplaceCompAdapter` interface (in `adapter-sdk`) is the seam
through which Commerce Core's comp data feeds into `resale-opportunity`.
