# PrimeOpp — Replit Deployment Classification: Current Truth

## Repo / branch / HEAD

- **Repo path:** `C:\Users\jp718\Documents\GitHub\PrimeOpp`
- **Branch:** `integration/full-primeopp-platform`
- **Starting HEAD:** `6118b86548704194beaea50be490491aa361b927`
- **Working tree at start:** dirty, but only with pre-existing, unrelated files: `modules/commerce-core/evidence/PACKAGE_RESULTS.json`, `modules/commerce-core/evidence/RUNTIME_VERIFICATION.md`, `modules/commerce-core/evidence/TEST_RESULTS.json`. None of these were touched or staged by this mission.

## The classification rule

```text
REPLIT_CLASSIFICATION:
- Replit may appear only as historical/dev workspace provenance.
- Replit must not be recommended as production/staging hosting.
- Replit must not be emitted as a provider action target.
- Replit-origin projects must be migrated to approved deployment targets before launch.
- Approved deployment targets must be separately selected and proven.
```

## What was searched

`Replit`/`replit` (case-insensitive) across every `.md` file in the repo root. Eight files matched: `PRIMEOPP_DOMAIN_POD_PROOF.md`, `PRIMEOPP_DOMAIN_POD_NEXT_SESSION_HANDOFF.md`, `PRIMEOPP_DOMAIN_READINESS.md`, `PRIMEOPP_DOMAIN_POD_CURRENT_TRUTH.md`, `replit.md`, `README.md`, `AUDIT_PHASE2.md`, `AUDIT.md`. Per this mission's write boundary ("PrimeOpp docs/config/docs-only readiness artifacts") and Checkpoint 1's explicit scope ("search docs/readiness artifacts"), only the domain/POD readiness doc set was in scope for edits — `replit.md` (Replit's own project description file, source-adjacent config, already separately flagged in `PRIMEOPP_DOMAIN_POD_CURRENT_TRUTH.md` as stale/unreliable for auth behavior — not touched), `README.md`, `AUDIT.md`, and `AUDIT_PHASE2.md` were read but are outside the domain/POD readiness doc set and were left untouched.

## What was found

- **`PRIMEOPP_DOMAIN_READINESS.md`** — the "Deployment target" bullet accurately states `.replit` is the current host, and already correctly frames a domain attach as needing either Replit's own feature *or* "the app would need to be deployed to a different provider first." This was factually fine but had no explicit statement that Replit is not the recommended/approved path going forward — a classification addendum was added in place (see Proof doc), the underlying fact was not altered.
- **`PRIMEOPP_DOMAIN_POD_NEXT_SESSION_HANDOFF.md`** — one genuinely ambiguous line: "Attaching a custom domain in Replit (or wherever the app is ultimately deployed)" lists Replit first, as if it were the default/likely target rather than an open decision. Fixed (see Proof doc).
- **`PRIMEOPP_DOMAIN_POD_CURRENT_TRUTH.md`** and **`PRIMEOPP_DOMAIN_POD_PROOF.md`** — both describe Replit only as accurate current-state fact ("Deploy provider config: None beyond Replit," commands run confirming no provider was contacted) with no recommendation language. No changes needed or made.

## Unrelated dirty files preserved

The three `modules/commerce-core/evidence/*` files listed above were not touched, read for content, or staged.

## Remaining work for this mission

See `PRIMEOPP_REPLIT_CLASSIFICATION_PROOF.md`.
