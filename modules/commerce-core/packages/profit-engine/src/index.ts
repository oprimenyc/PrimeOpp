// Profit & ROI engine — Phase 15.

import type {
  EpistemicStatus,
  Money,
  ProfitInput,
  ProfitResult,
  TenantScoped,
} from '@primeopp/contracts';
import { roundTo } from '@primeopp/contracts';

function money(amount: number, currency: string, status: EpistemicStatus = 'ESTIMATED'): Money {
  return { amount: roundTo(amount, 2), currency, precise: false, status };
}

function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    // Don't throw — caller can warn. Treat as UNKNOWN status.
    return money(a.amount + b.amount, a.currency, 'UNKNOWN');
  }
  // If either side is ESTIMATED, the sum is ESTIMATED.
  const status: EpistemicStatus =
    a.status === 'ACTUAL' && b.status === 'ACTUAL' ? 'ACTUAL' :
    a.status === 'AUTHORITATIVE' && b.status === 'AUTHORITATIVE' ? 'AUTHORITATIVE' :
    a.status === 'ESTIMATED' || b.status === 'ESTIMATED' ? 'ESTIMATED' :
    a.status === 'USER_ENTERED' || b.status === 'USER_ENTERED' ? 'USER_ENTERED' :
    'UNKNOWN';
  return money(a.amount + b.amount, a.currency, status);
}

function sub(a: Money, b: Money): Money {
  return money(a.amount - b.amount, a.currency, a.status);
}

function mul(a: Money, factor: number): Money {
  return money(a.amount * factor, a.currency, a.status);
}

/**
 * Compute profit and ROI from input.
 * Every line is tagged with its epistemic status; uncertainty is never hidden.
 */
export function calculateProfit(input: ProfitInput): ProfitResult {
  const currency = input.listingPrice.currency;
  const warnings: string[] = [];
  const statuses: Record<string, EpistemicStatus> = {};

  if (input.costBasis.currency !== currency) warnings.push(`cost basis currency ${input.costBasis.currency} differs from listing ${currency}`);
  if (input.inboundCost.currency !== currency) warnings.push(`inbound cost currency ${input.inboundCost.currency} differs from listing ${currency}`);

  const grossRevenue = { ...input.listingPrice };
  statuses.grossRevenue = grossRevenue.status;

  const productCost = { ...input.costBasis };
  statuses.productCost = productCost.status;

  const inboundCost = { ...input.inboundCost };
  statuses.inboundCost = inboundCost.status;

  // Fees
  let marketplaceFees = money(0, currency, 'ESTIMATED');
  let paymentFees = money(0, currency, 'ESTIMATED');
  if (input.feeAssessment) {
    const total = input.feeAssessment.total;
    // Split into marketplace vs payment if possible; else all marketplace.
    const lineItems = input.feeAssessment.lineItems;
    const mp = lineItems.filter((li) => li.type === 'MARKETPLACE_COMMISSION' || li.type === 'FULFILLMENT_FEE' || li.type === 'LISTING_FEE' || li.type === 'INSERTION_FEE' || li.type === 'PROMOTION_FEE');
    const pay = lineItems.filter((li) => li.type === 'PAYMENT_PROCESSING' || li.type === 'CURRENCY_CONVERSION');
    marketplaceFees = money(mp.reduce((s, li) => s + li.amount.amount, 0), currency, input.feeAssessment.estimated ? 'ESTIMATED' : 'AUTHORITATIVE');
    paymentFees = money(pay.reduce((s, li) => s + li.amount.amount, 0), currency, input.feeAssessment.estimated ? 'ESTIMATED' : 'AUTHORITATIVE');
    if (input.feeAssessment.staleWarnings.length > 0) {
      warnings.push(...input.feeAssessment.staleWarnings);
    }
  } else {
    warnings.push('fee assessment missing — fee estimates default to zero');
  }
  statuses.marketplaceFees = marketplaceFees.status;
  statuses.paymentFees = paymentFees.status;

  // Shipping
  const shipping = input.shippingEstimate
    ? money(input.shippingEstimate.estimatedRange.midpoint.amount, currency, 'ESTIMATED')
    : money(0, currency, 'UNKNOWN');
  statuses.shipping = shipping.status;
  if (!input.shippingEstimate) warnings.push('shipping estimate missing — assumed zero');

  // Packaging
  const packaging = input.packagingCost ?? (input.shippingEstimate ? input.shippingEstimate.packagingCost : money(0, currency, 'UNKNOWN'));
  statuses.packaging = packaging.status;

  // Labor / storage / promotion / return reserve
  const labor = input.laborAllocation ?? money(0, currency, 'UNKNOWN');
  const storage = input.storageAllocation ?? money(0, currency, 'UNKNOWN');
  const promotion = input.promotionFees ?? money(0, currency, 'UNKNOWN');
  const returnReserve = input.returnReserve ?? money(0, currency, 'UNKNOWN');
  statuses.labor = labor.status;
  statuses.storage = storage.status;
  statuses.promotion = promotion.status;
  statuses.returnReserve = returnReserve.status;

  // Tax treatment
  if (input.taxTreatment === 'INCLUDED') {
    // Tax is already in listingPrice; no adjustment needed.
  } else {
    // Tax excluded — seller receives full listing price (no tax withheld in this model).
  }

  // Net profit
  const totalCosts = add(add(add(add(add(add(add(productCost, inboundCost), marketplaceFees), paymentFees), shipping), packaging), add(add(labor, storage), promotion)), returnReserve);
  const netProfit = sub(grossRevenue, totalCosts);
  statuses.netProfit = netProfit.status;

  // Margin
  const margin = grossRevenue.amount > 0 ? netProfit.amount / grossRevenue.amount : 0;
  // ROI = netProfit / totalCosts
  const roi = totalCosts.amount > 0 ? netProfit.amount / totalCosts.amount : 0;

  // Break-even price: the listing price at which netProfit = 0.
  const breakEvenPrice = money(totalCosts.amount, currency, totalCosts.status);

  // Maximum buy price: the maximum acquisition cost at which netProfit = 0 at the current listing price.
  const maximumBuyPrice = money(
    grossRevenue.amount - (totalCosts.amount - productCost.amount),
    currency,
    'ESTIMATED',
  );

  // Profit per day (if time-to-sale is encoded somewhere — here we skip if not provided).
  // Annualized return: ROI * (365 / inventoryAgeDays). Without inventory age, skip.
  const profitPerDay: Money | undefined = undefined;
  const annualizedReturn: number | undefined = undefined;

  return {
    grossRevenue,
    productCost,
    inboundCost,
    marketplaceFees,
    paymentFees,
    shipping,
    packaging,
    labor,
    storage,
    promotion,
    returnReserve,
    netProfit,
    margin: roundTo(margin, 4),
    roi: roundTo(roi, 4),
    breakEvenPrice,
    maximumBuyPrice,
    ...(profitPerDay ? { profitPerDay } : {}),
    ...(annualizedReturn !== undefined ? { annualizedReturn } : {}),
    statuses,
    warnings,
  };
}

/**
 * Compute the target buy price for a desired ROI.
 * targetBuyPrice = listingPrice - (non-product costs) / (1 + desiredRoi)
 */
export function computeTargetBuyPrice(opts: {
  listingPrice: Money;
  nonProductCosts: Money;
  desiredRoi: number;
}): Money {
  const netAfterCosts = opts.listingPrice.amount - opts.nonProductCosts.amount;
  const target = netAfterCosts / (1 + opts.desiredRoi);
  return money(target, opts.listingPrice.currency, 'ESTIMATED');
}
