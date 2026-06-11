# Getting started

## Prerequisites

- Node.js ≥ 18
- Claude Code installed and used at least once (teach2claude reads its local data)

## Install

```bash
npm install -g github:ingridtoulotte/Teach2Claude
```

Or without installing:

```bash
npx github:ingridtoulotte/Teach2Claude stats
```

Or from source:

```bash
git clone https://github.com/ingridtoulotte/Teach2Claude && cd teach2claude
node src/cli.js --help     # zero dependencies — no npm install step needed
```

## First five minutes

**1. See what your sessions cost you before you type:**

```bash
teach2claude context
```

Run it from a project directory — it picks up that project's CLAUDE.md, `.mcp.json` and auto-memory. Anything flagged in RECOMMENDATIONS is paid on *every* session start.

**2. Find what you keep repeating:**

```bash
teach2claude distill
```

Review the suggested block, paste the good rules into your CLAUDE.md. For higher-quality phrasing, let Claude refine its own homework:

```bash
teach2claude distill --prompt | claude -p
```

**3. Search your history:**

```bash
teach2claude search "that bug you remember vaguely" --since 60d
teach2claude show <session-id-from-results>
```

**4. Check the damage:**

```bash
teach2claude stats
```

## Where the data comes from

| Data | Location |
|---|---|
| Session transcripts | `~/.claude/projects/<encoded-cwd>/*.jsonl` |
| User memory | `~/.claude/CLAUDE.md` |
| Project memory | `CLAUDE.md`, `CLAUDE.local.md` (cwd and ancestors) |
| Auto-memory index | `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` |
| Skills | `~/.claude/skills/*/SKILL.md`, `.claude/skills/` |
| MCP servers | `.mcp.json`, `~/.claude.json` |

Non-default install? Point at it with `--claude-dir <path>` or `CLAUDE_CONFIG_DIR`.

## Custom model pricing

Cost estimates use public per-MTok pricing for Opus/Sonnet/Haiku. Unknown models show `n/a` (never silently $0). Override or extend in `~/.teach2claude.json`:

```json
{
  "pricing": [
    { "match": "fable", "label": "Fable", "input": 25, "output": 100, "cacheRead": 2.5, "cacheWrite": 31.25 }
  ]
}
```
