# Workflow: monthly memory distillation

Once a month (or whenever Claude annoys you twice with the same mistake):

```bash
# 1. See what you keep repeating
ccrecall distill

# 2. Let Claude draft the rules from its own corrections
ccrecall distill --prompt | claude -p > suggested-rules.md

# 3. Review, then paste the keepers into CLAUDE.md
cat suggested-rules.md
```

Scope it to one project:

```bash
ccrecall distill --project myapp --prompt | claude -p
```

Tip: after adopting rules, run `ccrecall context` — if your CLAUDE.md crossed
~2k tokens, move niche rules into a skill so you only pay for them on demand.

## Recovering lost knowledge

"We solved this before" moments:

```bash
ccrecall search "ECONNRESET" --since 90d        # find the session
ccrecall show 3f2a91bc                          # reread the fix
ccrecall search "DROP TABLE" --role assistant   # audit what Claude actually ran
```
