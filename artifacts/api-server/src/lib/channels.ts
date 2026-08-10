export const CHANNEL_CONNECTION_STATUSES = [
  "NOT_CONNECTED",
  "AUTH_REQUIRED",
  "CONNECTED_MONITORING_ONLY",
  "CONNECTED_DRAFTS_ONLY",
  "PUBLISH_DISABLED",
  "ERROR",
] as const;

export const TOKEN_STORAGE_STATUSES = [
  "NOT_STORED",
  "ENCRYPTED",
  "EXTERNAL_SECRET_STORE",
  "NOT_IMPLEMENTED",
] as const;

export type ChannelDefinition = {
  key: string;
  label: string;
  category: "resale" | "craft" | "social" | "local" | "collectibles" | "apparel" | "custom";
  draftsAvailable: true;
  exportsAvailable: true;
  // Static, architectural truth: does this codebase contain a real adapter
  // capable of OAuth connect / listing publish for this channel at all.
  // Whether it's actually READY right now (credentials configured, account
  // connected, publish authorized) is a separate, live check -- see
  // routes/channels.ts, which overrides these two fields per-request using
  // the channel adapter registry rather than trusting this static default.
  oauthEnabled: boolean;
  publishEnabled: boolean;
  safetyMode: "seller_owned_account";
};

export const CHANNELS: ChannelDefinition[] = [
  { key: "general-resale", label: "General resale", category: "resale", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "craft-market", label: "Craft market", category: "craft", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "social-commerce", label: "Social commerce", category: "social", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "local-pickup", label: "Local pickup", category: "local", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "collectibles", label: "Collectibles", category: "collectibles", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "apparel-resale", label: "Apparel resale", category: "apparel", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  // Static defaults below -- routes/channels.ts overrides both flags live
  // from the eBay adapter's actual capabilities/configuration.
  { key: "ebay", label: "eBay", category: "resale", draftsAvailable: true, exportsAvailable: true, oauthEnabled: true, publishEnabled: false, safetyMode: "seller_owned_account" },
];

export function normalizeChannelKey(channel: string): string {
  return channel.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function channelExists(channel: string): boolean {
  const normalized = normalizeChannelKey(channel);
  return CHANNELS.some((item) => item.key === normalized);
}
