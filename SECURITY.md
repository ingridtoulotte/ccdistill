# Security Policy

## Model

ccrecall is a local, read-only CLI:

- reads `~/.claude` (transcripts, configs) and project CLAUDE.md files
- writes nothing except stdout/stderr
- makes zero network calls — no telemetry, no update checks, no API requests
- has zero dependencies, so the supply-chain surface is this repository alone

The main asset it touches is your **session history**, which can contain secrets you pasted into conversations. ccrecall never transmits it, but be deliberate when *you* do: `search`/`show` output, and `distill --prompt | claude -p`, can surface transcript content — treat their output like the transcripts themselves.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting ("Security" tab → "Report a vulnerability") rather than a public issue. Expect an acknowledgement within 72 hours.

In scope, notably: anything causing ccrecall to write outside stdout, make network calls, execute transcript content, or follow symlinks/paths outside the configured data dir.

## Supported versions

The latest minor release receives fixes.
