# Security

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Overview

Security is enforced at multiple layers: tenant isolation, signature verification, idempotency, RBAC, secret references, evidence recording.

## Secrets

All credentials (channel credentials, payment tokens, payout profiles, tax profiles, identity refs) are represented as SecretReference pointing at Prime Vault. NEVER stored inline.

## Signature Verification

External order events use HMAC-SHA256 signatures. Constant-time comparison.

## Tenant Isolation

checkTenantAccess() in packages/tenant-config enforces tenant + organization boundaries.

## Reporting

See THREAT_MODEL.md, SELLER_PROTECTION.md, BUYER_PROTECTION.md for detailed threat models and protections.
