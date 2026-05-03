<purpose>
Freeze a CodeWiki namespace or a multi-repo CodeWiki set for a shipped version.

Frozen namespaces and sets represent shipped history. Normal incremental updates should not modify them.
</purpose>

<process>

## Step 1: Parse arguments

Required:

- `<version>`

Optional:

- `--set <set-id>`
- `--allow-unverified`

If version is missing, stop with usage:

```text
Usage: /gsd-codewiki-freeze <version> [--set <set-id>] [--allow-unverified]
```

## Step 2: Run status

Run the same status logic as `codewiki-status`.

If the selected namespace or set is stale, follow config policy:

- If `codewiki.require_fresh_before_milestone_close` is true, stop and require `/gsd-codewiki-update`.
- Otherwise require explicit acknowledgement before freezing stale state.

## Step 3: Verify maintenance tasks

Unless `--allow-unverified` is present, run:

```bash
gsd-sdk query codewiki.verify $ARGUMENTS
```

If `verified` is not true, stop and report the failed task IDs, unresolved tasks, invalid evidence paths, and blocked queue entries. Do not freeze an unverified namespace or set.

If `--allow-unverified` is present, record the acknowledgement in the freeze report and continue. This is an explicit release-risk override.

## Step 4: Run SDK freeze query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.freeze $ARGUMENTS --require-verified
```

If `--allow-unverified` was provided, include it in the SDK call:

```bash
gsd-sdk query codewiki.freeze $ARGUMENTS --require-verified --allow-unverified
```

Use the JSON result as the authoritative freeze report when the command is available. It writes freeze snapshots, freezes repo and set manifests, and updates `wiki-index.yaml`.

If the SDK query is unavailable, continue with the fallback manual freeze below.

## Step 5: Verify target version or tag

Check whether a matching Git tag exists for each required member repo.

If tags differ by repo, record the per-repo tag in the manifest or set snapshot.

## Step 6: Write final snapshots

Write final repo-level snapshots.

When a set is active, write final set-level snapshot with:

- final member tuple
- changed repos
- cross-repo contracts
- cross-repo flows
- open questions accepted at freeze

## Step 7: Freeze manifests

Set each affected repo manifest:

```yaml
status: frozen
frozen_at: "<timestamp>"
frozen_for_version: "<version>"
```

When a set is active, set `wiki-set.yaml`:

```yaml
status: frozen
frozen_at: "<timestamp>"
frozen_for_version: "<version>"
```

## Step 8: Update index

Update `code-wiki/wiki-index.yaml` so the namespace or set status is `frozen`.

## Step 9: Report

Output:

```text
GSD > CODEWIKI FREEZE

Frozen:
  - <repo manifests>
  - <set manifest if any>

Version:
  <version>
```

</process>
