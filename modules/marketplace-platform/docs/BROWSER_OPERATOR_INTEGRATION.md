# Browser Operator Integration

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Status

Future integration — NOT implemented.

## Stable Seams

packages/adapter-sdk/src/index.ts exports BrowserOperatorAdapter interface. Channels with browserRequirement=true (test-facebook-marketplace, test-craigslist, etc.) generate browser-assisted publication outcomes.

## Rule

Never conceal when browser automation is required. Channels that need browser automation declare it in their manifest.
