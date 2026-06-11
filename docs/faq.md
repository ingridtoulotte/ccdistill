# FAQ

**Does teach2claude send my data anywhere?**
No. Zero network calls — no telemetry, no update checks, no API requests. It reads `~/.claude` and prints to stdout. Audit it: the codebase has no `fetch`, no `http`, no sockets.

**How accurate are the token numbers?**
Two kinds of numbers. *Usage stats* (`stats`, `sessions`) come from the exact `usage` fields Claude Code records per message — those are real. *Context audit* numbers are estimates (~4 chars/token, ±20%) because Anthropic's tokenizer isn't public. The audit says "est" everywhere for that reason.

**How accurate are the cost numbers?**
They apply public per-MTok pricing to the recorded token counts. If you're on a Pro/Max subscription, the figure is what that usage *would have cost* via API — useful as a value gauge, not a bill. Unknown models are excluded and flagged, never silently counted as $0.

**Why does `context` disagree with `/context`?**
`/context` measures the live session, including version-specific system prompt changes and the true MCP tool schemas. teach2claude estimates statically without burning a session. Expect agreement on the controllable parts (CLAUDE.md, memory) and drift on baselines and MCP. Trend and recommendations are the point, not the third significant digit.

**Are distill suggestions safe to paste directly?**
Review them first — they're heuristic. The point is surfacing what you keep repeating; phrasing durable rules is your call (or `teach2claude distill --prompt | claude -p` to have Claude draft them).

**Windows?**
Fully supported and developed on Windows. Paths, encodings (`D:\proj` → `D--proj`), and CRLF transcripts all handled. macOS and Linux equally — CI runs all three.

**Does it work with Claude Code forks / other agents that write JSONL?**
If they use the same transcript schema and directory layout, mostly yes — point `--claude-dir` at their data dir. First-class multi-agent support is on the roadmap.

**Why Node and not Rust/Go?**
The audience already has Node (Claude Code requires it), `npm i -g` is one step, and the streaming parser is already I/O-bound: 100k lines scan in ~170 ms. A rewrite would buy little beyond a smaller binary.

**My transcripts are huge. Will it choke?**
Everything streams line-by-line; memory use is bounded by the largest single line, not file size. Use `--since 30d` to skip old files entirely (mtime prefilter — they're never even opened).
