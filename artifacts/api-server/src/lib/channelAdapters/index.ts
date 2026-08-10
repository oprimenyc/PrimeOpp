import type { ChannelAdapter } from "../channelAdapter.js";
import { ebayAdapter } from "./ebayAdapter.js";

// Every channel with a real, documented, callable listing API is listed
// here. Channels that only support local drafts/exports (lib/channels.ts)
// or only supply market pricing data (lib/platformPricing.ts) have no entry
// -- there is nothing for this registry to call.
export const CHANNEL_ADAPTERS: ChannelAdapter[] = [ebayAdapter];

export function getChannelAdapter(key: string): ChannelAdapter | undefined {
  return CHANNEL_ADAPTERS.find((adapter) => adapter.key === key);
}
