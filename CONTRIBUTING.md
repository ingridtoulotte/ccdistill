# Contributing

Thanks for considering it. The bar for a great PR here is low friction, not low standards.

## Setup

```bash
git clone https://github.com/OWNER/ccrecall && cd ccrecall
node --test          # that's it — zero dependencies, nothing to install
```

Run the CLI from source: `node src/cli.js <command>`.

## Ground rules

- **Zero runtime dependencies is a hard constraint.** PRs adding one will be declined regardless of quality. Dev-time tooling is also kept at zero; `node --test` and `node:assert` cover us.
- **lib/ is pure, commands/ render.** Logic goes in `src/lib/` with unit tests; `src/commands/` only formats and prints.
- **Defensive parsing.** Transcript schemas drift. Never throw on malformed lines, never assume a field exists, never silently misreport (unknown model → `n/a`, not `$0`).
- **Estimates are labeled.** Anything heuristic says so in the output.
- **Windows is first-class.** Mind path separators and CRLF; CI runs win/mac/linux.

## Tests

- New logic → new tests in `test/`. Fixtures live in `test/fixtures/home/.claude/` as realistic JSONL.
- The fixture transcripts deliberately contain nasty cases (streamed duplicates, garbage lines, tool_result carriers). Extend them rather than creating sanitized ones.

## Pull requests

- Keep diffs focused; one concern per PR.
- `node --test` must pass.
- For behavior changes, paste before/after CLI output in the PR description.

## Good first issues

- New distill signal patterns for other languages (the EN/FR table in `src/lib/distill.js` is the template)
- Pricing table updates when Anthropic publishes new models
- Audit sources we're missing (hooks files, output styles, …)
