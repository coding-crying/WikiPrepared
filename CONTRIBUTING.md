# Contributing to WikiPrepared

Thanks for helping make offline knowledge easier to keep and use.

For larger changes, open an issue first so we can agree on the problem before you spend time on a solution. Small, focused fixes are welcome too.

## Working locally

Use Node.js 20 to match CI. Run `npm ci`, then `npm run dev`. See the [README](README.md) and [development notes](docs/DEVELOPMENT.md).

## Before opening a pull request

- Explain what changed and why. Link the issue if there is one.
- Run `npm run webpack:prod` and report its result.
- Exercise the affected flow and state your OS, app version, and what you actually tested.
- For UI changes, include a screenshot with personal information removed.
- Update user-facing documentation if behavior changes.
- Keep unrelated formatting and generated files out of the patch.

The test script currently has no tests and lint lacks a configuration. Do not report those checks as passing or bypass the failures to make CI green. Regression tests are especially welcome for download resume/cancel, verification, drive selection, and interrupted transfers.

## USB safety

Use a disposable test directory or a spare drive with no valuable data. Never run formatting or deletion checks against someone else's drive. Prefer isolated tests with mocked drive discovery before touching hardware.

For a transfer change, check failure and cancellation as well as success. State which platforms you tested; a successful Linux build does not verify Windows or macOS behavior.

## Reporting problems

Use the issue templates. Include reproducible steps and sanitized logs, not credentials, personal documents, or full filesystem inventories. Keep discussion patient and practical—we are here to make the product better.
