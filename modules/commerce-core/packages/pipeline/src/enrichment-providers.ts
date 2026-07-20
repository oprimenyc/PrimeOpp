// Local, provider-neutral enrichment sources for the ingestion pipeline.
//
// Deliberately excludes primeopp-product-enrichment's GenericHttpProductProvider
// (calls a real network endpoint) and IsbnProductProvider's live-source configs --
// this pipeline must run fully offline, with no paid provider and no production
// API calls. ManualInputProvider handles anything with operator-entered fields;
// FixtureProductProvider handles a small set of known demo barcodes so the
// identifier-only (scan, no manual data) path has a real success case to exercise.

import { ManualInputProvider, FixtureProductProvider } from 'primeopp-product-enrichment';
import type { ProductEnrichmentProvider, FixtureRecord } from 'primeopp-product-enrichment';

const DEMO_FIXTURES: FixtureRecord[] = [
  {
    id: 'fixture-demo-001',
    matchBy: { gtin: '036000291452' },
    confidence: 0.95,
    exactMatch: true,
    fields: {
      'identity.canonicalTitle': 'Kraft Original Macaroni & Cheese Dinner, 7.25 oz Box',
      'identity.brand': 'Kraft',
      'classification.category': 'Grocery > Pantry > Pasta & Macaroni',
    },
  },
  {
    id: 'fixture-demo-002',
    matchBy: { isbn: '9780132350884' },
    confidence: 0.95,
    exactMatch: true,
    fields: {
      'identity.canonicalTitle': 'Clean Code: A Handbook of Agile Software Craftsmanship',
      'identity.brand': 'Prentice Hall',
      'classification.category': 'Books > Computers & Technology > Programming',
    },
  },
];

export function createLocalEnrichmentProviders(
  extraFixtures: FixtureRecord[] = []
): Array<{ provider: ProductEnrichmentProvider; priority?: number }> {
  return [
    { provider: new ManualInputProvider(), priority: 50 },
    { provider: new FixtureProductProvider({ records: [...DEMO_FIXTURES, ...extraFixtures] }), priority: 10 },
  ];
}
