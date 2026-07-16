// Channel registry contracts.
import type { Identifier, ISO8601, Region, Capability } from './common.js';

export type ChannelExecutionMethod =
  | 'api'
  | 'feed'
  | 'import_export'
  | 'browser'
  | 'human_assisted';

export type ChannelHealthState =
  | 'healthy'
  | 'degraded'
  | 'outage'
  | 'maintenance'
  | 'unknown';

export interface ChannelFeeScheduleRef {
  readonly feeScheduleId: Identifier;
  readonly description: string;
}

export interface ChannelRateLimit {
  readonly requestsPerSecond?: number;
  readonly requestsPerDay?: number;
  readonly burst?: number;
}

export interface ChannelMediaRequirement {
  readonly minImages: number;
  readonly maxImages: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly acceptsVideo: boolean;
}

export interface ChannelIdentifierRequirement {
  readonly required: readonly string[];
  readonly supported: readonly string[];
}

export interface ChannelManifest {
  readonly channelId: string;
  readonly name: string;
  readonly version: string;
  readonly supportedRegions: readonly Region[];
  readonly supportedCategories: readonly string[];
  readonly authenticationRequirements: readonly string[];
  readonly listingCapabilities: readonly Capability[];
  readonly offerCapabilities: readonly Capability[];
  readonly messagingCapabilities: readonly Capability[];
  readonly orderCapabilities: readonly Capability[];
  readonly shippingCapabilities: readonly Capability[];
  readonly returnCapabilities: readonly Capability[];
  readonly inventorySyncCapabilities: readonly Capability[];
  readonly priceSyncCapabilities: readonly Capability[];
  readonly mediaRequirements: ChannelMediaRequirement;
  readonly identifierRequirements: ChannelIdentifierRequirement;
  readonly feeScheduleRef?: ChannelFeeScheduleRef;
  readonly rateLimits: ChannelRateLimit;
  readonly browserRequirement: boolean;
  readonly apiAvailability: boolean;
  readonly importExportSupport: boolean;
  readonly termsRestrictions: readonly string[];
  readonly healthState: ChannelHealthState;
  readonly verificationSupport: boolean;
  readonly executionMethods: readonly ChannelExecutionMethod[];
  readonly testOnly: boolean; // true for test-* adapters
  readonly releasedAt: ISO8601;
}

export interface ChannelRegistryEntry {
  readonly manifest: ChannelManifest;
  readonly adapterId: Identifier;
  readonly adapterVersion: string;
  readonly registeredAt: ISO8601;
}
