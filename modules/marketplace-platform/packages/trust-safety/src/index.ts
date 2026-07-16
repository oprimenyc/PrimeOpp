
// @primeopp-marketplace/trust-safety
import type { TrustSafetyAssessment, RiskOutcome, RiskSignal, ProhibitedProductPolicy, ProhibitedProductCategory, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const DEFAULT_PROHIBITED_PRODUCT_POLICY: ProhibitedProductPolicy = {
  policyId: 'prohibited_default',
  tenantId: 'tenant_demo',
  version: '2026.01',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  categories: [
    { categoryId: 'illegal_goods', name: 'Illegal Goods', description: 'Items illegal to sell', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'stolen_goods', name: 'Stolen Goods', description: 'Items suspected stolen', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'counterfeit_goods', name: 'Counterfeit Goods', description: 'Fake branded items', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'firearms', name: 'Firearms', description: 'Guns and ammunition', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'ammunition', name: 'Ammunition', description: 'Ammo', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'explosives', name: 'Explosives', description: 'Explosive materials', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'controlled_substances', name: 'Controlled Substances', description: 'Drugs and regulated substances', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'prescription_drugs', name: 'Prescription Drugs', description: 'Rx medication', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'recalled_products', name: 'Recalled Products', description: 'Recalled items', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'hazardous_materials', name: 'Hazardous Materials', description: 'Hazmat', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'adult_products', name: 'Adult Products', description: 'Age-restricted adult items', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'wildlife_contraband', name: 'Wildlife Contraband', description: 'Endangered species products', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'extremist_merchandise', name: 'Extremist Merchandise', description: 'Hate/extremist items', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'surveillance_malware', name: 'Surveillance Malware', description: 'Spyware/malware', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'personal_data', name: 'Personal Data', description: 'PII for sale', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'financial_credentials', name: 'Financial Credentials', description: 'Bank/credit credentials', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'government_ids', name: 'Government IDs', description: 'Official IDs', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'age_restricted_goods', name: 'Age-Restricted Goods', description: 'Items requiring age verification', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'medical_devices', name: 'Medical Devices', description: 'Regulated medical devices', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'alcohol', name: 'Alcohol', description: 'Alcoholic beverages', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'nicotine', name: 'Nicotine', description: 'Nicotine/vaping products', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'gambling_devices', name: 'Gambling Devices', description: 'Gambling equipment', prohibitedByDefault: false, requiresJurisdictionReview: true }
  ]
};

export function isProhibited(policy: ProhibitedProductPolicy, categoryId: string): boolean {
  const cat = policy.categories.find(c => c.categoryId === categoryId);
  return cat?.prohibitedByDefault === true;
}

export function findProhibitedCategory(policy: ProhibitedProductPolicy, categoryId: string): ProhibitedProductCategory | undefined {
  return policy.categories.find(c => c.categoryId === categoryId);
}

export function assessListingRisk(params: {
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly signals: readonly RiskSignal[];
  readonly riskScore: number;
  readonly evidence?: EvidenceStore;
}): TrustSafetyAssessment {
  const { tenantId, listingId, signals, riskScore } = params;
  let outcome: RiskOutcome = 'ALLOW';
  if (riskScore >= 0.9) outcome = 'REJECT_LISTING';
  else if (riskScore >= 0.7) outcome = 'REQUIRE_REVIEW';
  else if (riskScore >= 0.4) outcome = 'REQUIRE_VERIFICATION';
  else if (riskScore >= 0.2) outcome = 'ALLOW_WITH_MONITORING';

  const mitigations: string[] = [];
  const detections: string[] = [];
  const tests: string[] = [];

  for (const s of signals) {
    detections.push(s);
    if (s === 'counterfeit_listings') { mitigations.push('pause publication'); tests.push('counterfeit_signal_test'); }
    if (s === 'prohibited_goods') { mitigations.push('reject listing'); tests.push('prohibited_product_test'); }
    if (s === 'stolen_goods') { mitigations.push('require ownership proof'); tests.push('stolen_goods_test'); }
  }

  const result: TrustSafetyAssessment = {
    assessmentId: newId('risk'),
    tenantId,
    subjectType: 'listing',
    subjectId: listingId,
    signals,
    riskScore,
    outcome,
    mitigations,
    detections,
    tests,
    residualRisk: outcome === 'ALLOW' ? 'low' : outcome === 'REJECT_LISTING' ? 'none' : 'medium',
    evidence: [],
    assessedAt: new Date().toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId, kind: 'trust_safety_assessment', description: `risk assessment: ${outcome} (score=${riskScore})`,
      actor: { actorType: 'system', actorId: 'trust-safety', tenantId },
      subject: { type: 'listing', id: listingId },
      payload: { outcome, signals, riskScore }
    });
  }
  return result;
}

// Counterfeit risk check — pauses publication and routes to human review
export function checkCounterfeitRisk(params: {
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly title: string;
  readonly description: string;
  readonly authenticityVerified: boolean;
  readonly evidence?: EvidenceStore;
}): { paused: boolean; assessment: TrustSafetyAssessment } {
  const text = (params.title + ' ' + params.description).toLowerCase();
  const signals: RiskSignal[] = [];
  if (text.includes('replica') || text.includes('1:1') || text.includes('fake')) signals.push('counterfeit_listings');
  if (!params.authenticityVerified && /rolex|louis vuitton|gucci|prada|chanel/i.test(text)) signals.push('counterfeit_listings');

  const riskScore = signals.length > 0 ? 0.85 : 0.1;
  const assessment = assessListingRisk({
    tenantId: params.tenantId,
    listingId: params.listingId,
    signals,
    riskScore,
    evidence: params.evidence
  });
  return { paused: assessment.outcome === 'REQUIRE_REVIEW' || assessment.outcome === 'REJECT_LISTING', assessment };
}

