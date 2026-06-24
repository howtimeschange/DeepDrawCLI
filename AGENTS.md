# DeepDraw CLI Agent Guide

This repo provides the `deepdraw` CLI for DeepDraw OpenAPI calls.

Agent rules:

1. Read `docs/reference/deepdraw-openapi.md` before adding or changing API behavior.
2. Every `dp.*` API in the reference must be present in `src/core/api-registry.ts`.
3. Use `deepdraw call <api-name>` for generic API access.
4. Use semantic commands only as wrappers around registered APIs.
5. For write, paid, or caution generic calls, use `deepdraw call <api-name> --execute --plan` first.
6. Do not execute write, paid, or caution APIs unless the user explicitly authorizes `--execute --yes`.
7. If a command returns `error.kind = "approval_required"`, ask the user before continuing.
8. Never write real `appSecret`, `dopKey`, signatures, or tenant credential JSON into tracked files.
9. Prefer fake credential stores and mocked fetch/Java runners in tests.

Useful commands:

```bash
npm test
npm run lint
npm run build
deepdraw auth login --stdin-json < credentials.json
deepdraw config doctor --dry-run
deepdraw call dp.colors.get --dry-run
deepdraw call dp.product.search --execute --plan --param merchantId=MERCHANT_ID
```
