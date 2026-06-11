# Command reference

Global options (every command):

| Flag | Effect |
|---|---|
| `--json` | machine-readable output, colors off |
| `--claude-dir <path>` | Claude data dir (default `~/.claude` or `$CLAUDE_CONFIG_DIR`) |
| `--no-color` | disable ANSI colors (also honors `NO_COLOR`) |

`--since` accepts `30d`, `12h`, or any parseable date (`2026-05-01`).

---

## `ccdistill context`

Static audit of everything injected into context at session start: baseline system prompt and built-in tools, CLAUDE.md files (cwd → root + user), auto-memory index, skills index, MCP servers.

Runs against the current working directory. No flags beyond globals.

JSON shape:

```json
{
  "cwd": "...", "claudeDir": "...",
  "items": [{ "source": "User CLAUDE.md", "tokens": 2840, "kind": "memory", "detail": "..." }],
  "total": 24930, "window": 200000, "pct": 0.12,
  "recommendations": ["..."]
}
```

Token numbers are estimates (~4 chars/token, ±20%). Baseline figures track recent Claude Code releases and drift with versions. MCP entries use a flat per-server estimate because tool schemas are only knowable by launching the server (planned: `--probe`).

## `ccdistill distill`

Mines user messages across all transcripts for correction/rule signals (English + French patterns), groups repeats, and prints candidates plus a suggested CLAUDE.md block.

| Flag | Default | |
|---|---|---|
| `--limit, -n` | 15 | max candidate groups |
| `--project, -p` | — | substring filter on project |
| `--prompt` | — | print a refinement prompt for `\| claude -p` instead of the report |

Heuristics, by design: short imperative messages need signal weight ≥ 3; long messages (>150 chars) need ≥ 5 since they are usually task specs, not rules. Only candidates ≤ 160 chars enter the suggested block. Always review before adopting.

## `ccdistill search <query>`

Full-text search over every transcript. Matches user/assistant text **and tool inputs** (the first 400 chars of each `tool_use` input), so commands and file paths are findable.

| Flag | Default | |
|---|---|---|
| `--regex, -r` | off | treat query as a case-insensitive regex |
| `--role` | both | `user` or `assistant` |
| `--project, -p` | — | substring filter on project folder name |
| `--since, -s` | — | time filter (file mtime prefilter + entry timestamps) |
| `--limit, -n` | 25 | max results, newest first |

Performance: the raw JSONL line is substring/regex-tested *before* JSON parsing, so non-matching lines cost one string scan.

## `ccdistill stats`

Whole-history aggregates: sessions, projects, message counts, top tools, per-model token usage (input/output/cache read/cache write) with cost estimates, 14-day activity sparkline.

Flags: `--project`, `--since`.

Token counts come from the `usage` fields Claude Code records per assistant message; streamed rewrites of a message are deduplicated by `message.id` (last occurrence wins, matching how usage accumulates). Unknown models are listed but excluded from the total with an explicit note.

## `ccdistill sessions`

Recent sessions, newest first: timestamp, project, duration, message count, tool calls, estimated cost, id, last summary.

Flags: `--project`, `--since`, `--limit` (default 20).

## `ccdistill show <id-prefix>`

Pretty-prints one transcript: user/assistant turns, tool calls (`→ Bash {...}`), truncated tool results (`↳ …`), summaries. Accepts any unambiguous session-id prefix (the 8-char ids printed by `search` and `sessions` work).
