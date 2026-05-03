<purpose>
Update CodeWiki from source diffs after verified code changes.

This workflow updates one repo-level CodeWiki namespace or a multi-repo CodeWiki set. It is incremental by default and must not promote manifests without source-backed evidence.
</purpose>

<available_agent_types>
- gsd-codewiki-maintainer - Maintains version-aware CodeWiki namespaces and multi-repo CodeWiki sets from source diffs.
</available_agent_types>

<process>

## Step 1: Select wiki

Run the same selection logic as `codewiki-select`.

Read `.planning/config.json` when present and note `response_language`.

If `response_language` is set, all generated CodeWiki Markdown, review notes, progress summaries, task queue reasons, snapshots, and user-facing reports MUST be written in that language. Keep code, commands, file paths, config keys, package names, protocol names, service names, Git refs, and quoted source identifiers unchanged.

If no wiki exists, stop and recommend `/gsd-codewiki-init`.

If the selected manifest or set is frozen, stop and recommend creating a new namespace or set.

## Step 2: Resolve update range

Resolve one repo or all affected set members from:

- `--base <sha> --head <sha>`
- `--phase N`
- `--milestone VERSION`
- manifest commit to current `HEAD`

For a set, each affected repo must have its own base and head commit. If a repo did not change, keep its current tuple member unchanged.

## Step 3: Read CodeWiki state

For each affected member wiki, read:

- `coder-llm-wiki/README.md`
- `coder-llm-wiki/00-meta/workflow-contract.md`
- `coder-llm-wiki/00-meta/quality-gates.md`
- `coder-llm-wiki/00-meta/incremental-update-policy.md`
- `coder-llm-wiki/00-meta/maintenance-plan.json`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`
- latest snapshot
- optional seed sources:
  - `deepwiki-export/deepwiki.md`
  - `repomix-output.xml`, `repomix-output.md`, or files under `repomix/`

DeepWiki and Repomix seed sources are context only. They can help the maintainer find relevant modules, interfaces, and flows, but they are not final evidence and must not replace Git diff or source file citations.

For a set, read:

- `code-wiki/sets/<set-id>/wiki-set.yaml`
- existing `cross-repo/contracts/`
- existing `cross-repo/flows/`
- latest set snapshot

## Step 4: Read source diffs

For each affected repo:

```bash
git -C <repo> diff --name-status <base>..<head>
git -C <repo> diff <base>..<head>
```

Classify changes:

- `module-internal`
- `interface-change`
- `entrypoint-change`
- `flow-change`
- `config-change`
- `test-change`
- `rename-or-move`
- `deletion`

## Step 5: Prepare maintenance plan

Generate the mechanical maintainer handoff before any manifest, index, or set tuple promotion:

```bash
gsd-sdk query codewiki.update $ARGUMENTS --prepare-only
```

This prepare step writes or refreshes `coder-llm-wiki/00-meta/maintenance-plan.json` for each affected repo. The plan lists changed files, classifications, repo doc targets, set-level contract/flow candidates, task items, seed policy, and required evidence for `gsd-codewiki-maintainer`.

The prepare step MUST NOT update repo manifests, `code-wiki/wiki-index.yaml`, set tuples, or update snapshots. Treat its JSON output and `maintenance-plan.json` as the authoritative mechanical handoff.

## Step 6: Spawn maintainer

Spawn `gsd-codewiki-maintainer` with:

- selected repo manifests
- selected set manifest when present
- `response_language` from `.planning/config.json` when present
- per-repo diff ranges
- phase or milestone summary paths when present
- existing wiki state files
- discovered DeepWiki and Repomix seed source paths, if present
- `coder-llm-wiki/00-meta/maintenance-plan.json` from the SDK prepare output
- explicit instruction that DeepWiki and Repomix outputs are not final evidence

The maintainer updates impacted docs directly and returns a confirmation summary only.

The maintainer must process every `tasks[]` item as either completed, blocked, or out-of-scope. Completed tasks are recorded in `progress.json`; blocked and out-of-scope tasks remain in `task-queue.json` with the reason and missing or excluded evidence.

## Step 7: Quality checks

Before promoting manifests, verify:

- changed conclusions have source evidence
- evidence paths exist
- tests are referenced honestly or marked absent
- open questions are recorded
- `progress.json` and `task-queue.json` are updated when relevant
- cross-repo conclusions cite all relevant repos

When `progress.json` and `task-queue.json` have been updated, prefer the mechanical verification gate:

```bash
gsd-sdk query codewiki.verify $ARGUMENTS --maintenance-only
```

This pre-promotion check verifies maintenance task records only; it does not require the manifest or set tuple to be current yet. Treat `verified=false` as incomplete maintenance. Resolve invalid, unresolved, or blocked tasks before promotion, freeze, or milestone close unless the workflow explicitly accepts the remaining blocked queue.

## Step 8: Promote manifests

Promote repo manifests only after each repo update passes quality checks.

Prefer the SDK query layer for mechanical manifest, index, tuple, and snapshot promotion:

```bash
gsd-sdk query codewiki.update $ARGUMENTS --promote-only
```

Use this only after the maintainer has updated source-backed wiki docs and `codewiki.verify --maintenance-only` has passed. The SDK promotion step must reject promotion when an affected member's `maintenance-plan.json` is missing or verification still reports unresolved, blocked, or invalid tasks.

The SDK update records discovered seed sources in update snapshots and JSON output as seed-only metadata. Seed sources never advance freshness by themselves.

For a set:

- treat this as set tuple promotion, not just a file edit
- update `wiki-set.yaml` tuple only after all required member repo updates pass
- optional members may remain stale only if `required: false`
- if one required member fails, keep the previous compatible tuple and mark the set update incomplete

## Step 9: Write snapshots

Write:

- repo-level snapshots for affected repos
- set-level snapshot when a set is active
- `coder-llm-wiki/00-meta/maintenance-plan.json` for each affected repo

## Step 10: Report

Output:

```text
GSD > CODEWIKI UPDATE

Updated:
  - <wiki files>

Promoted:
  - <repo manifests>
  - <set manifest or not promoted>

Open Questions:
  - <questions or none>
```

</process>
