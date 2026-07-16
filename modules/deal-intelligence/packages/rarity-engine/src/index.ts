/**
 * @primeopp-deal-intelligence/rarity-engine
 *
 * Computes rarity score from observation frequency, stock duration,
 * retailer count, regional concentration, demand proxy, resale premium,
 * release cadence, product lifecycle, community interest. NEVER fabricates
 * scarcity.
 */
import type { ISO8601 } from '@primeopp-deal-intelligence/contracts';

export interface RarityInputs {
  observationCount: number;
  inStockDurationMs: number;
  retailerCount: number;
  regionCount: number;
  demandProxy?: number;       // 0..1, normalized search/community interest
  resalePremiumPct?: number;  // observed resale markup vs retail
  releaseCadencePerYear?: number;
  productLifecycle?: 'emerging' | 'mature' | 'declining' | 'seasonal' | 'limited';
  communityInterestScore?: number; // 0..1
}

export interface RarityOutput {
  rarityScore: number;        // 0..100
  restockConfidence: number;  // 0..1
  urgency: 'high' | 'medium' | 'low';
  likelyStockDurationMs?: number;
  recommendedAlertPriority: 'critical' | 'high' | 'normal' | 'low';
  evidence: string[];
  missing: string[];
}

export function computeRarity(input: RarityInputs): RarityOutput {
  const evidence: string[] = [];
  const missing: string[] = [];

  // Sub-scores (each 0..1, then weighted).
  const obsFreq = clamp01(1 - input.observationCount / 100);
  const stockDur = clamp01(1 - input.inStockDurationMs / (24 * 3600 * 1000));
  const retailCount = clamp01(1 - input.retailerCount / 10);
  const regionConcentration = clamp01(1 - input.regionCount / 5);
  const demand = input.demandProxy ?? 0.5;
  const resale = input.resalePremiumPct !== undefined ? clamp01(input.resalePremiumPct / 100) : 0.5;
  const cadence = input.releaseCadencePerYear !== undefined ? clamp01(1 - input.releaseCadencePerYear / 50) : 0.5;
  const lifecycle = input.productLifecycle === 'limited' ? 1 : input.productLifecycle === 'seasonal' ? 0.7 :
                    input.productLifecycle === 'emerging' ? 0.6 : input.productLifecycle === 'mature' ? 0.3 :
                    input.productLifecycle === 'declining' ? 0.4 : 0.5;
  const community = input.communityInterestScore ?? 0.5;

  if (input.demandProxy === undefined) missing.push('demandProxy');
  if (input.resalePremiumPct === undefined) missing.push('resalePremiumPct');
  if (input.releaseCadencePerYear === undefined) missing.push('releaseCadencePerYear');
  if (input.communityInterestScore === undefined) missing.push('communityInterestScore');

  const weighted =
    obsFreq * 0.15 +
    stockDur * 0.15 +
    retailCount * 0.15 +
    regionConcentration * 0.10 +
    demand * 0.15 +
    resale * 0.15 +
    cadence * 0.05 +
    lifecycle * 0.05 +
    community * 0.05;

  const rarityScore = Math.round(weighted * 100);
  evidence.push(`observationCount=${input.observationCount}`);
  evidence.push(`retailerCount=${input.retailerCount}`);
  evidence.push(`regionCount=${input.regionCount}`);
  if (input.productLifecycle) evidence.push(`lifecycle=${input.productLifecycle}`);

  const restockConfidence = clamp01(1 - input.observationCount / 20);
  const urgency: RarityOutput['urgency'] =
    rarityScore >= 80 ? 'high' : rarityScore >= 50 ? 'medium' : 'low';
  const recommendedAlertPriority: RarityOutput['recommendedAlertPriority'] =
    rarityScore >= 90 ? 'critical' : rarityScore >= 70 ? 'high' :
    rarityScore >= 40 ? 'normal' : 'low';

  return {
    rarityScore,
    restockConfidence,
    urgency,
    likelyStockDurationMs: input.inStockDurationMs > 0 ? input.inStockDurationMs : undefined,
    recommendedAlertPriority,
    evidence,
    missing
  };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Detects scarcity manipulation: same source reporting extremely high rarity
 *  with low observation count and no resale premium evidence. */
export function detectScarcityManipulation(rarity: RarityOutput, inputs: RarityInputs): boolean {
  if (rarity.rarityScore >= 60 && inputs.observationCount < 3 && (inputs.resalePremiumPct ?? 0) < 10) {
    return true;
  }
  return false;
}
