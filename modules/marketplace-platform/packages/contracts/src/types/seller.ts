// Canonical Seller model.
import type {
  Identifier, TenantId, ISO8601, SecretReference, Money, ActorReference, EvidenceRecord
} from './common.js';

export type SellerType =
  | 'individual_reseller'
  | 'sole_proprietor'
  | 'business'
  | 'consignment_seller'
  | 'nonprofit'
  | 'thrift_store'
  | 'pawn_shop'
  | 'retailer'
  | 'liquidation_company'
  | 'estate_sale_company'
  | 'enterprise'
  | 'white_label_tenant';

export type SellerRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'listing_manager'
  | 'inventory_manager'
  | 'order_manager'
  | 'finance'
  | 'viewer'
  | 'api';

export type SellerPermission =
  | 'listing.create'
  | 'listing.read'
  | 'listing.update'
  | 'listing.publish'
  | 'listing.pause'
  | 'listing.end'
  | 'inventory.read'
  | 'inventory.update'
  | 'order.read'
  | 'order.process'
  | 'order.cancel'
  | 'return.process'
  | 'dispute.read'
  | 'dispute.respond'
  | 'finance.read'
  | 'finance.payout'
  | 'settings.update'
  | 'team.manage';

export type SellerVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'expired';

export type SellerLifecycleState =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'paused'
  | 'closed'
  | 'terminated';

export interface SellerProfile {
  readonly displayName: string;
  readonly legalName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly websiteUrl?: string;
  readonly contactEmail: string;
  readonly contactPhone?: string;
  readonly timezone: string;
  readonly locale: string;
}

export interface SellerOrganization {
  readonly organizationId: Identifier;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly sellerType: SellerType;
  readonly defaultAlsoListOnPrimeOppMarketplace: boolean;
  readonly defaultChannels: readonly string[];
  readonly taxProfileRef?: SecretReference;
  readonly payoutProfileRef?: SecretReference;
  readonly createdAt: ISO8601;
}

export interface SellerAccount {
  readonly accountId: Identifier;
  readonly organizationId: Identifier;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly lifecycle: SellerLifecycleState;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export interface SellerChannelAccount {
  readonly channelAccountId: Identifier;
  readonly organizationId: Identifier;
  readonly channelId: string;
  readonly displayName: string;
  readonly credentialsRef?: SecretReference;
  readonly authorizedAt: ISO8601;
  readonly revokedAt?: ISO8601;
}

export interface SellerStorefront {
  readonly storefrontId: Identifier;
  readonly organizationId: Identifier;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly logoUrl?: string;
  readonly bannerUrl?: string;
  readonly publicUrl: string;
}

export interface SellerLocation {
  readonly locationId: Identifier;
  readonly organizationId: Identifier;
  readonly name: string;
  readonly kind: 'warehouse' | 'storefront' | 'office' | 'safe_meeting_point';
  readonly addressRef?: SecretReference; // never raw home address
  readonly publicSafeLocation?: { readonly name: string; readonly instructions: string };
  readonly supportsLocalPickup: boolean;
}

export interface SellerWarehouse {
  readonly warehouseId: Identifier;
  readonly locationId: Identifier;
  readonly organizationId: Identifier;
  readonly name: string;
  readonly region: string;
  readonly timezone: string;
}

export interface SellerTeam {
  readonly teamId: Identifier;
  readonly organizationId: Identifier;
  readonly name: string;
  readonly memberIds: readonly Identifier[];
}

export interface SellerUser {
  readonly userId: Identifier;
  readonly organizationId: Identifier;
  readonly tenantId: TenantId;
  readonly teamIds: readonly Identifier[];
  readonly roles: readonly SellerRole[];
  readonly permissions: readonly SellerPermission[];
  readonly identityRef?: SecretReference; // points at Identity Runtime
}

export interface SellerPolicy {
  readonly policyId: Identifier;
  readonly organizationId: Identifier;
  readonly returnWindowDays: number;
  readonly restockingFeePercent: number;
  readonly localPickupPolicy: 'disabled' | 'public_safe_location' | 'business_location' | 'private_with_consent';
  readonly shippingPolicyRef?: Identifier;
  readonly prohibitedItemsAck: boolean;
}

export interface SellerSubscription {
  readonly subscriptionId: Identifier;
  readonly organizationId: Identifier;
  readonly plan: 'free' | 'pro' | 'business' | 'enterprise' | 'white_label';
  readonly startedAt: ISO8601;
  readonly renewsAt?: ISO8601;
}

export interface SellerFeePlan {
  readonly feePlanId: Identifier;
  readonly organizationId: Identifier;
  readonly tier: 'standard' | 'verified' | 'launch_promo' | 'enterprise_contract';
  readonly discountPercent: number;
}

export interface SellerPayoutProfileReference {
  readonly payoutProfileId: Identifier;
  readonly organizationId: Identifier;
  readonly provider: string;
  readonly accountRef: SecretReference; // never raw banking data
}

export interface SellerTaxProfileReference {
  readonly taxProfileId: Identifier;
  readonly organizationId: Identifier;
  readonly jurisdiction: string;
  readonly profileRef: SecretReference;
}

export interface SellerVerification {
  readonly verificationId: Identifier;
  readonly organizationId: Identifier;
  readonly status: SellerVerificationStatus;
  readonly kind: 'identity' | 'business' | 'tax' | 'address' | 'bank' | 'phone';
  readonly verifiedAt?: ISO8601;
  readonly expiresAt?: ISO8601;
  readonly evidenceId?: Identifier;
}

export interface SellerRiskProfile {
  readonly riskProfileId: Identifier;
  readonly organizationId: Identifier;
  readonly riskScore: number; // 0..1
  readonly signals: readonly string[];
  readonly updatedAt: ISO8601;
}

export interface SellerReputation {
  readonly reputationId: Identifier;
  readonly organizationId: Identifier;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly disputeRate: number;
  readonly cancellationRate: number;
  readonly updatedAt: ISO8601;
}

export interface SellerEvidence {
  readonly evidence: EvidenceRecord;
  readonly organizationId: Identifier;
}

export interface SellerLifecycle {
  readonly accountId: Identifier;
  readonly currentState: SellerLifecycleState;
  readonly history: ReadonlyArray<{ readonly state: SellerLifecycleState; readonly at: ISO8601; readonly reason?: string; readonly actor: ActorReference }>;
}

export interface Seller {
  readonly sellerId: Identifier;
  readonly tenantId: TenantId;
  readonly organization: SellerOrganization;
  readonly account: SellerAccount;
  readonly profile: SellerProfile;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export type ConsignmentRole = 'consignor' | 'consignee';

export interface ConsignmentAgreement {
  readonly agreementId: Identifier;
  readonly organizationId: Identifier;
  readonly tenantId: TenantId;
  readonly consignorOrgId: Identifier;
  readonly consigneeOrgId: Identifier;
  readonly commissionSplitPercent: number;
  readonly minimumSalePrice?: Money;
  readonly returnDate?: ISO8601;
  readonly approvalPolicy: 'auto' | 'manual';
  readonly signedAt: ISO8601;
}
