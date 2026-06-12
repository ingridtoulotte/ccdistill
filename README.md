<div align="center">

# Teach2Claude

**Claude learns from how you correct it.**

You've told Claude Code *"use pnpm, not npm"* five times this month. It's written down in your session logs — Claude just never reads them back.
Teach2Claude mines those logs, finds the corrections you keep repeating, and turns them into permanent CLAUDE.md rules.

Zero dependencies · 100% local · no API keys · no cloud

[![CI](https://github.com/ingridtoulotte/Teach2Claude/actions/workflows/ci.yml/badge.svg)](https://github.com/ingridtoulotte/Teach2Claude/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
![deps](https://img.shields.io/badge/dependencies-0-success)

<img src="assets/demo.svg" alt="teach2claude demo" width="720">

</div>

---

## Why this exists

Claude Code logs every session to `~/.claude/projects/*.jsonl` — every correction you gave, every preference you stated, every "no, do it this way." Then it starts the next session knowing none of it.

So you live this loop:

- *"Use pnpm, not npm."* — said it Monday. Saying it again Thursday.
- *"Stop adding comments I didn't ask for."* — third time this week.
- *"Run the tests before committing."* — you could tattoo this on the terminal.

The fix Claude offers is CLAUDE.md: a rules file it actually reads every session. But you have to remember what to put in it — and the rules you most need are exactly the ones you're too busy repeating to write down.

**If you've corrected Claude twice for the same thing, that rule already exists in your history. Teach2Claude finds it.**

## What it does

- Scans your local Claude Code history (`~/.claude/projects/*.jsonl`)
- Detects corrections you've given more than once (English and French)
- Ranks them by repetition count and recency
- Drafts them as a ready-to-paste CLAUDE.md block
- Optionally pipes the draft through Claude itself for polish — no API key, just `| claude -p`
- Also ships: context startup-tax audit, full-text history search, usage/cost stats
- Reads your disk, writes your terminal. Zero network calls.

## How it works

```
~/.claude history  →  detect repeated corrections  →  extract stable rules  →  CLAUDE.md  →  Claude stops forgetting
```

1. **Scan** — streams every session transcript on your machine.
2. **Detect** — pattern-matches user messages that are corrections, prohibitions, or preferences.
3. **Group** — normalizes and dedupes, so "use pnpm not npm" and "pnpm, not npm!" count as one rule said twice.
4. **Extract** — anything repeated enough becomes a drafted rule, sorted by how often you've had to say it.
5. **Reuse** — paste the block into CLAUDE.md. Claude reads it at the start of every future session.

## Before → After

**Before — every single session:**

```text
> use pnpm, not npm
> don't add comments unless I ask
> run the tests before committing
```

**After — run once:**

```bash
$ teach2claude distill

DISTILL — recurring corrections you keep giving Claude

 5×  use pnpm, not npm                                preference  2026-06-09
 3×  always run the tests before committing           rule        2026-06-08
 2×  don't add comments unless I ask                  prohibition 2026-06-02

Suggested CLAUDE.md block (review before adopting):
- use pnpm, not npm
- always run the tests before committing
- don't add comments unless I ask
```

Paste the block into CLAUDE.md. Done. Those three corrections never need typing again.

## Why it's different

- **Prompt hacks** — "always remember to…" pasted at the top of every session. Decays the moment you forget to paste it.
- **Hand-written memory files** — you write rules from memory, which means you write the ones you *remember* needing, not the ones you actually repeat most.
- **AI wrapper apps** — your transcripts get uploaded somewhere, an API key gets involved, a subscription appears.

Teach2Claude is none of these. It's an **automatic learning layer for Claude Code**: the rules come from evidence — what you actually said, counted and dated — and the output goes into the one file Claude already reads.

| | Teach2Claude | prompt hacks | manual CLAUDE.md | wrappers |
|---|---|---|---|---|
| Finds rules automatically | ✓ | — | — | some |
| Evidence-based (counts real corrections) | ✓ | — | — | — |
| Persists across sessions | ✓ | — | ✓ | varies |
| Fully local, no keys | ✓ | ✓ | ✓ | — |
| Dependencies | **0** | — | — | many |

## Install

```bash
npm install -g github:ingridtoulotte/Teach2Claude
```

```bash
teach2claude distill                          # see what you keep repeating
teach2claude distill --prompt | claude -p     # let Claude itself polish the rules
```

Or zero-install: `npx github:ingridtoulotte/Teach2Claude distill`

No config. No API key. No telemetry. It reads `~/.claude` and prints answers.

## What changes after you install it

- You stop re-teaching Claude the same preference for the Nth time.
- Claude behaves consistently across sessions and across projects.
- Your CLAUDE.md grows from evidence, not from guesswork.
- Context stops bleeding: repeated mid-session corrections become one line Claude reads at startup.

## Also in the box

```bash
teach2claude context                    # audit tokens injected before your first message
teach2claude search "race condition"    # full-text search across every session, every project
teach2claude stats                      # usage, top tools, estimated cost across your history
teach2claude sessions --since 7d        # browse recent sessions; `show <id>` replays one
```

Every command takes `--json` — including a [CI guard](examples/ci-context-guard.yml) that fails a PR when context startup cost crosses a budget.

`teach2claude context` deserves a special mention: it statically audits everything injected into your window before you type a word (MCP schemas, CLAUDE.md files, memory indexes) — these routinely eat 20%+ of a 200k window before `hello`.

## Performance

Streaming JSONL parser with a raw-line prefilter before any `JSON.parse`:

```text
scan:   29.2 MB, 100,000 lines in 170 ms   (≈588,000 lines/s)
search: 100,000 lines in 48 ms             (≈2,000,000 lines/s)
```

Reproduce: `npm run bench`.

## Privacy

Read-only over your local `~/.claude` directory. **Zero network calls** — no telemetry, no update checks, no API requests. The `--prompt` flow only prints text; *you* choose to pipe it into `claude`.

## Docs

[Getting started](docs/getting-started.md) · [Command reference](docs/commands.md) · [Architecture](docs/architecture.md) · [FAQ](docs/faq.md) · [Roadmap](ROADMAP.md)

## Contributing

PRs welcome — the codebase is small, dependency-free Node and stays that way. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

---

<div align="center">

**If Teach2Claude saved you one "wait, I already told Claude this" moment — star the repo so others find it.** ⭐

</div>
