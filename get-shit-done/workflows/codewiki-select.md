<purpose>
Select the correct CodeWiki namespace or CodeWiki set for the current Git checkout.

This workflow is read-only. It reports whether the selected wiki is current, stale, dirty, missing, frozen, or whether a multi-repo set is current, partial, or stale.
</purpose>

<process>

## Step 1: Run SDK selection query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.select $ARGUMENTS
```

Use the JSON result as the authoritative selection payload when the command is available. It includes:

- `mode`: `repo` or `set`
- `state`: repo or set freshness state
- `members[]`: current commit, expected commit, manifest commit, dirty flag, and manifest/wiki paths
- `next_action`: recommended next command

If the SDK query is unavailable, continue with the fallback manual inspection below.

## Step 2: Parse arguments

Parse `$ARGUMENTS`:

- `--set <set-id>`: select a multi-repo CodeWiki set

If no `--set` is provided, check `.planning/config.json` for `codewiki.active_set`. If present, use it. Otherwise select the current repo namespace.

## Step 3: Read Git identity

For the current repo, run:

```bash
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --short
```

If not inside a Git repo and no set was requested, report `missing` and suggest `/gsd-codewiki-init`.

## Step 4: Locate index

Read `code-wiki/wiki-index.yaml` from the workspace root.

If missing:

```text
CodeWiki status: missing
Reason: code-wiki/wiki-index.yaml was not found.
Next: /gsd-codewiki-init
```

Stop.

## Step 5: Select repo namespace

When selecting a single repo:

1. Match by `source_repo` or current Git root.
2. Prefer exact `commit_sha`.
3. If no exact commit match exists, match the current `ref_name` and report `stale`.
4. Read the selected repo `manifest.yaml`.
5. Read `coder-llm-wiki/00-meta/status-dashboard.md` when present.

Repo exit states:

- `current`: manifest commit equals current commit and tree is clean.
- `dirty-current`: manifest commit equals current commit but tree is dirty.
- `stale`: manifest commit differs from current commit.
- `missing`: no matching wiki namespace.
- `frozen`: matching wiki is frozen.

## Step 6: Select set

When `--set <set-id>` or `codewiki.active_set` is present:

1. Read `code-wiki/sets/<set-id>/wiki-set.yaml`.
2. For each `members[]` entry, run Git identity checks in `source_repo`.
3. Read each member repo manifest.
4. Compare each member current commit with the set manifest `members[].commit_sha`.
5. Report per-member status.

Set exit states:

- `set-current`: every required member is current and clean.
- `set-partial`: at least one optional member is missing or stale, but required members are current.
- `set-stale`: at least one required member differs from the set tuple.
- `frozen`: the set manifest status is frozen.
- `missing`: the set manifest is missing.

## Step 7: Report

Output:

```text
GSD > CODEWIKI SELECT

Selection:
  mode: repo|set
  set: <set-id or none>
  state: <state>

Members:
  - repo_id: <repo>
    current: <sha>
    manifest: <sha>
    dirty: yes|no
    status: current|dirty-current|stale|missing|frozen

Recommended next action:
  <action>
```

Do not write files.

</process>
