# Buyer Model

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

Supports guest browsing, registered, verified, business, enterprise, local pickup, and repeat buyers.

## Core Entities

- Buyer — top-level aggregate
- BuyerAccount — login account
- BuyerProfile — display info
- BuyerAddressReference / BuyerPaymentReference — secret references
- BuyerPreference — notification settings
- BuyerWatchlist / BuyerSavedSearch — discovery
- BuyerReputation / BuyerRiskProfile — trust
- BuyerLifecycle — state machine

## Secret Handling

Payment method tokens and addresses are NEVER stored inline. They are referenced via SecretReference.
