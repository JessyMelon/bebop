# Design: CodeWiki Lifecycle Management for Bebop

**Date:** 2026-04-29  
**Status:** Draft — design review needed  
**Target:** Bebop/GSD project lifecycle, codebase intelligence, and version-aware documentation

---

## Summary

Bebop already manages the software engineering lifecycle through `.planning/` artifacts: project definition, requirements, roadmap, phase plans, execution summaries, verification, milestone archives, and codebase maps.

This design adds a version-aware CodeWiki lifecycle to Bebop so that code understanding is maintained as part of the normal engineering process. When a requirement, phase, or milestone changes one or more codebases, Bebop should be able to update the corresponding long-running CodeWiki set from the real Git diffs, with source evidence and resumable snapshots.

The core idea:

```text
Bebop lifecycle
  requirements -> plan -> execute -> verify -> milestone

CodeWiki lifecycle
  select wiki set -> analyze repo diffs -> update affected docs -> review -> snapshot
```

CodeWiki is not a replacement for `.planning/codebase/`. It is the durable, version-bound knowledge base behind it. For multi-repo products, a CodeWiki is usually a set: each member repo has its own wiki namespace, and the set records the exact compatible commit tuple for the complete feature or release.

---

## Problem

Current Bebop codebase support is useful but short-lived:

- `/gsd-map-codebase` produces `.planning/codebase/` documents for the current working tree.
- The generated documents help future planning and execution.
- They are not naturally bound to `repo + ref + commit`.
- They are refreshed manually or wholesale.
- They do not provide a strict evidence and freshness model.
- After a feature is completed, there is no first-class step that updates long-term code knowledge.
- Many real features span multiple repositories, but current codebase mapping treats the current repo as the only knowledge boundary.

This means Bebop can successfully deliver code while its codebase understanding slowly diverges from the actual implementation.

---

## Goals

- Add first-class Bebop commands for CodeWiki selection, initialization, update, status, and freeze.
- Bind each CodeWiki namespace to a concrete Git identity: `repo_id + ref_type + ref_name + commit_sha`.
- Bind multi-repo features to a concrete compatible commit tuple through a CodeWiki set manifest.
- Update CodeWiki after verified code changes using `git diff`, not free-form summaries.
- Support updates where one requirement, phase, or milestone touches multiple repos.
- Keep facts, inferences, evidence, and open questions separate.
- Reuse `coder-llm-wiki` style structure for durable module, flow, evidence, review, and snapshot documents.
- Let `.planning/codebase/` act as a short-term projection of CodeWiki when useful.
- Integrate with existing Bebop lifecycle checkpoints without making every commit expensive.
- Preserve current Bebop behavior when CodeWiki is disabled.

---

## Non-Goals

- Do not make DeepWiki, Repomix, or any generated summary the final source of truth.
- Do not update the full wiki after every small commit.
- Do not block normal execution unless the configured policy requires CodeWiki freshness.
- Do not move all `.planning/` artifacts into CodeWiki.
- Do not make `.planning/codebase/` the long-term truth source.
- Do not require network access for normal CodeWiki updates.

---

## Design Principles

### Git commit is the fact boundary

Every CodeWiki namespace must declare the exact commit it represents. If the working tree or current commit differs from the namespace manifest, Bebop must report the wiki as stale or dirty.

### A feature may have multiple fact boundaries

For multi-repo work, the fact boundary is the full set of member repo commits, not a single commit. A CodeWiki set is current only when every required member manifest matches its repo checkout, or when missing members are explicitly marked optional or external.

### Verified code changes are the update trigger

The preferred update point is after verification passes, not after every individual task commit. This keeps CodeWiki aligned with code states that have passed Bebop gates.

### Diff first, summary second

Phase summaries and requirement IDs provide intent, but CodeWiki updates must be driven by source changes, config changes, tests, scripts, and real diffs.

### Incremental by default

CodeWiki updates should identify affected modules and flows, then edit only the impacted documents and evidence. Wholesale regeneration is an escalation path, not the default.

### `.planning/codebase/` remains operational context

`.planning/codebase/` should stay optimized for planner/executor consumption. CodeWiki is optimized for durability, versioning, evidence, and cross-version maintenance.

---

## Conceptual Model

```text
Project workspace
  .planning/
    PROJECT.md
    REQUIREMENTS.md
    ROADMAP.md
    STATE.md
    codebase/                  # short-term working projection
    phases/

  code-wiki/
    wiki-index.yaml            # registry across repos, versions, and sets
    sets/
      <set_id>/
        wiki-set.yaml          # compatible repo commit tuple
        snapshots/             # set-level snapshots and release notes
    <repo_id>/
      <ref namespace>/
        manifest.yaml          # concrete Git identity and wiki status
        deepwiki-export/       # optional seed material
        coder-llm-wiki/        # durable evidence-backed wiki
```

### Key objects

**CodeWiki Index**

`code-wiki/wiki-index.yaml` registers all known repo/version wiki namespaces and CodeWiki sets.

**CodeWiki Set**

`code-wiki/sets/<set_id>/wiki-set.yaml` records a compatible group of repo wiki namespaces for a product, feature, workspace, milestone, or release. It is the coordination layer for multi-repo work.

**Manifest**

`manifest.yaml` is the authoritative binding between one repo wiki namespace and one Git state.

**Durable Wiki**

`coder-llm-wiki/` stores module docs, flow docs, evidence, review queues, and snapshots for one repo namespace.

**Set-Level Notes**

Set-level snapshots and notes capture cross-repo contracts, integration flows, compatibility assumptions, and release-level open questions. They should link to repo-level evidence instead of duplicating all repo details.

**Projection**

`.planning/codebase/` can be generated from current source analysis, CodeWiki summaries, or both. It remains disposable and workspace-scoped.

---

## Proposed Commands

### `/gsd-codewiki-init`

Create the CodeWiki structure for the current repo/ref or for a multi-repo set.

Responsibilities:

- Detect current Git root, branch, commit, and dirty state.
- Create or update `code-wiki/wiki-index.yaml`.
- Create namespace directory for the current repo/ref.
- Create `manifest.yaml`.
- When `--set <set_id>` or a Bebop workspace contains multiple repos, create `code-wiki/sets/<set_id>/wiki-set.yaml`.
- Add each member repo to the set with its current role, ref, and commit.
- Copy or scaffold `coder-llm-wiki/`.
- Optionally import seed material from `deepwiki-export/`.
- Create the first snapshot.

Default behavior:

- If current directory is not a Git repo and no member repos are discoverable, fail with a clear message.
- If current worktree is dirty, initialize but mark manifest as `dirty_at_init: true`.
- If any member repo is dirty during set initialization, record that member as dirty in the set manifest.
- Do not run DeepWiki automatically.

### `/gsd-codewiki-select`

Select the correct CodeWiki namespace or CodeWiki set for the current checkout/workspace.

Responsibilities:

- Run Git identity checks.
- Read `code-wiki/wiki-index.yaml`.
- Match by repo root, branch/tag/ref, and commit.
- If a workspace or `--set <set_id>` is active, match every member repo against the set manifest.
- Report whether the wiki is current, stale, missing, frozen, or dirty.
- For sets, report per-repo state plus aggregate set state.
- Print the selected wiki path and reason.

This command must not modify code or wiki content.

### `/gsd-codewiki-update`

Update CodeWiki from a verified code change in one repo or across a repo set.

Responsibilities:

- Determine update range:
  - explicit `--base <sha> --head <sha>`, or
  - explicit multi-repo range file, or
  - phase/milestone metadata, or
  - manifest commit to current `HEAD`.
- Read changed files and `git diff` for each affected repo.
- Discover optional DeepWiki and Repomix seed files for each affected repo namespace.
- Classify changes:
  - `module-internal`
  - `interface-change`
  - `entrypoint-change`
  - `flow-change`
  - `config-change`
  - `test-change`
  - `rename-or-move`
  - `deletion`
- Map changes to affected CodeWiki documents.
- Update only impacted module, flow, index, evidence, review docs, and set-level integration notes.
- Update each repo `manifest.yaml` to the new commit only after that repo update passes quality gates.
- Update `wiki-set.yaml` only after the compatible member tuple has been validated.
- Write `coder-llm-wiki/00-meta/maintenance-plan.json` with changed files, classifications, repo targets, set targets, pending task items, seed policy, and evidence requirements.
- Write a snapshot that records Git evidence and seed-only sources separately.

### `/gsd-codewiki-status`

Show CodeWiki health for the current workspace.

Responsibilities:

- Show selected repo/ref/commit.
- Show selected set ID and member repos when a set is active.
- Show manifest commit and current Git commit.
- Show freshness status per repo and for the aggregate set.
- Show latest snapshot.
- Show active blockers and open questions.
- Show stale or high-risk areas if known.
- Show whether `.planning/codebase/` is older than CodeWiki.

### `/gsd-codewiki-verify`

Verify CodeWiki maintenance task completion after an update.

Responsibilities:

- Select the same repo namespace or set used by `codewiki-status`.
- Read each repo's `coder-llm-wiki/00-meta/maintenance-plan.json`.
- Read completed task records from `coder-llm-wiki/00-meta/progress.json`.
- Read blocked task records from `coder-llm-wiki/00-meta/task-queue.json`.
- Fail verification when tasks are unresolved, invalid, blocked, or recorded as both completed and blocked.
- Require completed tasks to include source evidence paths and updated wiki files.
- Reject DeepWiki and Repomix seed files as final evidence.
- For set-level contract and flow tasks, require cross-repo evidence from multiple member repos when applicable.

### `/gsd-codewiki-project`

Project the selected CodeWiki namespace or CodeWiki set into `.planning/codebase/codewiki-summary.md`.

Responsibilities:

- Select the same repo namespace or set used by `codewiki-status`.
- Record state, set ID, tuple ID, repo commits, manifest commits, snapshots, open questions, and warnings.
- Include compact excerpts from status dashboards and latest snapshots.
- Make clear that `.planning/codebase/codewiki-summary.md` is disposable planning context, not the authoritative CodeWiki.
- Refuse to project a missing CodeWiki and recommend `/gsd-codewiki-init`.

### `/gsd-codewiki-index`

Index the selected CodeWiki namespace or CodeWiki set into `.planning/intel/codewiki.json`.

Responsibilities:

- Require `intel.enabled=true`.
- Select the same repo namespace or set used by `codewiki-status`.
- Write compact structured records for set state, member repos, commits, wiki paths, snapshots, and open questions.
- Let `/gsd-intel query` search CodeWiki facts without copying full wiki documents.
- Make clear that `.planning/intel/codewiki.json` is derived query data, not the authoritative CodeWiki.

### `/gsd-codewiki-contract`

Create or register a set-level cross-repo contract document.

Responsibilities:

- Require a selected CodeWiki set.
- Validate producer and consumer repo IDs against `wiki-set.yaml` members.
- Create or reuse `cross-repo/contracts/<name>.md`.
- Register the document in `wiki-set.yaml` under `cross_repo.contracts`.
- Keep new contracts `blocked` until exact producer and consumer source evidence is filled.

### `/gsd-codewiki-flow`

Create or register a set-level cross-repo integration flow document.

Responsibilities:

- Require a selected CodeWiki set.
- Validate participating repo IDs against `wiki-set.yaml` members.
- Create or reuse `cross-repo/flows/<name>.md`.
- Register the document in `wiki-set.yaml` under `cross_repo.flows`.
- Keep new flows `blocked` until every participating repo has exact source evidence.

### `/gsd-codewiki-freeze <version>`

Freeze one CodeWiki namespace or a full CodeWiki set for a shipped version.

Responsibilities:

- Require a clean or explicitly acknowledged working tree.
- Bind each member wiki to a tag or release commit.
- Bind the set to the complete member commit tuple.
- Mark manifest `status: frozen`.
- Mark set manifest `status: frozen`.
- Write repo-level and set-level frozen snapshots.
- Prevent normal incremental updates to that namespace.
- Prevent normal incremental updates to frozen set members through that set.
- Allow review notes only, unless explicitly unfrozen.

---

## Lifecycle Integration

### Before planning

`/gsd-plan-phase` should optionally run a read-only CodeWiki selection step.

If enabled:

1. Select current CodeWiki namespace or active CodeWiki set.
2. Load relevant modules, flows, risks, and test maps.
3. For sets, also load cross-repo contracts and integration flows.
4. Prefer CodeWiki evidence over stale `.planning/codebase/` files.
5. If wiki is stale, warn and fall back to current source exploration.

### During execution

`/gsd-execute-phase` should not update CodeWiki after every task by default.

It should record enough metadata for a later CodeWiki update:

- phase number and name
- plan IDs
- requirement IDs
- task commits
- affected repos
- per-repo base and head commits
- verification result
- summary paths

### After verification

When a phase passes verification, Bebop may run:

```text
/gsd-codewiki-update --phase <N>
```

This is the default recommended update point.

For multi-repo phases, Bebop should run one set update:

```text
/gsd-codewiki-update --phase <N> --set <set_id>
```

The update must promote the set only if all required member repo updates are current or explicitly acknowledged.

If verification fails, CodeWiki should not be promoted to the new commit. It may record review notes only if useful.

### At milestone close

`/gsd-complete-milestone` should check CodeWiki status before tagging.

Recommended behavior:

1. Run `/gsd-codewiki-status`.
2. If stale, prompt or follow configured policy.
3. Run `/gsd-codewiki-update --milestone <version>` if needed.
4. Run `/gsd-codewiki-freeze <version>` after milestone archive and tag are ready.

For multi-repo milestones, the status, update, and freeze steps should operate on the release set, not only the current repo.

---

## Configuration

Add optional `codewiki` configuration to `.planning/config.json`.

```json
{
  "codewiki": {
    "enabled": false,
    "root": "code-wiki",
    "active_set": null,
    "member_repos": [],
    "update_on_phase_verified": true,
    "update_on_milestone_complete": true,
    "require_fresh_before_plan": false,
    "require_fresh_before_milestone_close": true,
    "require_verified_before_milestone_close": true,
    "evidence_policy": "source_required",
    "projection": {
      "update_planning_codebase": false,
      "index_intel": false,
      "mode": "summary"
    }
  }
}
```

### Config semantics

- `enabled`: master switch. Existing Bebop behavior is unchanged when false.
- `root`: location of CodeWiki registry relative to project root.
- `active_set`: optional default CodeWiki set ID for the current workspace.
- `member_repos`: optional explicit repo list for multi-repo workspaces when Bebop cannot discover members.
- `update_on_phase_verified`: run update after successful phase verification.
- `update_on_milestone_complete`: run update/freeze during milestone close.
- `require_fresh_before_plan`: warn or block stale wiki before planning.
- `require_fresh_before_milestone_close`: block milestone close until acknowledged or updated.
- `require_verified_before_milestone_close`: block milestone close and freeze until `codewiki.verify` passes, unless explicitly acknowledged.
- `evidence_policy`: minimum evidence policy. Initial supported value: `source_required`.
- `projection.update_planning_codebase`: whether to refresh `.planning/codebase/` from CodeWiki.
- `projection.index_intel`: whether to refresh `.planning/intel/codewiki.json` from CodeWiki when `intel.enabled` is true.
- `projection.mode`: projection detail level, initially `summary`.

---

## Manifest Schema

Repo-level example:

```yaml
repo_id: bebop
source_repo: /Users/example/work/bebop

ref_type: branch
ref_name: main
commit_sha: f8c4ed4abc123
base_ref:
base_commit_sha:

wiki_version_id: bebop__main__f8c4ed4
created_at: "2026-04-29T00:00:00+08:00"
updated_at: "2026-04-29T00:00:00+08:00"
status: active

paths:
  wiki_root: coder-llm-wiki/
  deepwiki_export: deepwiki-export/deepwiki.md
  latest_snapshot: coder-llm-wiki/10-snapshots/2026-04-29-main-f8c4ed4.md

source_policy:
  final_truth: git_commit
  seed_sources_allowed: true
  seed_sources_are_evidence: false
  evidence_required: true

freshness:
  valid_for_commit: f8c4ed4abc123
  stale_if_commit_differs: true
  dirty_at_last_update: false
```

---

## Set Manifest Schema

Example:

```yaml
set_id: checkout-platform__v1
name: Checkout Platform v1
scope: milestone
description: Compatible wiki set for checkout UI, API, and shared SDK changes.

created_at: "2026-04-29T00:00:00+08:00"
updated_at: "2026-04-29T00:00:00+08:00"
status: active

members:
  - repo_id: checkout-web
    role: frontend
    required: true
    source_repo: /Users/example/work/checkout-web
    ref_type: branch
    ref_name: feature/checkout-v1
    commit_sha: aaaa1111
    manifest: ../../checkout-web/branches/feature-checkout-v1/manifest.yaml
    wiki_path: ../../checkout-web/branches/feature-checkout-v1/coder-llm-wiki

  - repo_id: checkout-api
    role: backend
    required: true
    source_repo: /Users/example/work/checkout-api
    ref_type: branch
    ref_name: feature/checkout-v1
    commit_sha: bbbb2222
    manifest: ../../checkout-api/branches/feature-checkout-v1/manifest.yaml
    wiki_path: ../../checkout-api/branches/feature-checkout-v1/coder-llm-wiki

  - repo_id: payment-sdk
    role: shared-library
    required: true
    source_repo: /Users/example/work/payment-sdk
    ref_type: tag
    ref_name: v2.4.0
    commit_sha: cccc3333
    manifest: ../../payment-sdk/tags/v2.4.0/manifest.yaml
    wiki_path: ../../payment-sdk/tags/v2.4.0/coder-llm-wiki

compatibility:
  tuple_id: checkout-platform__v1__aaaa1111_bbbb2222_cccc3333
  stale_if_any_member_differs: true
  allow_optional_missing: false

cross_repo:
  contracts:
    - name: checkout-session-api
      producer_repo: checkout-api
      consumer_repos: [checkout-web, payment-sdk]
      docs:
        - cross-repo/contracts/checkout-session-api.md
  flows:
    - name: create-checkout-session
      repos: [checkout-web, checkout-api, payment-sdk]
      docs:
        - cross-repo/flows/create-checkout-session.md

paths:
  latest_snapshot: snapshots/2026-04-29-checkout-platform-v1.md
```

Set-level docs should be concise. They should describe cross-repo contracts, integration flows, and compatibility risks, while linking to repo-level module, flow, and evidence files for details.

Member role inference is conservative and happens during initialization. Bebop should infer `frontend`, `backend`, `shared-library`, `service`, `worker`, or `docs` from stable repo/package names, common dependency markers, and framework config files; ambiguous repos default to `service`. Operators can correct roles by editing `wiki-set.yaml` when the automatic signal is insufficient.

The helper commands `/gsd-codewiki-contract` and `/gsd-codewiki-flow` may create the set-level docs and register them here, but their initial status must remain `blocked` until the docs cite real producer/consumer or participating-repo evidence.

---

## Index Schema

Example:

```yaml
repos:
  bebop:
    source_repo: /Users/example/work/bebop
    versions:
      - version_id: bebop__main__f8c4ed4
        ref_type: branch
        ref_name: main
        commit_sha: f8c4ed4abc123
        code_worktree: /Users/example/work/bebop
        role: service
        wiki_path: code-wiki/bebop/main/latest/coder-llm-wiki
        manifest: code-wiki/bebop/main/latest/manifest.yaml
        status: active

sets:
  checkout-platform__v1:
    manifest: code-wiki/sets/checkout-platform__v1/wiki-set.yaml
    status: active
    members:
      - repo_id: checkout-web
        version_id: checkout-web__feature-checkout-v1__aaaa1111
      - repo_id: checkout-api
        version_id: checkout-api__feature-checkout-v1__bbbb2222
      - repo_id: payment-sdk
        version_id: payment-sdk__tag-v2.4.0__cccc3333
```

---

## Agent Design

### `gsd-codewiki-maintainer`

New agent responsible for durable CodeWiki maintenance.

Inputs:

- selected manifest
- selected set manifest, when present
- `wiki-index.yaml`
- current Git identity for each affected repo
- update range for each affected repo
- `git diff --name-status` for each affected repo
- `git diff` for each affected repo
- phase summaries or milestone summary when available
- existing CodeWiki status, progress, task queue, and latest snapshot
- existing set-level cross-repo contracts and flow notes, when present

Outputs:

- updated module docs
- updated flow docs
- updated evidence docs
- updated review docs
- updated `progress.json`
- updated `task-queue.json`
- new snapshot
- updated set-level snapshot and cross-repo notes when a set is active
- summary of changed wiki artifacts

Rules:

- Never use DeepWiki export as final evidence.
- Prefer source, config, tests, scripts, and real diff.
- Keep facts and inferences separate.
- If impact cannot be mapped reliably, update review docs and recommend local index rebuild.
- Do not rewrite the whole wiki unless the update is explicitly escalated.
- For set updates, do not promote the set tuple until all required member repo updates are current or explicitly acknowledged.
- Cross-repo conclusions must cite evidence from every repo needed to support the conclusion.

### Relationship to `gsd-codebase-mapper`

```text
gsd-codebase-mapper
  creates .planning/codebase/ operational context

gsd-codewiki-maintainer
  maintains durable, version-bound CodeWiki
```

The mapper may consume CodeWiki in the future, but it should not own CodeWiki freshness.

---

## Workflow Design: `codewiki-select`

Steps:

1. Read Git identity:

   ```bash
   git rev-parse --show-toplevel
   git rev-parse --abbrev-ref HEAD
   git rev-parse HEAD
   git status --short
   ```

2. Locate `code-wiki/wiki-index.yaml`.
3. If `--set <set_id>` or `codewiki.active_set` is present, read `code-wiki/sets/<set_id>/wiki-set.yaml`.
4. Match current repo/ref/commit, or match every member repo in the active set.
5. Read selected `manifest.yaml` files.
6. Read selected `coder-llm-wiki/00-meta/status-dashboard.md` files.
7. Report:
   - selected set ID, if any
   - selected wiki path
   - current commit
   - manifest commit
   - freshness state
   - dirty state
   - recommended next action

Exit states:

- `current`: manifest commit equals current commit and tree is clean.
- `dirty-current`: manifest commit equals current commit but tree is dirty.
- `stale`: manifest commit differs from current commit.
- `missing`: no matching wiki namespace.
- `frozen`: matching wiki is frozen.
- `set-current`: every required member is current and clean.
- `set-partial`: at least one optional member is missing or stale, but required members are current.
- `set-stale`: at least one required member differs from the set tuple.

---

## Workflow Design: `codewiki-update`

Steps:

1. Run `codewiki-select`.
2. Resolve update range for one repo or all affected set members.
3. Read existing CodeWiki state:
   - `coder-llm-wiki/README.md`
   - `00-meta/workflow-contract.md`
   - `00-meta/quality-gates.md`
   - `00-meta/incremental-update-policy.md`
   - `00-meta/maintenance-plan.json`
   - `00-meta/progress.json`
   - `00-meta/task-queue.json`
   - latest snapshot
   - optional DeepWiki and Repomix seed sources
4. Read change scope for each affected repo:

   ```bash
   git -C <repo> diff --name-status <base>..<head>
   git -C <repo> diff <base>..<head>
   ```

5. Classify changes.
6. Record seed sources as context only; they are not final evidence and cannot replace source citations.
7. Write or refresh `00-meta/maintenance-plan.json` as a deterministic maintainer handoff with `tasks[]`.
8. Map changes to impacted repo-level artifacts.
9. Map interface and integration changes to impacted set-level contracts and flows.
10. Update impacted docs.
11. Run `codewiki-verify` when task records have been written:
   - completed tasks have source evidence
   - completed tasks list updated wiki files
   - blocked tasks have concrete reasons
   - unresolved or conflicting tasks fail the gate
   - cross-repo tasks cite multiple member repos when applicable
12. Run lightweight quality checks:
   - evidence exists
   - paths exist
   - tests referenced honestly
   - open questions captured
   - progress and queue updated
   - cross-repo conclusions cite all relevant repos
13. Write repo-level snapshots.
14. Write set-level snapshot when a set is active.
15. Update repo manifest commit and freshness metadata.
16. Update set manifest tuple only after required members pass.
17. Report changed wiki artifacts.

Failure handling:

- If no wiki exists, recommend `/gsd-codewiki-init`.
- If manifest is frozen, refuse normal update and suggest a new namespace.
- If impact mapping is unreliable, write review entry and stop before manifest promotion unless configured otherwise.
- If evidence is insufficient, keep manifest at old commit and mark update incomplete.
- If one required member update fails in a set, keep the set tuple at the previous compatible state and mark the set update incomplete.

---

## Workflow Design: `codewiki-freeze`

Steps:

1. Run `codewiki-status`.
2. Run `codewiki-verify` unless the release explicitly accepts unverified maintenance with `--allow-unverified`.
3. Verify target version or tag.
4. Ensure wiki is current or explicitly acknowledged as stale.
5. Write final snapshot.
6. Set repo manifests:

   ```yaml
   status: frozen
   frozen_at: "<timestamp>"
   frozen_for_version: "<version>"
   ```

7. Update `wiki-index.yaml`.
8. If a set is active, set `wiki-set.yaml` status to `frozen` and record the final member tuple.
8. Report frozen namespace or frozen set.

---

## Interaction With Existing Bebop Surfaces

### Multi-repo workspaces

When Bebop runs in a workspace that contains multiple repos, CodeWiki should treat the workspace as the natural source for a set.

Recommended behavior:

- discover member repos from Bebop workspace metadata when available
- fall back to `codewiki.member_repos` when workspace metadata is absent
- keep repo-level manifests independent
- keep cross-repo compatibility in `wiki-set.yaml`
- never assume every repo in a filesystem parent directory is part of the feature

### `.planning/codebase/`

CodeWiki can inform `.planning/codebase/`, but `.planning/codebase/` stays workspace-local and disposable.

Recommended first version:

- update `.planning/codebase/codewiki-summary.md` only when `codewiki.projection.update_planning_codebase` is true or `/gsd-codewiki-project` is invoked directly
- let `/gsd-map-codebase` keep its current behavior
- add warnings when `.planning/codebase/` is older than selected CodeWiki

### `.planning/intel/`

First integration:

- index CodeWiki module and flow summaries into `.planning/intel/codewiki.json`
- let `/gsd-intel query` search durable CodeWiki facts
- store only derived JSON indexes in `.planning/intel/`

### DeepWiki

DeepWiki output is optional seed material only.

Allowed:

- initial outline
- candidate module grouping
- rough diagram or RAG view

Not allowed:

- final evidence
- manifest promotion without source verification

### Repomix

Repomix is useful for large context packaging and initial analysis.

Allowed:

- feed selected source slices to agents
- package changed files and nearby context
- support initial inventory

Not allowed:

- treat packed output as fresher than Git
- use packed output as the only evidence when source files are available

---

## User Experience

### New requirement completion

Expected path:

```text
/gsd-execute-phase N
  -> implementation tasks
  -> verification
  -> phase summary
  -> /gsd-codewiki-update --phase N
  -> CodeWiki snapshot
```

If update succeeds:

```text
CodeWiki updated:
  base: abc123
  head: def456
  changed docs:
    - 03-modules/auth.md
    - 04-flows/login.md
    - 08-evidence/auth.refs.md
    - 10-snapshots/2026-04-29-phase-03.md
```

### Multi-repo requirement completion

Expected path:

```text
/gsd-execute-phase N
  -> tasks in checkout-web, checkout-api, payment-sdk
  -> per-repo commits
  -> verification across the integration boundary
  -> phase summary with affected repo tuple
  -> /gsd-codewiki-update --phase N --set checkout-platform__v1
  -> repo-level wiki snapshots
  -> set-level compatibility snapshot
```

If update succeeds:

```text
CodeWiki set updated:
  set: checkout-platform__v1
  tuple:
    checkout-web: aaaa1111 -> dddd4444
    checkout-api: bbbb2222 -> eeee5555
    payment-sdk: cccc3333 -> cccc3333
  changed docs:
    - checkout-web/03-modules/checkout-page.md
    - checkout-api/04-flows/create-session.md
    - sets/checkout-platform__v1/cross-repo/contracts/checkout-session-api.md
    - sets/checkout-platform__v1/snapshots/2026-04-29-phase-03.md
```

If update is stale or blocked:

```text
CodeWiki update incomplete:
  reason: interface change could not be mapped to an existing module
  review entry: 09-review/open-questions.md
  manifest remains at abc123
```

### Planning with stale wiki

If `require_fresh_before_plan` is false:

```text
CodeWiki stale:
  wiki commit: abc123
  current commit: def456
Using current source exploration for affected areas.
```

If true:

```text
CodeWiki stale. Run /gsd-codewiki-update before planning, or disable the freshness gate.
```

---

## Implementation Plan

### Phase 1: Manual commands

Add:

- `commands/gsd/codewiki-select.md`
- `commands/gsd/codewiki-init.md`
- `commands/gsd/codewiki-update.md`
- `commands/gsd/codewiki-status.md`
- `commands/gsd/codewiki-verify.md`
- `commands/gsd/codewiki-project.md`
- `commands/gsd/codewiki-index.md`
- `commands/gsd/codewiki-freeze.md`
- `get-shit-done/workflows/codewiki-*.md`
- `agents/gsd-codewiki-maintainer.md`
- repo manifest and set manifest templates

No automatic lifecycle hooks yet.

### Phase 2: Lifecycle integration

Add optional config-driven calls from:

- `/gsd-plan-phase`
- `/gsd-execute-phase`
- `/gsd-complete-milestone`

Default to warnings and explicit commands, not hard blocking.

### Phase 3: Projection and intel

Add:

- CodeWiki-derived `.planning/codebase/` projection through `/gsd-codewiki-project`
- `.planning/intel/codewiki.json` indexes from CodeWiki through `/gsd-codewiki-index`
- status checks comparing projection freshness to wiki freshness

### Phase 4: Quality and tests

Add structural tests for:

- command files
- workflow files
- agent file
- config schema defaults
- manifest/index parsing
- set manifest parsing
- set freshness and partial-member status
- frozen namespace behavior
- stale wiki reporting

---

## Acceptance Criteria

- A project can initialize CodeWiki for the current Git checkout.
- A workspace can initialize a CodeWiki set for multiple member repos.
- Bebop can select the correct CodeWiki namespace for a repo/ref/commit.
- Bebop can select the correct CodeWiki set and report per-member status.
- Bebop can report stale, missing, frozen, dirty, current, set-current, set-partial, and set-stale states.
- A verified phase can update CodeWiki from Git diff without rewriting the whole wiki.
- A verified multi-repo phase can update affected member wikis and the set compatibility snapshot.
- CodeWiki update writes or updates evidence and snapshot files.
- Manifest commit is advanced only after the update passes minimum quality checks.
- Set manifest tuple is advanced only after all required member updates pass or are explicitly acknowledged.
- Milestone close can freeze a CodeWiki namespace or CodeWiki set for a version.
- Existing Bebop projects behave unchanged when `codewiki.enabled` is false.

---

## Risks

### Risk: CodeWiki update becomes too expensive

Mitigation:

- update after verification, not after every commit
- use diff-based impacted-doc mapping
- support manual update mode

### Risk: Generated wiki content drifts from source

Mitigation:

- require source evidence
- keep manifest promotion gated
- track open questions explicitly

### Risk: Duplicate truth sources

Mitigation:

- Git commit remains final truth
- CodeWiki is durable interpretation with evidence
- `.planning/codebase/` is operational projection only

### Risk: Multi-repo workspaces become ambiguous

Mitigation:

- require `repo_id`
- bind each namespace to its own source repo path and commit
- keep one manifest per repo/ref/version
- keep one explicit set manifest per feature, product slice, workspace, milestone, or release
- do not infer set membership from filesystem layout alone

### Risk: Cross-repo compatibility is promoted too early

Mitigation:

- promote the set tuple only after all required members pass
- allow optional members only when marked `required: false`
- keep set-level open questions separate from repo-level questions
- require cross-repo contracts to cite producer and consumer evidence

---

## Open Questions

- Should CodeWiki live inside each repo, or in a sibling `code-wiki/` repository for multi-repo workspaces?
- Should CodeWiki sets be workspace-scoped, milestone-scoped, release-scoped, or support all three as first-class scopes?
- Should Bebop require a successful cross-repo verification artifact before promoting a set tuple?
- How should set membership be discovered when a feature uses one repo directly and another only as a released package?
- Should phase verification fail when CodeWiki update fails, or should it only mark follow-up debt?
- Should `.planning/codebase/` be regenerated from CodeWiki by default after update?
- How much of `coder-llm-wiki` should be vendored, templated, or treated as an external dependency?
- Should frozen tag wiki allow typo and review note edits, or be strictly immutable?

---

## Recommended Default

Initial implementation should be conservative:

```json
{
  "codewiki": {
    "enabled": false,
    "active_set": null,
    "member_repos": [],
    "update_on_phase_verified": false,
    "update_on_milestone_complete": true,
    "require_fresh_before_plan": false,
    "require_fresh_before_milestone_close": true,
    "require_verified_before_milestone_close": true,
    "projection": {
      "update_planning_codebase": false,
      "index_intel": false
    }
  }
}
```

This lets teams adopt CodeWiki explicitly, while making milestone close the first strong freshness checkpoint.
