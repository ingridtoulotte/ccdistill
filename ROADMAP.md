# Roadmap

## v0.1 — shipped (MVP)

- [x] `context` — static startup audit + recommendations
- [x] `distill` — correction mining (EN+FR) → CLAUDE.md draft + `--prompt | claude -p` refinement
- [x] `search` — cross-project full-text + regex, tool-input indexing, raw-line prefilter
- [x] `stats` — tools, models, tokens, cost, activity sparkline
- [x] `sessions` / `show` — list and replay transcripts
- [x] `--json` everywhere, zero dependencies, Windows/macOS/Linux CI

## v0.2 — measure, don't estimate

- [ ] `context --probe`: launch configured MCP servers, call `tools/list`, measure real schema cost per server/tool
- [ ] Calibrated token estimator per content type (prose / code / JSON)
- [ ] `context --watch`: track startup tax over time, diff against last run
- [ ] `distill --apply`: interactive picker that appends accepted rules to CLAUDE.md
- [ ] HTML report export (`stats --html > report.html`)

## v0.3 — recall at scale

- [ ] Incremental index (sqlite-free, append-only) for instant search over years of history
- [ ] Optional local semantic search (opt-in embedding model, still offline)
- [ ] TUI dashboard (`teach2claude ui`)
- [ ] Multi-agent transcript adapters (other CLI agents writing JSONL)

## v0.4 — team memory

- [ ] Shareable distilled rule packs (commit your team's learned rules, merge on pull)
- [ ] Project-level "memory health" score in CI
- [ ] Plugin API: custom signals for distill, custom audit sources

## v1.0

- [ ] Stable JSON schemas (semver-guaranteed) for all commands
- [ ] Monorepo split: `@teach2claude/core` (lib) + `teach2claude` (CLI) + `@teach2claude/ui`
- [ ] Docs site

Suggest or vote: open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md).
