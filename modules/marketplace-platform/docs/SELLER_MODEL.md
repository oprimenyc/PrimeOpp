# Seller Model

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

The seller model supports 12 seller types: individual reseller, sole proprietor, business, consignment seller, nonprofit, thrift store, pawn shop, retailer, liquidation company, estate-sale company, enterprise, white-label tenant.

## Core Entities

- Seller — top-level aggregate
- SellerOrganization — multi-tenant org
- SellerAccount — login account
- SellerChannelAccount — per-channel credentials
- SellerStorefront — public storefront
- SellerLocation / SellerWarehouse — physical locations
- SellerTeam / SellerUser / SellerRole / SellerPermission — RBAC
- SellerPolicy / SellerSubscription / SellerFeePlan — commercial
- SellerPayoutProfileReference / SellerTaxProfileReference — secret references
- SellerVerification / SellerRiskProfile / SellerReputation — trust
- ConsignmentAgreement — consignment contract

## Secret Handling

Payout and tax profile credentials are NEVER stored inline. They are referenced via SecretReference pointing at Prime Vault.

## Lifecycle

prospect → onboarding → active → (paused/suspended) → closed/terminated. All transitions validated.
