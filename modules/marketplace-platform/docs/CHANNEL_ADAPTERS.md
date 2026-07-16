# Channel Adapters

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

All marketplace adapters implement the MarketplaceChannelAdapter interface from packages/adapter-sdk. Required methods include validateConfiguration, healthCheck, validateListing, transformListing, publishListing, updateListing, pauseListing, resumeListing, endListing, retrieveListing, retrieveListingStatus, syncInventory, syncPrice, retrieveOffers, respondToOffer, retrieveMessages, sendMessage, retrieveOrders, acknowledgeOrder, cancelOrder, retrieveReturns, retrieveFees, verifyListing, verifyOrder, shutdown.

## Test-Only Labeling

Every test-* adapter declares testOnly: true in its manifest AND limitations array entries stating "TEST-ONLY adapter — no live connectivity".
