# Operations

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

This runs `npm run typecheck` (since the package uses Node's native TypeScript execution; there is no separate compile step).

## Verify

```bash
npm run verify
```

Runs the 24-point runtime proof. Exits non-zero if any proof fails.

## Test

```bash
npm test
```

## Lint

```bash
npm run lint
```

Checks for TODO / FIXME / placeholder / not-implemented / empty catch / `|| true` patterns.

## Demo

```bash
npm run demo
```

Runs a 6-step end-to-end demo: barcode validation, pricing, profit/ROI, opportunity, listing with PrimeOpp default ON, opt-out flow.

## Doctor

```bash
npm run doctor
```

Diagnoses the install: Node version, platform, registered adapters, registered channels.

## Package

```bash
npm run package
```

Creates `primeopp-commerce-core.zip` in `/home/z/my-project/download/`.

## Clean-Room Verify

```bash
npm run cleanroom
```

Extracts the ZIP into a fresh temp directory, runs `npm install` from the lockfile, and runs `npm run verify`.
