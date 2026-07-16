# SDK Reference

`@primeopp-deal-intelligence/sdk` exports `PrimeOppSdk` and
`createPrimeOppSdk(opts)`.

```typescript
import { createPrimeOppSdk } from '@primeopp-deal-intelligence/sdk';
const sdk = createPrimeOppSdk();

sdk.listRetailers();
sdk.ingestObservation({ ... });
sdk.normalizeProduct({ sourceTitle: 'Echo Dot B0XYZ', brand: 'amazon' });
sdk.normalizeOffer({ retailerId, productId, prices, availability, source });
sdk.evaluateStack({ basePrice, coupons });
sdk.validateDeal({ offer, product });
sdk.scoreDeal({ offer, product, history });
sdk.analyzeResale({ acquisitionPrice, marketplaceComps });
sdk.buildAffiliateLink({ program, destinationUrl, allowedDomains });
sdk.emitAlert({ type, tenantId, headline, body, score });
sdk.createAmosJob({ kind, title, hook, verifiedFacts, ... });
sdk.captureEvidence({ kind, payload });
sdk.observability.listEvents();
sdk.tenants.create({ ... });
sdk.submissions.submit({ ... });
```

All adapters composed by default are test-only. External integration
requires registering production adapters via `sdk.adapters.register(...)`.
