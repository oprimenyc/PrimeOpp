// Example L — Cross-Listing Ready Product workflow.
import { createSdk } from '@primeopp/sdk';

async function main() {
  console.log('=== Workflow L: Cross-Listing Ready Product ===');
  const sdk = createSdk({ tenantId: 'demo' });

  // Create a listing with multiple channels
  const listing = sdk.createCanonicalListing({
    productId: 'p1',
    title: 'Cross-Listing Demo',
    tenantId: 'demo',
    price: { amount: { amount: 100, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: true, minimumOffer: { amount: 80, currency: 'USD', precise: false, status: 'ESTIMATED' } },
    quantity: 5,
    condition: 'GOOD',
    selectedChannels: ['ebay-test-adapter'],
  });
  console.log('Initial listing:');
  console.log(sdk.listingPreview(listing));

  // Validate (no acceptance yet → should fail)
  const v1 = sdk.validateListingForPublication(listing);
  console.log(`\nValidation before acceptance: ${v1.valid ? 'VALID' : 'INVALID'} — ${v1.errors.join('; ')}`);

  // Accept channels
  const { listing: accepted } = sdk.acceptSelectedChannels(listing, { userRef: 'demo-user' });
  const v2 = sdk.validateListingForPublication(accepted);
  console.log(`Validation after acceptance: ${v2.valid ? 'VALID' : 'INVALID'}`);

  // Opt out of PrimeOpp Marketplace
  const { listing: optedOut } = sdk.disablePrimeOppMarketplace(accepted, { userRef: 'demo-user', reason: 'user preference' });
  console.log('\nAfter opt-out:');
  console.log(sdk.listingPreview(optedOut));
}

main().catch(console.error);
