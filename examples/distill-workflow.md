# Workflow: monthly memory distillation

Once a month (or whenever Claude annoys you twice with the same mistake):

```bash
# 1. See what you keep repeating
teach2claude distill

# 2. Let Claude draft the rules from its own corrections
teach2claude distill --prompt | claude -p > suggested-rules.md

# 3. Review, then paste the keepers into CLAUDE.md
cat suggested-rules.md
```

Scope it to one project:

```bash
teach2claude distill --project myapp --prompt | claude -p
```

Tip: after adopting rules, run `teach2claude context` — if your CLAUDE.md crossed
~2k tokens, move niche rules into a skill so you only pay for them on demand.

## Recovering lost knowledge

"We solved this before" moments:

```bash
teach2claude search "ECONNRESET" --since 90d        # find the session
teach2claude show 3f2a91bc                          # reread the fix
teach2claude search "DROP TABLE" --role assistant   # audit what Claude actually ran
```
