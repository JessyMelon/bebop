<purpose>
Initialize a version-aware CodeWiki namespace for the current repo/ref or a multi-repo CodeWiki set.

This workflow creates the registry, repo manifests, set manifest when requested, starter wiki directories, and an initial snapshot. It does not run DeepWiki automatically.
</purpose>

<process>

## Step 1: Run SDK init query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.init $ARGUMENTS
```

Use the JSON result as the authoritative initialization report when the command is available. It creates missing registry, repo manifests, starter wiki directories, repo snapshots, and optional set manifests/snapshots.

If the SDK query is unavailable, continue with the fallback manual initialization below.

## Step 2: Parse arguments

Parse `$ARGUMENTS`:

- `--set <set-id>`: create or update a multi-repo CodeWiki set
- `--repos <paths>`: comma-separated member repo paths
- `--repo-id <id>`: override repo ID for the current repo

If `--repos` is omitted and `--set` is present, try to read member repos from `codewiki.member_repos`, `sub_repos`, `planning.sub_repos`, `WORKSPACE.md`, then child Git repos. If no workspace metadata exists, use the current Git repo as the only member and warn that the set has one member.

When explicit workspace metadata is present, compare the selected member repo list with child Git repos under the workspace. If a new child Git repo is not represented in the selected member list, report workspace repo drift before writing or updating the set.

## Step 3: Detect Git identity

For each member repo:

```bash
git -C <repo> rev-parse --show-toplevel
git -C <repo> rev-parse --abbrev-ref HEAD
git -C <repo> rev-parse HEAD
git -C <repo> status --short
```

If current directory is not a Git repo and no member repos are discoverable, stop:

```text
No Git repo found. Run this command inside a repo or pass --repos <paths>.
```

## Step 4: Create registry

Create `code-wiki/wiki-index.yaml` if missing.

The index must support:

- `repos:`
- `sets:`

## Step 5: Create repo namespace

For each member repo:

1. Create a stable repo ID.
2. Infer a conservative role from repo/package names, dependency markers, and framework config files. Supported roles are `frontend`, `backend`, `shared-library`, `service`, `worker`, and `docs`; default to `service` when signals are ambiguous.
3. Create a ref namespace directory.
4. Write `manifest.yaml` from `get-shit-done/templates/codewiki/repo-manifest.yaml`.
5. Create:

   ```text
   deepwiki-export/
   coder-llm-wiki/
   coder-llm-wiki/00-meta/
   coder-llm-wiki/01-inventory/
   coder-llm-wiki/02-index/
   coder-llm-wiki/03-modules/
   coder-llm-wiki/04-flows/
   coder-llm-wiki/08-evidence/
   coder-llm-wiki/09-review/
   coder-llm-wiki/10-snapshots/
   ```

6. If a `coder-llm-wiki` template exists in the workspace, copy or scaffold from it. Otherwise write minimal starter state files.
7. Record `dirty_at_last_update: true` when the member repo is dirty.

## Step 6: Create set manifest

When `--set` is present:

1. Create `code-wiki/sets/<set-id>/`.
2. Write `wiki-set.yaml` from `get-shit-done/templates/codewiki/wiki-set.yaml`.
3. Record each member repo ID, role, ref, commit, manifest path, and wiki path.
4. Create:

   ```text
   snapshots/
   cross-repo/contracts/
   cross-repo/flows/
   ```

## Step 7: Write initial snapshot

Write repo-level initial snapshots and, when a set exists, a set-level snapshot from `set-snapshot.md`.

## Step 8: Report

Output:

```text
GSD > CODEWIKI INIT

Created:
  - code-wiki/wiki-index.yaml
  - <repo manifest paths>
  - <set manifest path if any>

Next:
  /gsd-codewiki-status [--set <set-id>]
```

</process>
