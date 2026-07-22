# PrimeOpp Railway Project Setup — Phase 2

PROJECT NAME: `primeopp`
PROJECT ID: `a345cd30-a8ce-4a82-8e8e-5acba6bd33ca`

SERVICE NAME: `primeopp`
SERVICE ID: `6383832e-4d7f-421e-ad28-bb12c4d6f62a`

ENVIRONMENT: `production`
ENVIRONMENT ID: `021163a5-35da-415e-83c6-522dbe80e0c6`

POSTGRES PRESENT: YES
- Service name: `Postgres`
- Service ID: `958f29d8-e998-4fb0-b3f5-f7d2eb776536`
- Status at provision time: Online

DATABASE_URL WIRED: YES
- Set on the `primeopp` service as a Railway variable reference: `${{Postgres.DATABASE_URL}}`
- Not a literal value — resolves at deploy time from the Postgres service.

SECRETS PRINTED: NO
- All `railway variables` inspections in this session used `--kv` output piped through a key-only extraction (`grep -o "^[A-Z_]*"`) so only variable *names* were ever visible, never values.

## Actions Taken

1. Checked `railway list` / MCP `list-projects` — no existing `primeopp` project. Confirmed via both CLI and MCP before creating anything, per the no-duplicate-project rule.
2. Created project `primeopp` via MCP `create-project`.
3. Linked the repo directory to the new project/environment (`railway link -p <projectId> -e production`).
4. Created empty service `primeopp` via `railway add --service primeopp`.
5. Provisioned Railway Postgres via `railway add --database postgres`.
6. Linked local CLI service context to `primeopp` (`railway service primeopp`).
7. Set `DATABASE_URL` on the `primeopp` service to `${{Postgres.DATABASE_URL}}` via `railway variables --service primeopp --set ... --skip-deploys` (deploy skipped since the service isn't ready to deploy yet — no other required vars set).

## State at End of Phase 2

- `primeopp` service: created, offline (no deployment yet).
- `Postgres`: online, empty (no migrations run yet — Phase 5).
- No other variables set yet (Phase 3).
