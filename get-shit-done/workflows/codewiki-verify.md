<purpose>
Verify CodeWiki maintenance tasks, evidence, blocked queues, and out-of-scope review queues after an update.

This workflow is read-only. It should run after `gsd-codewiki-maintainer` has processed `maintenance-plan.json` task items and before treating a CodeWiki namespace or set as ready for freeze, milestone close, or downstream planning.
</purpose>

<process>

## Step 1: Run SDK verification

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.verify $ARGUMENTS
```

For the pre-promotion gate inside `/gsd-codewiki-update`, pass `--maintenance-only`:

```bash
gsd-sdk query codewiki.verify $ARGUMENTS --maintenance-only
```

Default verification checks freshness, baseline completeness, and task records for freeze, milestone close, and downstream planning gates. `--maintenance-only` checks task records without requiring manifests, set tuples, or baseline completion.

Use the JSON result as the authoritative verification payload when available. It checks:

- selected CodeWiki freshness state
- baseline completeness for starter/bootstrap queues
- per-repo `coder-llm-wiki/00-meta/maintenance-plan.json`
- completed task records in `coder-llm-wiki/00-meta/progress.json`
- blocked and out-of-scope task records in `coder-llm-wiki/00-meta/task-queue.json`
- source evidence paths for completed tasks
- updated wiki files for completed tasks
- cross-repo evidence for set-level contract and flow tasks

If the SDK query is unavailable, continue with the fallback manual inspection below.

## Step 2: Read task files

For each selected repo wiki, read:

- `coder-llm-wiki/00-meta/maintenance-plan.json`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`

For a set, also read:

- `code-wiki/sets/<set-id>/wiki-set.yaml`
- relevant `cross-repo/contracts/`
- relevant `cross-repo/flows/`

## Step 3: Check task resolution

For every `maintenance-plan.json` `tasks[]` item:

- `completed`: must appear in `progress.json` with `task_id`, `target_path`, `evidence_paths`, and `updated_files`
- `blocked`: must appear in `task-queue.json` with `task_id`, `target_path`, `source_files`, and `reason`
- `out-of-scope`: must appear in `task-queue.json` with `task_id`, `status: out-of-scope`, `target_path`, and `reason`; it stays visible for review but does not fail verification
- `unresolved`: fails verification
- conflicting resolution records, such as `completed` and `blocked` at the same time, fail verification

Completed tasks must not use DeepWiki or Repomix as final evidence. Seed sources can explain navigation only.

## Step 4: Check evidence

For completed tasks:

- evidence paths must resolve to source files, config files, tests, scripts, or task diff paths
- updated files must exist
- set-level contract or flow tasks must cite evidence from at least two member repos when the set has multiple members
- source-backed gaps must become blocked tasks, not silent omissions

## Step 5: Check baseline completeness

For default verification, confirm the selected repo wiki is more than an init-only scaffold:

- starter or bootstrap tasks in `task-queue.json` must not remain `pending`, `review-needed`, `in-progress`, or `blocked`
- core baseline phases in `progress.json.phases` must be completed, skipped, not-applicable, or out-of-scope
- if baseline work is still pending, recommend `/gsd-codewiki-bootstrap` or `/gsd-codewiki-enrich` before freeze or milestone close

`--maintenance-only` intentionally skips this freshness and baseline gate because it is only the pre-promotion task check inside update.

## Step 6: Output

Use this structure:

```text
GSD > CODEWIKI VERIFY

Verified: yes|no
State: <state>
Set: <set-id or none>

Tasks:
  - total: <n>
  - completed: <n>
  - blocked: <n>
  - out_of_scope: <n>
  - unresolved: <n>
  - invalid: <n>

Failures:
  - <repo-id> <task-id>: <issue>

Recommended next action:
  <action>
```

Do not write files.

</process>
