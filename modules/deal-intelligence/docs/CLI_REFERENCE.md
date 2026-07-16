# CLI Reference

```bash
primeopp-deals retailers list
primeopp-deals retailers inspect <slug>
primeopp-deals source ingest <file>
primeopp-deals offer normalize <file>
primeopp-deals coupon validate <file>
primeopp-deals history inspect <product>
primeopp-deals availability check <file>
primeopp-deals score <file>
primeopp-deals resale score <file>
primeopp-deals validate <file>
primeopp-deals publish dry-run <file>
primeopp-deals alerts simulate <file>
primeopp-deals community submit <file>
primeopp-deals community moderate <id>
primeopp-deals recheck <deal-id>
primeopp-deals expire <deal-id>
primeopp-deals amos create-job <deal-id>
primeopp-deals config validate
primeopp-deals adapters check
primeopp-deals doctor
primeopp-deals demo
primeopp-deals verify
```

Options: `--json` for JSON output, `--help`/`-h` for usage. Stable exit
codes: 0 success, 1 runtime error, 2 invalid arguments.
