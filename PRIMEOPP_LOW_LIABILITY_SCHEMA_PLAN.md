# PrimeOpp Low-Liability Schema Plan

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Decision

Existing schema was not sufficient for the corrected MVP.

Before this pass, the live schema supported storefront products, ecommerce orders, notifications, admin security, revenue features, reviews, discounts, abandoned carts, and contact messages. It did not have durable canonical listing packages, channel drafts, account connection shells, or listing export packages.

This pass adds one safe non-destructive migration:

`lib/db/migrations/0008_low_liability_listing_workspace.sql`

The migration only creates new tables and indexes with `IF NOT EXISTS`. It does not drop, rewrite, truncate, or backfill existing production data.

## Tables

### `canonical_listing_packages`

Purpose:

Local source of truth for a listing package.

Key fields:

- `product_id` nullable reference to existing `products`
- `source_identifier`
- `identifier_type`
- `intake_source`: `SCAN / SEARCH / MANUAL_FALLBACK`
- `title`
- `description`
- `images` JSONB
- `category`
- `condition`
- `size_variant`
- `cost_basis`
- `target_price`
- `margin`
- `shipping_profile`
- `status`: `DRAFT / READY / APPROVAL_REQUIRED / EXPORTED / DISABLED / FAILED`

Default status:

`APPROVAL_REQUIRED`

### `channel_listing_drafts`

Purpose:

Local channel-specific draft payloads generated from one canonical listing package.

Key fields:

- `canonical_listing_id`
- `channel`
- `account_connection_id` nullable
- `channel_status`: `DRAFT / READY / APPROVAL_REQUIRED / EXPORTED / DISABLED / FAILED`
- `channel_payload` JSONB
- `last_validation_error`
- `publish_disabled_reason`

Default status:

`APPROVAL_REQUIRED`

Direct external publish:

Disabled by route/service behavior.

### `marketplace_account_connections`

Purpose:

Local shell for future connected account state without collecting live credentials in this pass.

Key fields:

- `owner_scope`
- `channel`
- `connection_status`: `NOT_CONNECTED / MONITORING_ONLY / AUTH_REQUIRED / PUBLISH_DISABLED`
- `monitoring_only`
- `publish_authorized`
- `credential_reference`
- `credential_plaintext_guard`

Defaults:

- `monitoring_only = TRUE`
- `publish_authorized = FALSE`
- `connection_status = NOT_CONNECTED`

Credential rule:

No credential values are stored in plaintext. `credential_reference` is reserved for a future vault/reference key, not a secret value. `credential_plaintext_guard` is constrained to `FALSE`.

### `listing_export_packages`

Purpose:

Local copy/export output generated from a channel draft.

Key fields:

- `canonical_listing_id`
- `channel`
- `export_format`: `COPY_FIELDS / CSV / JSON / API_DRAFT_DISABLED`
- `export_payload` JSONB
- `created_at`

V1 generated format:

`JSON`

CSV remains schema-supported for a future UI/export iteration.

## Runtime Rules

- No destructive migrations.
- No provider credentials stored in plaintext.
- No live publish enabled.
- `publish_authorized` defaults false.
- `monitoring_only` defaults true.
- External provider mode is returned as `DISABLED` in generated exports.
- Package and draft statuses default to approval-required, not fake published.

## Deployment Note

The new API route depends on `0008_low_liability_listing_workspace.sql` being applied to the target database before live package creation. The migration runner is idempotent and already tracks applied filenames in `schema_migrations`; production use still requires explicit safe invocation and must not print `DATABASE_URL`.
