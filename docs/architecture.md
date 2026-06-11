# Architecture

## Design principles

1. **Zero runtime dependencies.** Everything is `node:` builtins. Installs are instant, supply-chain surface is nil, and the code outlives ecosystem churn.
2. **Local-only.** No network calls, ever. The single integration with an LLM (`distill --prompt`) works by printing text the *user* pipes into `claude -p`.
3. **Streaming first.** Transcripts can be hundreds of MB across months of use. Every reader is a line stream; nothing loads whole files except `show` (single session, bounded).
4. **Defensive parsing.** Transcript schemas drift across Claude Code versions and contain partial writes. Malformed lines are skipped, missing fields are tolerated, unknown models are surfaced as `n/a` instead of guessed.
5. **Estimates are labeled.** Token counts use a ~4 chars/token heuristic and say so. Costs derive from a pricing table the user can override. Nothing pretends to be exact.

## Module map

```
src/
├── cli.js                 entry point: arg parsing, dispatch, error surface
├── commands/              one file per command — rendering only, no parsing logic
│   ├── context.js         render auditContext()
│   ├── distill.js         render distill() / refinementPrompt()
│   ├── search.js          render searchTranscripts()
│   ├── stats.js           aggregate scanAll() + render
│   ├── sessions.js        scanAll() sorted/limited + render
│   └── show.js            single-transcript pretty printer
└── lib/                   pure logic, fully unit-tested, no console output
    ├── paths.js           ~/.claude discovery, cwd↔folder-name encoding
    ├── transcript.js      JSONL streaming, text extraction, session scanning
    ├── search.js          raw-line prefilter + match/snippet pipeline
    ├── distill.js         correction signals (EN+FR), grouping, prompt builder
    ├── audit.js           static context-startup audit + recommendations
    ├── tokens.js          token estimator, pricing table, cost math
    ├── format.js          ANSI, tables, bars, sparklines (no deps)
    ├── args.js            tiny flag parser
    └── index.js           programmatic API surface
```

Commands depend on lib; lib never depends on commands. `--json` output comes straight from lib data structures, which is what makes the CI-guard use case reliable.

## Key decisions

### Last-wins deduplication by `message.id`

Claude Code streams assistant output and may write the same message several times with cumulative `usage` and a growing block list. Both the scanner and the viewer collapse duplicates keeping the **last** occurrence — final usage and final tool-call list win. (The viewer buffers the session to preserve the original position of the first write.)

### Raw-line prefilter in search

`line.toLowerCase().includes(q)` before `JSON.parse(line)`. The overwhelming majority of lines don't match, so search runs at millions of lines/second; JSON costs are paid only on hits. Regex mode applies the same trick with `re.test(line)`.

### Static context audit (vs. proxies or live probes)

`/context` answers "what is my context *right now*" — but costs a session. Proxy-based tools answer it live but require routing API traffic. ccrecall's audit is pure filesystem: it reads the same files Claude Code will inject (CLAUDE.md chain, memory index, skills frontmatter, MCP configs) and estimates. That makes it scriptable, CI-able, and zero-risk. MCP server costs are flat estimates today; `--probe` (launch server, call `tools/list`, measure schemas) is the planned upgrade.

### Heuristic distill with an LLM escape hatch

Signal patterns (EN + FR) catch the high-precision core: prohibitions, "always/never" rules, corrections, preferences. Long messages need a stronger signal because they're usually task specs. The output is explicitly a *draft* — and `--prompt | claude -p` hands refinement to the best judge available without ccrecall ever touching an API key.

## Testing

`node --test`, no frameworks. Fixtures are synthetic transcripts exercising the nasty cases: streamed duplicate messages, tool_result carrier lines, garbage lines, French corrections, unknown models. CLI-level tests spawn the real binary and assert on `--json` output.
