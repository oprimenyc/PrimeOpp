// channelAdapter.ts — the internal contract every external-channel adapter
// implements.
//
// Capabilities are EXPOSED, not assumed: an adapter declares exactly which
// operations it actually implements (`capabilities`), and every optional
// method on the interface is genuinely optional. Callers must check
// `capabilities` before invoking a method rather than assuming every channel
// behaves like eBay. A channel that only supports drafts/exports (the
// existing low-liability workspace channels) or only supplies market pricing
// data has no adapter here at all -- this contract is only for channels with
// a real, documented, callable listing API.

export type ChannelCapabilityKey =
  | "connect" // has a documented OAuth/auth flow this app can drive
  | "createListing"
  | "updateListing"
  | "endListing"
  | "retrieveListing"
  | "syncStatus";

export type ChannelCapabilities = Record<ChannelCapabilityKey, boolean>;

export type PreflightIssue = {
  field: string;
  code: string;
  message: string;
};

export type PreflightResult = {
  canPublish: boolean;
  issues: PreflightIssue[];
};

// The subset of canonical_listing_packages a mapping/preflight layer needs.
// Deliberately mirrors the DB row shape (snake_case) rather than the API's
// camelCase view -- adapters read directly off query results.
export type CanonicalListingPackageRow = {
  id: number | string;
  product_id: number | string | null;
  source_identifier: string;
  identifier_type: string;
  title: string;
  description: string;
  images: unknown;
  category: string;
  condition: string;
  size_variant: string | null;
  cost_basis: string | number | null;
  target_price: string | number | null;
  shipping_profile: string | null;
};

export type ChannelListingDraftRow = {
  id: number | string;
  channel_payload: Record<string, unknown>;
  external_listing_id?: string | null;
  external_offer_id?: string | null;
};

export type ChannelPublishInput = {
  listingPackage: CanonicalListingPackageRow;
  draft: ChannelListingDraftRow;
  // Decrypted just-in-time by the caller, held only for the duration of the
  // provider call, never logged, never persisted, never included in any
  // returned `raw` field.
  accessToken: string;
  idempotencyKey: string;
};

export type ChannelPublishResult = {
  status: "LIVE" | "SUBMITTING" | "FAILED";
  externalListingId: string | null;
  externalOfferId: string | null;
  externalStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  // Adapter-specific response detail for operator visibility/audit. Adapters
  // MUST strip tokens/secrets before setting this -- it may be persisted and
  // displayed.
  raw?: Record<string, unknown>;
};

export type ChannelEndInput = {
  externalListingId: string;
  externalOfferId: string | null;
  accessToken: string;
  idempotencyKey: string;
};

export type ChannelRetrieveInput = {
  externalListingId: string;
  externalOfferId: string | null;
  accessToken: string;
};

export type ChannelRetrieveResult = {
  found: boolean;
  externalStatus: string | null;
  raw?: Record<string, unknown>;
};

export interface ChannelAdapter {
  readonly key: string;
  readonly label: string;
  readonly capabilities: ChannelCapabilities;
  readonly requiredEnv: string[];
  isConfigured(): boolean;
  // Pure, synchronous, no network call -- must be safe to run before any
  // credential or connection exists, so the operator always sees exactly
  // what's missing without side effects.
  preflight(input: { listingPackage: CanonicalListingPackageRow; draft: { channel_payload: Record<string, unknown> } }): PreflightResult;
  createListing?(input: ChannelPublishInput): Promise<ChannelPublishResult>;
  updateListing?(input: ChannelPublishInput): Promise<ChannelPublishResult>;
  endListing?(input: ChannelEndInput): Promise<ChannelPublishResult>;
  retrieveListing?(input: ChannelRetrieveInput): Promise<ChannelRetrieveResult>;
}
