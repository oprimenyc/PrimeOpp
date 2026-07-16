# Migration Guide

## From 0.x to 1.0.0

This is the initial 1.0.0 release. There is no prior version to migrate from.

## Future Migrations

Future major versions will provide migration guides in this file. The package follows SemVer:

- **Patch** (1.0.x): bug fixes, no breaking changes
- **Minor** (1.x.0): new features, no breaking changes
- **Major** (x.0.0): breaking changes; migration guide required

## Breaking Change Policy

The following are considered breaking changes:

- Removing or renaming a public type
- Removing or renaming a public function
- Changing a function signature (positional args)
- Removing a CLI command
- Changing CLI exit codes
- Removing a barcode format
- Removing a canonical condition
- Removing a terminal state
- Changing the default value of `alsoListOnPrimeOppMarketplace`

The following are NOT breaking changes:

- Adding a new optional field to an existing type
- Adding a new function
- Adding a new CLI command
- Adding a new barcode format
- Adding a new canonical condition
- Adding a new terminal state
- Adding a new commerce event type
- Adding a new adapter capability
