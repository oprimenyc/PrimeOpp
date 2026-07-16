# Migration Guide

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## From Prototype

If migrating from a prototype PrimeOpp codebase: 1) Audit existing listings for state-machine compatibility; 2) Map existing seller/buyer models to canonical contracts; 3) Register existing channel adapters via adapter-sdk; 4) Run npm run verify.

## Versioning

All contracts are versioned. Commission policies are versioned. Listing state transitions are deterministic and backward-compatible.
