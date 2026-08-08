-- Persists identity resolution confidence on sourcing_session_items and
-- distinguishes an automatic classification/match from a human-verified
-- manual correction. Additive only -- no drops, no data loss.
--
-- Previously, classifyProductIntake()'s confidence (HIGH/MEDIUM/LOW/
-- AMBIGUOUS) was computed at item-creation time and returned once in the
-- POST response, then discarded -- never stored on the item row, never
-- shown again. That made an AMBIGUOUS or low-confidence automatic match
-- look identical to a solid one in the Review Queue after the first
-- render, and gave the operator no persisted signal to act on.
--
-- 'MANUAL' is not a classifier confidence level -- it is a provenance
-- marker set only when an operator has personally verified/corrected the
-- identity via the identifier-mapping flow (POST /product-identifiers +
-- PATCH .../items/:itemId with matchedProductId). It intentionally reads
-- as a distinct, higher-trust state than any automatic classification.
ALTER TABLE sourcing_session_items ADD COLUMN IF NOT EXISTS identity_confidence TEXT;

ALTER TABLE sourcing_session_items
  ADD CONSTRAINT sourcing_session_items_identity_confidence_chk
  CHECK (identity_confidence IS NULL OR identity_confidence IN ('HIGH', 'MEDIUM', 'LOW', 'AMBIGUOUS', 'MANUAL'));
