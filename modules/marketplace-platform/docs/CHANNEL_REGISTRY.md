# Channel Registry

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

The channel registry contains manifests for PrimeOpp Marketplace plus 17 test-only external marketplace adapters.

## Manifest Fields

- channelId, name, version
- supportedRegions, supportedCategories
- authenticationRequirements
- listingCapabilities, offerCapabilities, messagingCapabilities, orderCapabilities
- shippingCapabilities, returnCapabilities, inventorySyncCapabilities, priceSyncCapabilities
- mediaRequirements, identifierRequirements
- feeScheduleRef, rateLimits
- browserRequirement, apiAvailability, importExportSupport
- termsRestrictions, healthState, verificationSupport
- executionMethods (api/feed/import_export/browser/human_assisted)
- testOnly flag
