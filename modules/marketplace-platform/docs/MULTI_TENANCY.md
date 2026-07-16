# Multi-Tenancy

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Isolation Rules

- Sellers, buyers, inventory, listings
- Channel credentials, messages, offers, orders
- Payouts, fees, settlements, disputes
- Moderation, analytics, affiliate campaigns, enterprise data

## Tested

- Seller A cannot edit seller B listing
- Buyer A cannot access buyer B private data
- Tenant A cannot use tenant B marketplace credentials
- Tenant A cannot receive tenant B settlement
- One tenant cannot read another tenant's cost basis
- One organization cannot publish another organization's inventory
