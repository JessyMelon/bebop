<purpose>
Show CodeWiki health for the current workspace.

This workflow is read-only. It builds on codewiki-select and adds latest snapshots, blockers, open questions, and recommended next actions.
</purpose>

<process>

## Step 1: Run SDK status query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.status $ARGUMENTS
```

Use the JSON result as the authoritative status payload when the command is available. It includes the selected repo or set, member freshness, latest snapshots, open questions, status dashboard paths, `.planning/codebase/` freshness hints, and `recommended_next_action`.

If the SDK query is unavailable, continue with the fallback manual inspection below.

## Step 2: Run selection

Run the same selection logic as `codewiki-select` for `$ARGUMENTS`.

Required states:

- `current`
- `dirty-current`
- `stale`
- `missing`
- `frozen`
- `set-current`
- `set-partial`
- `set-stale`

## Step 3: Read status files

For each selected member wiki, read if present:

- `coder-llm-wiki/00-meta/status-dashboard.md`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`
- latest file under `coder-llm-wiki/10-snapshots/`
- `coder-llm-wiki/09-review/open-questions.md`
- `coder-llm-wiki/09-review/human-review.md`

For a set, also read:

- `code-wiki/sets/<set-id>/wiki-set.yaml`
- `code-wiki/sets/<set-id>/snapshots/`
- `code-wiki/sets/<set-id>/cross-repo/contracts/`
- `code-wiki/sets/<set-id>/cross-repo/flows/`

## Step 4: Summarize health

Report:

- selected namespace or set
- current commit and manifest commit per repo
- freshness state per repo and aggregate set state
- workspace repo drift across `.planning/config.json`, `code-wiki/wiki-index.yaml`, set members, and child Git repos
- latest snapshot per repo
- latest set snapshot when present
- active blockers
- open questions
- whether `.planning/codebase/` appears older than the selected wiki
- recommended next action

## Step 5: Output

Use this structure:

```text
GSD > CODEWIKI STATUS

State: <state>
Set: <set-id or none>

Repos:
  - <repo-id>: <state> current=<sha> manifest=<sha>

Snapshots:
  - <repo-id>: <path or none>
  - set: <path or none>

Open Questions:
  - <question or none>

Workspace Drift:
  - <drift warning or none>

Recommended next action:
  <action>
```

Do not write files.

</process>
