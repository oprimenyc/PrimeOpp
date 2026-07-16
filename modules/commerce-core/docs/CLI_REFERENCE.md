# CLI Reference

The CLI lives in `packages/cli/src/index.ts`. Run via:

```bash
node packages/cli/src/index.ts <command> [args]
```

## Commands

| Command | Description |
|---|---|
| `products resolve <file>` | Resolve product identity from input JSON. |
| `products inspect <id>` | Inspect a product by ID. |
| `barcode validate <code>` | Validate a barcode. |
| `barcode resolve <code>` | Resolve a barcode to a product candidate. |
| `condition assess <file>` | Assess condition from JSON. |
| `pricing calculate <file>` | Calculate pricing from JSON. |
| `profit calculate <file>` | Calculate profit from JSON. |
| `opportunity score <file>` | Score opportunity from JSON. |
| `inventory create <file>` | Create inventory from JSON. |
| `inventory adjust <file>` | Adjust inventory from JSON. |
| `inventory reserve <file>` | Reserve inventory from JSON. |
| `inventory reconcile` | Reconcile inventory (placeholder; use SDK). |
| `listing create <file>` | Create a listing from JSON. |
| `listing validate <file>` | Validate a listing. |
| `channels list` | List registered channels. |
| `adapters check` | Run adapter conformance checks. |
| `config validate` | Validate tenant config. |
| `doctor` | Diagnose the install. |
| `demo` | Run the demo workflow. |
| `verify` | Run `npm run verify`. |

## Global Flags

- `--json` — Emit JSON output (where applicable).
- `--tenant <id>` — Tenant ID (default: `cli-default`).
- `--org <id>` — Organization ID.

## Exit Codes

- 0: success
- 1: validation / proof failure
- 2: usage error or missing input
