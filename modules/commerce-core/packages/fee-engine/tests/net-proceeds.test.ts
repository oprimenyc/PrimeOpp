import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMarketplaceNetProceeds } from '../src/index.ts';

const usd = (amount: number, status: 'ACTUAL' | 'AUTHORITATIVE' | 'ESTIMATED' | 'USER_ENTERED' | 'UNKNOWN' = 'AUTHORITATIVE') => ({
  amount,
  currency: 'USD',
  precise: true,
  status
});

test('calculateMarketplaceNetProceeds keeps platform-collected tax explicit', () => {
  const result = calculateMarketplaceNetProceeds({
    marketplaceRef: 'ebay',
    salePrice: usd(100),
    taxCollectedByPlatform: usd(8),
    includePlatformCollectedTaxInRevenue: false,
    shippingChargedToBuyer: true,
    shippingCostToSeller: usd(10),
    packagingCost: usd(2),
    sellerCostBasis: usd(50),
    feeAssessment: {
      scheduleRef: 's1',
      scheduleVersion: '1',
      basis: usd(100),
      lineItems: [
        { type: 'MARKETPLACE_COMMISSION', amount: usd(8), model: 'PERCENTAGE', rate: 0.08 },
        { type: 'PAYMENT_PROCESSING', amount: usd(3), model: 'PERCENTAGE', rate: 0.03 }
      ],
      total: usd(11),
      estimated: false,
      staleWarnings: []
    },
    scope: { tenantId: 't1' }
  });

  assert.equal(result.buyerTotal.amount, 118);
  assert.equal(result.grossSaleAmount.amount, 110);
  assert.equal(result.totalSellerCostInputs.amount, 23);
  assert.equal(result.netProceedsBeforeCostBasis.amount, 87);
  assert.equal(result.profitAmount?.amount, 37);
  assert.equal(result.feeState, 'explicit');
});

test('calculateMarketplaceNetProceeds labels estimated fees and preserves warnings', () => {
  const result = calculateMarketplaceNetProceeds({
    marketplaceRef: 'poshmark',
    salePrice: usd(100),
    sellerCostBasis: usd(40),
    feeAssessment: {
      scheduleRef: 's2',
      scheduleVersion: '1',
      basis: usd(100, 'ESTIMATED'),
      lineItems: [
        { type: 'MARKETPLACE_COMMISSION', amount: usd(20, 'ESTIMATED'), model: 'PERCENTAGE', rate: 0.2 }
      ],
      total: usd(20, 'ESTIMATED'),
      estimated: true,
      staleWarnings: ['fee schedule source is stale']
    },
    scope: { tenantId: 't1' }
  });

  assert.equal(result.feeState, 'estimated');
  assert.equal(result.platformFeeTotal.amount, 20);
  assert.ok(result.warnings.some((warning) => warning.code === 'STALE_FEE_SCHEDULE'));
});

test('calculateMarketplaceNetProceeds does not invent fee or profit values when inputs are missing', () => {
  const result = calculateMarketplaceNetProceeds({
    marketplaceRef: 'unknown-marketplace',
    salePrice: usd(100),
    scope: { tenantId: 't1' }
  });

  assert.equal(result.feeState, 'unknown');
  assert.equal(result.platformFeeTotal.amount, 0);
  assert.equal(result.paymentFeeTotal.amount, 0);
  assert.equal(result.profitAmount, null);
  assert.ok(result.warnings.some((warning) => warning.code === 'FEE_ASSESSMENT_MISSING'));
  assert.ok(result.warnings.some((warning) => warning.code === 'MISSING_COST_BASIS'));
});
