# PrimeOpp Marketplace Core

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

The PrimeOpp Marketplace adapter (adapters/primeopp-marketplace) is a functional local runtime, NOT a mock. It implements every MarketplaceChannelAdapter method.

## Capabilities

- Publish, update, pause, resume, end listings
- Search active listings
- Retrieve listing state
- Sync inventory + price
- Receive + respond to offers
- Send + receive messages
- Retrieve + acknowledge orders
- Calculate commission
- Verify listings + orders
- Generate evidence

## Persistence

In-memory store (InMemoryPrimeOppMarketplaceStore). Production deployments should swap in SQLite or PostgreSQL adapter implementing the same PrimeOppMarketplaceStore interface.
