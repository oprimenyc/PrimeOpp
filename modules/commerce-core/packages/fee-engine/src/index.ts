// Fee engine — Phase 13.
// Provider-agnostic fee modeling with versioned schedules and effective dates.

import type {
  FeeAssessment,
  FeeLineItem,
  FeeModel,
  FeeSchedule,
  FeeScheduleEntry,
  FeeType,
  Identified,
  Money,
  TenantScoped,
  Timestamped,
  Warning,
} from '@primeopp/contracts';
import { nowUtc, roundTo, uuid } from '@primeopp/contracts';

export type MarketplaceFeeState = 'explicit' | 'estimated' | 'unknown';

export interface MarketplaceNetProceedsInput {
  marketplaceRef: string;
  salePrice: Money;
  feeAssessment?: FeeAssessment;
  sellerCostBasis?: Money;
  shippingChargedToBuyer?: boolean;
  shippingCostToSeller?: Money;
  packagingCost?: Money;
  taxCollectedByPlatform?: Money;
  includePlatformCollectedTaxInRevenue?: boolean;
  promotionalFeeAdjustments?: Money;
  miscellaneousCosts?: readonly Money[];
  scope: TenantScoped;
}

export interface MarketplaceNetProceedsResult {
  marketplaceRef: string;
  grossSaleAmount: Money;
  buyerTotal: Money;
  platformFeeTotal: Money;
  paymentFeeTotal: Money;
  sellerPaidShipping: Money;
  packagingCost: Money;
  miscellaneousCosts: Money;
  promotionalFeeAdjustments: Money;
  totalSellerCostInputs: Money;
  netProceedsBeforeCostBasis: Money;
  totalCostBasis: Money | null;
  profitAmount: Money | null;
  profitMarginPercent: number | null;
  feeState: MarketplaceFeeState;
  warnings: Warning[];
  appliedFeeLineItems: FeeLineItem[];
}

export interface FeeScheduleRegistry {
  schedules: Map<string, FeeSchedule>; // marketplaceRef -> schedule
}

export function createFeeScheduleRegistry(): FeeScheduleRegistry {
  return { schedules: new Map() };
}

export function registerFeeSchedule(reg: FeeScheduleRegistry, schedule: FeeSchedule): void {
  reg.schedules.set(schedule.marketplaceRef, schedule);
}

export function getFeeSchedule(reg: FeeScheduleRegistry, marketplaceRef: string): FeeSchedule | undefined {
  return reg.schedules.get(marketplaceRef);
}

/**
 * Build a FeeSchedule with versioned entries.
 */
export function buildFeeSchedule(opts: {
  marketplaceRef: string;
  version: string;
  entries: FeeScheduleEntry[];
}): FeeSchedule & Identified & Timestamped {
  const stale = opts.entries.some((e) => e.effectiveTo !== undefined && new Date(e.effectiveTo) < new Date());
  return {
    id: uuid(),
    marketplaceRef: opts.marketplaceRef,
    version: opts.version,
    entries: opts.entries,
    stale,
    createdAt: nowUtc(),
    updatedAt: nowUtc(),
  };
}

/**
 * Check whether a schedule entry is stale (past its effectiveTo date).
 */
export function isEntryStale(entry: FeeScheduleEntry, at: Date = new Date()): boolean {
  if (entry.effectiveTo === undefined) return false;
  return new Date(entry.effectiveTo) < at;
}

/**
 * Find the applicable schedule entry for a given fee type.
 * Picks the entry that is currently effective (effectiveFrom <= now <= effectiveTo).
 * If multiple match, picks the one with the most specific scope (category > sellerTier > base).
 */
export function findApplicableEntry(
  schedule: FeeSchedule,
  type: FeeType,
  opts: { category?: string; sellerTier?: string; promotionRef?: string; at?: Date } = {},
): FeeScheduleEntry | undefined {
  const at = opts.at ?? new Date();
  const matching = schedule.entries.filter((e) => {
    if (e.type !== type) return false;
    if (new Date(e.effectiveFrom) > at) return false;
    if (e.effectiveTo !== undefined && new Date(e.effectiveTo) < at) return false;
    if (opts.category !== undefined && e.category !== undefined && e.category !== opts.category) return false;
    if (opts.sellerTier !== undefined && e.sellerTier !== undefined && e.sellerTier !== opts.sellerTier) return false;
    if (opts.promotionRef !== undefined && e.promotionRef !== undefined && e.promotionRef !== opts.promotionRef) return false;
    return true;
  });
  // Specificity score: more specific scope wins.
  const score = (e: FeeScheduleEntry) =>
    (e.category !== undefined ? 4 : 0) +
    (e.sellerTier !== undefined ? 2 : 0) +
    (e.promotionRef !== undefined ? 1 : 0);
  matching.sort((a, b) => score(b) - score(a));
  return matching[0];
}

/**
 * Compute a single fee line item from a schedule entry.
 */
export function computeFeeLineItem(entry: FeeScheduleEntry, basis: Money): FeeLineItem {
  let amount = 0;
  const model: FeeModel = entry.model;
  switch (model) {
    case 'PERCENTAGE':
      amount = basis.amount * entry.rate;
      break;
    case 'FIXED':
      amount = entry.rate;
      break;
    case 'TIERED': {
      let tierAmount = 0;
      for (const tier of entry.tiers ?? []) {
        if (basis.amount >= tier.min && (tier.max === undefined || basis.amount < tier.max)) {
          tierAmount = tier.rate !== undefined ? basis.amount * tier.rate : 0;
          if (tier.fixed !== undefined) tierAmount += tier.fixed;
          break;
        }
      }
      amount = tierAmount;
      break;
    }
    case 'CAPPED':
      amount = Math.min(basis.amount * entry.rate, entry.cap ?? Infinity);
      break;
    case 'MINIMUM':
      amount = Math.max(basis.amount * entry.rate, entry.minimum ?? 0);
      break;
    default:
      amount = 0;
  }
  const stale = isEntryStale(entry);
  return {
    type: entry.type,
    amount: { amount, currency: entry.currency, precise: false, status: stale ? 'ESTIMATED' : 'AUTHORITATIVE' },
    model,
    ...(entry.rate !== undefined ? { rate: entry.rate } : {}),
    scheduleEntryRef: entry.sourceRef,
    ...(stale ? { stale: true } : {}),
  };
}

/**
 * Assess all applicable fees for a marketplace sale.
 * Applies EVERY currently-effective entry that matches the scope filters,
 * not just one per fee type. Each entry produces a separate line item.
 */
export function assessFees(opts: {
  schedule: FeeSchedule;
  basis: Money;
  types?: FeeType[]; // if omitted, all applicable types in schedule
  category?: string;
  sellerTier?: string;
  promotionRef?: string;
  at?: Date;
  scope: TenantScoped;
}): FeeAssessment {
  const at = opts.at ?? new Date();
  const wantedTypes = opts.types ?? Array.from(new Set(opts.schedule.entries.map((e) => e.type)));
  const wantedSet = new Set(wantedTypes);
  const lineItems: FeeLineItem[] = [];
  const staleWarnings: string[] = [];
  let estimated = false;

  for (const entry of opts.schedule.entries) {
    if (!wantedSet.has(entry.type)) continue;
    // Effective date filter.
    if (new Date(entry.effectiveFrom) > at) continue;
    if (entry.effectiveTo !== undefined && new Date(entry.effectiveTo) < at) continue;
    // Scope filters — entry must match if scope is specified.
    if (opts.category !== undefined && entry.category !== undefined && entry.category !== opts.category) continue;
    if (opts.sellerTier !== undefined && entry.sellerTier !== undefined && entry.sellerTier !== opts.sellerTier) continue;
    if (opts.promotionRef !== undefined && entry.promotionRef !== undefined && entry.promotionRef !== opts.promotionRef) continue;
    // If entry has a category but caller didn't specify, still apply (it's the default for that category).
    // If caller specified category and entry has none, also apply (entry is category-agnostic).

    const li = computeFeeLineItem(entry, opts.basis);
    lineItems.push(li);
    if (li.stale) {
      estimated = true;
      staleWarnings.push(`fee type ${entry.type} used stale schedule entry (past effectiveTo)`);
    }
  }

  const totalAmount = Math.round((lineItems.reduce((s, li) => s + li.amount.amount, 0)) * 100) / 100;

  return {
    scheduleRef: opts.schedule.id,
    scheduleVersion: opts.schedule.version,
    basis: opts.basis,
    lineItems,
    total: { amount: totalAmount, currency: opts.basis.currency, precise: false, status: estimated ? 'ESTIMATED' : 'AUTHORITATIVE' },
    estimated,
    staleWarnings,
  };
}

function zeroMoney(currency: string): Money {
  return { amount: 0, currency, precise: true, status: 'UNKNOWN' };
}

function cloneMoney(m: Money): Money {
  return { ...m, amount: roundTo(m.amount, 2) };
}

function addMoney(currency: string, values: readonly (Money | undefined)[]): Money {
  const present = values.filter((value): value is Money => value !== undefined);
  const mismatched = present.some((value) => value.currency !== currency);
  const estimated = present.some((value) => value.status === 'ESTIMATED' || value.status === 'UNKNOWN');
  return {
    amount: roundTo(present.reduce((sum, value) => sum + value.amount, 0), 2),
    currency,
    precise: !estimated && !mismatched,
    status: mismatched ? 'UNKNOWN' : estimated ? 'ESTIMATED' : 'AUTHORITATIVE'
  };
}

function subtractMoney(left: Money, right: Money): Money {
  return {
    amount: roundTo(left.amount - right.amount, 2),
    currency: left.currency,
    precise: left.precise && right.precise && left.currency === right.currency,
    status: left.currency === right.currency ? left.status : 'UNKNOWN'
  };
}

function feeWarning(code: string, message: string, severity: Warning['severity'] = 'MEDIUM'): Warning {
  return { code, message, severity };
}

function sumFeeLines(assessment: FeeAssessment | undefined, types: readonly FeeType[], currency: string): Money {
  if (assessment === undefined) return zeroMoney(currency);
  return addMoney(
    currency,
    assessment.lineItems
      .filter((lineItem) => types.includes(lineItem.type))
      .map((lineItem) => lineItem.amount)
  );
}

export function calculateMarketplaceNetProceeds(input: MarketplaceNetProceedsInput): MarketplaceNetProceedsResult {
  const currency = input.salePrice.currency;
  const warnings: Warning[] = [];
  const sellerPaidShipping = cloneMoney(input.shippingCostToSeller ?? zeroMoney(currency));
  const buyerPaidShipping = input.shippingChargedToBuyer ? sellerPaidShipping : zeroMoney(currency);
  const taxCollectedByPlatform = cloneMoney(input.taxCollectedByPlatform ?? zeroMoney(currency));
  const packagingCost = cloneMoney(input.packagingCost ?? zeroMoney(currency));
  const promotionalFeeAdjustments = cloneMoney(input.promotionalFeeAdjustments ?? zeroMoney(currency));
  const miscellaneousCosts = addMoney(currency, input.miscellaneousCosts ?? []);
  const platformFeeTotal = sumFeeLines(input.feeAssessment, [
    'MARKETPLACE_COMMISSION',
    'LISTING_FEE',
    'INSERTION_FEE',
    'PROMOTION_FEE',
    'AUTHENTICATION_FEE',
    'FULFILLMENT_FEE',
    'STORAGE_FEE',
    'WITHDRAWAL_FEE',
    'RETURN_RESERVE',
    'SHIPPING_LABEL_MARKUP',
    'SUBSCRIPTION_ALLOCATION',
    'CUSTOM_FEE'
  ], currency);
  const paymentFeeTotal = sumFeeLines(input.feeAssessment, ['PAYMENT_PROCESSING', 'CURRENCY_CONVERSION'], currency);

  if (input.feeAssessment === undefined) {
    warnings.push(feeWarning('FEE_ASSESSMENT_MISSING', 'Fee assessment missing; net proceeds exclude marketplace and payment fees.', 'HIGH'));
  } else {
    for (const warning of input.feeAssessment.staleWarnings) {
      warnings.push(feeWarning('STALE_FEE_SCHEDULE', warning, 'MEDIUM'));
    }
  }

  if (input.sellerCostBasis === undefined) {
    warnings.push(feeWarning('MISSING_COST_BASIS', 'Missing cost basis; profit fields remain null until sellerCostBasis is provided.', 'MEDIUM'));
  }

  const grossSaleAmount = addMoney(currency, [
    input.salePrice,
    buyerPaidShipping,
    input.includePlatformCollectedTaxInRevenue ? taxCollectedByPlatform : undefined
  ]);
  const buyerTotal = addMoney(currency, [input.salePrice, buyerPaidShipping, taxCollectedByPlatform]);
  const totalSellerCostInputs = subtractMoney(
    addMoney(currency, [
      platformFeeTotal,
      paymentFeeTotal,
      sellerPaidShipping,
      packagingCost,
      miscellaneousCosts
    ]),
    promotionalFeeAdjustments
  );
  const netProceedsBeforeCostBasis = subtractMoney(grossSaleAmount, totalSellerCostInputs);
  const totalCostBasis = input.sellerCostBasis === undefined
    ? null
    : addMoney(currency, [input.sellerCostBasis, totalSellerCostInputs]);
  const profitAmount = input.sellerCostBasis === undefined
    ? null
    : subtractMoney(netProceedsBeforeCostBasis, input.sellerCostBasis);
  const profitMarginPercent = profitAmount === null || grossSaleAmount.amount === 0
    ? null
    : roundTo((profitAmount.amount / grossSaleAmount.amount) * 100, 2);
  const feeState: MarketplaceFeeState = input.feeAssessment === undefined
    ? 'unknown'
    : input.feeAssessment.estimated
      ? 'estimated'
      : 'explicit';

  return {
    marketplaceRef: input.marketplaceRef.trim(),
    grossSaleAmount,
    buyerTotal,
    platformFeeTotal,
    paymentFeeTotal,
    sellerPaidShipping,
    packagingCost,
    miscellaneousCosts,
    promotionalFeeAdjustments,
    totalSellerCostInputs,
    netProceedsBeforeCostBasis,
    totalCostBasis,
    profitAmount,
    profitMarginPercent,
    feeState,
    warnings,
    appliedFeeLineItems: input.feeAssessment?.lineItems ?? []
  };
}

/**
 * Default fee schedule for the PrimeOpp Marketplace.
 * These are illustrative defaults; real adapters MUST supply their own schedule.
 */
export function defaultPrimeOppMarketplaceFeeSchedule(): FeeSchedule {
  return buildFeeSchedule({
    marketplaceRef: 'primeopp-marketplace',
    version: '1.0.0-default',
    entries: [
      {
        type: 'MARKETPLACE_COMMISSION',
        model: 'PERCENTAGE',
        rate: 0.08,
        currency: 'USD',
        effectiveFrom: '2025-01-01T00:00:00Z',
        sourceRef: 'primeopp:default',
      },
      {
        type: 'PAYMENT_PROCESSING',
        model: 'PERCENTAGE',
        rate: 0.029,
        currency: 'USD',
        effectiveFrom: '2025-01-01T00:00:00Z',
        sourceRef: 'primeopp:default',
      },
      {
        type: 'PAYMENT_PROCESSING',
        model: 'FIXED',
        rate: 0.30,
        currency: 'USD',
        effectiveFrom: '2025-01-01T00:00:00Z',
        sourceRef: 'primeopp:default',
      },
    ],
  });
}
