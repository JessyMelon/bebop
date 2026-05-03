# Plan: Implement CodeWiki Lifecycle Management

> Design reference: `docs/superpowers/specs/2026-04-29-codewiki-lifecycle-design.md`

## Goal

Add Bebop/GSD support for maintaining version-aware CodeWiki namespaces and multi-repo CodeWiki sets. The first implementation should be intentionally conservative: manual commands, explicit manifests, explicit updates, and structural tests before any automatic lifecycle hook is enabled.

## Recommended Decisions For Phase 1

- Store CodeWiki under the active Bebop workspace by default: `code-wiki/`.
- Support a sibling or external wiki repository later by allowing `codewiki.root` to point outside the workspace.
- Treat CodeWiki update failure as follow-up debt after phase verification.
- Treat stale CodeWiki as a milestone-close blocker only when `codewiki.require_fresh_before_milestone_close` is true.
- Implement multi-repo support through `wiki-set.yaml`; do not infer set membership from filesystem layout alone.
- Keep `.planning/codebase/` unchanged in Phase 1.

## Architecture

Phase 1 adds a new CodeWiki command family:

```text
/gsd-codewiki-init
/gsd-codewiki-select
/gsd-codewiki-status
/gsd-codewiki-verify
/gsd-codewiki-project
/gsd-codewiki-index
/gsd-codewiki-contract
/gsd-codewiki-flow
/gsd-codewiki-update
/gsd-codewiki-freeze
```

These commands operate on:

```text
code-wiki/
  wiki-index.yaml
  sets/
    <set_id>/
      wiki-set.yaml
      snapshots/
      cross-repo/
        contracts/
        flows/
  <repo_id>/
    <ref namespace>/
      manifest.yaml
      deepwiki-export/
      coder-llm-wiki/
```

Repo-level manifests bind one wiki namespace to one Git commit. Set-level manifests bind a complete multi-repo compatible commit tuple.

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `commands/gsd/codewiki-init.md` | Add | User-facing command for creating repo wiki namespaces and sets |
| `commands/gsd/codewiki-select.md` | Add | Read-only command for selecting the matching namespace or set |
| `commands/gsd/codewiki-status.md` | Add | Read-only command for freshness, blockers, and snapshot status |
| `commands/gsd/codewiki-verify.md` | Add | Read-only command for maintenance task, evidence, and blocked queue verification |
| `commands/gsd/codewiki-project.md` | Add | Command for projecting selected CodeWiki context into `.planning/codebase/` |
| `commands/gsd/codewiki-index.md` | Add | Command for indexing selected CodeWiki facts into `.planning/intel/` |
| `commands/gsd/codewiki-contract.md` | Add | Command for creating/registering cross-repo contract docs |
| `commands/gsd/codewiki-flow.md` | Add | Command for creating/registering cross-repo flow docs |
| `commands/gsd/codewiki-update.md` | Add | Command for diff-based CodeWiki updates |
| `commands/gsd/codewiki-freeze.md` | Add | Command for freezing release/tag wiki namespaces or sets |
| `get-shit-done/workflows/codewiki-init.md` | Add | Init workflow logic |
| `get-shit-done/workflows/codewiki-select.md` | Add | Select workflow logic |
| `get-shit-done/workflows/codewiki-status.md` | Add | Status workflow logic |
| `get-shit-done/workflows/codewiki-verify.md` | Add | Maintenance verification workflow logic |
| `get-shit-done/workflows/codewiki-project.md` | Add | Projection workflow logic |
| `get-shit-done/workflows/codewiki-index.md` | Add | Intel indexing workflow logic |
| `get-shit-done/workflows/codewiki-contract.md` | Add | Cross-repo contract helper workflow |
| `get-shit-done/workflows/codewiki-flow.md` | Add | Cross-repo flow helper workflow |
| `get-shit-done/workflows/codewiki-update.md` | Add | Update workflow logic |
| `get-shit-done/workflows/codewiki-freeze.md` | Add | Freeze workflow logic |
| `agents/gsd-codewiki-maintainer.md` | Add | Agent for durable wiki maintenance |
| `get-shit-done/templates/codewiki/repo-manifest.yaml` | Add | Repo manifest template |
| `get-shit-done/templates/codewiki/wiki-set.yaml` | Add | Multi-repo set manifest template |
| `get-shit-done/templates/codewiki/set-snapshot.md` | Add | Set-level snapshot template |
| `get-shit-done/templates/codewiki/cross-repo-contract.md` | Add | Cross-repo contract template |
| `get-shit-done/templates/codewiki/cross-repo-flow.md` | Add | Cross-repo flow template |
| `docs/COMMANDS.md` | Update | Document command surface |
| `docs/FEATURES.md` | Update | Add CodeWiki lifecycle capability |
| `docs/CONFIGURATION.md` | Update | Document `codewiki` config |
| `docs/INVENTORY.md` | Update | Register new commands, workflow files, agent, templates |
| `tests/codewiki-structure.test.cjs` | Add | Structural regression tests |

Localized docs can follow after the English canonical docs are stable.

---

## Task 1: Add CodeWiki Templates

**Files:**

- Add: `get-shit-done/templates/codewiki/repo-manifest.yaml`
- Add: `get-shit-done/templates/codewiki/wiki-set.yaml`
- Add: `get-shit-done/templates/codewiki/set-snapshot.md`
- Add: `get-shit-done/templates/codewiki/cross-repo-contract.md`
- Add: `get-shit-done/templates/codewiki/cross-repo-flow.md`

- [x] Step 1.1: Create `get-shit-done/templates/codewiki/`.

- [x] Step 1.2: Add `repo-manifest.yaml`.

Required fields:

```yaml
repo_id:
source_repo:
ref_type:
ref_name:
commit_sha:
wiki_version_id:
created_at:
updated_at:
status:
paths:
source_policy:
freshness:
```

- [x] Step 1.3: Add `wiki-set.yaml`.

Required fields:

```yaml
set_id:
name:
scope:
status:
members:
compatibility:
cross_repo:
paths:
```

- [x] Step 1.4: Add set-level Markdown templates.

Minimum sections:

```text
set-snapshot.md:
  Summary
  Member Tuple
  Changed Repos
  Cross-Repo Contracts
  Cross-Repo Flows
  Open Questions
  Next Actions

cross-repo-contract.md:
  Producer
  Consumers
  Contract Surface
  Compatibility Rules
  Evidence
  Open Questions

cross-repo-flow.md:
  Trigger
  Participating Repos
  Main Path
  Failure Paths
  State Changes
  Evidence
  Open Questions
```

- [x] Step 1.5: Keep templates source-evidence oriented. Do not include DeepWiki as final evidence in template examples.

## Task 2: Add Command Prompt Files

**Files:**

- Add: `commands/gsd/codewiki-init.md`
- Add: `commands/gsd/codewiki-select.md`
- Add: `commands/gsd/codewiki-status.md`
- Add: `commands/gsd/codewiki-project.md`
- Add: `commands/gsd/codewiki-index.md`
- Add: `commands/gsd/codewiki-update.md`
- Add: `commands/gsd/codewiki-freeze.md`

- [x] Step 2.1: Add command frontmatter.

Each command must include:

```yaml
name: gsd:codewiki-<verb>
description:
argument-hint:
allowed-tools:
```

- [x] Step 2.2: Reference the matching workflow file in `<execution_context>`.

Example:

```md
<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-select.md
</execution_context>
```

- [x] Step 2.3: Keep select/status read-only.

Allowed tools for read-only commands:

```text
Read, Bash, Glob, Grep
```

- [x] Step 2.4: Allow write tools only for init/update/freeze.

Allowed tools:

```text
Read, Write, Edit, Bash, Glob, Grep, Task
```

- [x] Step 2.5: Add explicit multi-repo arguments.

Recommended hints:

```text
codewiki-init: "[--set <set-id>] [--repos <paths>] [--repo-id <id>]"
codewiki-select: "[--set <set-id>]"
codewiki-status: "[--set <set-id>]"
codewiki-project: "[--set <set-id>]"
codewiki-index: "[--set <set-id>]"
codewiki-update: "[--phase N|--milestone VERSION|--base SHA --head SHA] [--set <set-id>]"
codewiki-freeze: "<version> [--set <set-id>]"
```

## Task 3: Add Workflow Files

**Files:**

- Add: `get-shit-done/workflows/codewiki-init.md`
- Add: `get-shit-done/workflows/codewiki-select.md`
- Add: `get-shit-done/workflows/codewiki-project.md`
- Add: `get-shit-done/workflows/codewiki-index.md`
- Add: `get-shit-done/workflows/codewiki-status.md`
- Add: `get-shit-done/workflows/codewiki-update.md`
- Add: `get-shit-done/workflows/codewiki-freeze.md`

- [x] Step 3.1: Implement `codewiki-select.md` as the contract source for freshness states.

Required states:

```text
current
dirty-current
stale
missing
frozen
set-current
set-partial
set-stale
```

- [x] Step 3.2: Implement `codewiki-init.md`.

Required behavior:

- detect current Git identity
- create `code-wiki/wiki-index.yaml` if missing
- create repo namespace manifest
- create set manifest when `--set` or multi-repo inputs are present
- scaffold `coder-llm-wiki/` directory or document that it must be copied from a template
- write initial snapshot

- [x] Step 3.3: Implement `codewiki-status.md`.

Required output:

- selected namespace or set
- per-repo current commit and manifest commit
- freshness state
- latest snapshot
- open blockers/questions
- suggested next action

- [x] Step 3.3a: Implement `codewiki-project.md`.

Required output:

- `.planning/codebase/codewiki-summary.md`
- selected state and set tuple metadata
- member repo commit table
- latest repo/set snapshot excerpts
- explicit disposable-projection warning

- [x] Step 3.3b: Implement `codewiki-index.md`.

Required output:

- `.planning/intel/codewiki.json`
- selected state and set tuple metadata
- compact repo/set records queryable by `/gsd-intel query`
- explicit derived-index warning

- [x] Step 3.4: Implement `codewiki-update.md`.

Required behavior:

- run select first
- resolve update range
- read `git diff --name-status` and `git diff` per affected repo
- classify change types
- spawn or instruct `gsd-codewiki-maintainer`
- update repo manifests only after quality checks
- update set tuple only after required members pass
- write repo-level and set-level snapshots

- [x] Step 3.5: Implement `codewiki-freeze.md`.

Required behavior:

- run status first
- confirm target version/tag
- freeze repo manifests
- freeze set manifest when active
- write frozen snapshot
- refuse normal updates to frozen namespaces later

## Task 4: Add `gsd-codewiki-maintainer` Agent

**File:**

- Add: `agents/gsd-codewiki-maintainer.md`

- [x] Step 4.1: Define role and tool set.

Recommended frontmatter:

```yaml
---
name: gsd-codewiki-maintainer
description: Maintains version-aware CodeWiki namespaces and multi-repo CodeWiki sets from source diffs.
tools: Read, Bash, Grep, Glob, Write, Edit
color: blue
---
```

- [x] Step 4.2: Require mandatory initial reads.

Agent must read:

- selected repo manifest
- selected set manifest when present
- `wiki-index.yaml`
- `coder-llm-wiki/00-meta/workflow-contract.md`
- `coder-llm-wiki/00-meta/quality-gates.md`
- `coder-llm-wiki/00-meta/incremental-update-policy.md`
- current diff and changed file list

- [x] Step 4.3: Define update rules.

Rules:

- source/config/tests/scripts/diff are evidence
- DeepWiki and Repomix are seed/context only
- facts, inference, and questions stay separate
- do not rewrite the whole wiki by default
- do not promote set tuple until required members pass
- cross-repo claims require producer and consumer evidence

- [x] Step 4.4: Define confirmation output.

Agent should return only:

```text
updated files
blocked files
manifest promotion recommendation
set promotion recommendation
snapshot path
open questions
```

## Task 5: Add Documentation Updates

**Files:**

- Update: `docs/COMMANDS.md`
- Update: `docs/FEATURES.md`
- Update: `docs/CONFIGURATION.md`
- Update: `docs/INVENTORY.md`

- [x] Step 5.1: Add a CodeWiki command section to `docs/COMMANDS.md`.

- [x] Step 5.2: Add a CodeWiki lifecycle feature to `docs/FEATURES.md`.

- [x] Step 5.3: Add `codewiki` config documentation to `docs/CONFIGURATION.md`.

Document defaults:

```json
{
  "codewiki": {
    "enabled": false,
    "root": "code-wiki",
    "active_set": null,
    "member_repos": [],
    "update_on_phase_verified": false,
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

- [x] Step 5.4: Register new surfaces in `docs/INVENTORY.md`.

Inventory additions:

- 5 commands
- 5 workflows
- 1 agent
- 5 templates

## Task 6: Add Structural Tests

**File:**

- Add: `tests/codewiki-structure.test.cjs`

- [x] Step 6.1: Test command files exist.

Assertions:

- all 5 command files exist
- frontmatter has `name`
- command references matching workflow
- read-only commands do not include `Write` or `Edit`

- [x] Step 6.2: Test workflow files exist and contain required states.

Assertions:

- select workflow contains all freshness states
- update workflow mentions per-repo diff
- update workflow mentions set tuple promotion
- freeze workflow mentions frozen repo and set manifests

- [x] Step 6.3: Test agent file exists and contains required rules.

Assertions:

- `gsd-codewiki-maintainer` file exists
- mentions source evidence
- rejects DeepWiki as final evidence
- mentions set tuple promotion
- mentions cross-repo producer/consumer evidence

- [x] Step 6.4: Test templates exist and contain required top-level fields.

Assertions:

- `repo-manifest.yaml` has `repo_id`, `commit_sha`, `freshness`
- `wiki-set.yaml` has `set_id`, `members`, `compatibility`
- snapshot/contract/flow templates have `Evidence` and `Open Questions`

- [x] Step 6.5: Run the new test.

```bash
node --test tests/codewiki-structure.test.cjs
```

## Task 7: Optional Config Schema Work

Phase 1 can document `codewiki` config without fully wiring it into runtime config loading. If the existing config loader rejects unknown top-level keys, this task becomes required.

**Files to inspect first:**

- `sdk/src/config.ts`
- `get-shit-done/bin/lib/config.cjs`
- existing config tests

- [x] Step 7.1: Verify whether unknown `codewiki` config is preserved.
- [x] Step 7.2: Add `codewiki` defaults if required. Not required for Phase 1; SDK CodeWiki handlers read optional `codewiki` values directly and default to `code-wiki`.
- [x] Step 7.3: Add tests for default config materialization if required. Not required until config materialization owns CodeWiki defaults.

## Task 8: Manual Acceptance Pass

Create a temporary fixture workspace with two Git repos:

```text
tmp-codewiki-workspace/
  checkout-web/
  checkout-api/
```

- [x] Step 8.1: Run `/gsd-codewiki-init --set checkout-platform__test --repos checkout-web,checkout-api`.
- [x] Step 8.2: Confirm `wiki-index.yaml` exists.
- [x] Step 8.3: Confirm both repo manifests exist.
- [x] Step 8.4: Confirm `wiki-set.yaml` exists and records both commits.
- [x] Step 8.5: Change one repo and run `/gsd-codewiki-status --set checkout-platform__test`.
- [x] Step 8.6: Confirm status is `set-stale`.
- [x] Step 8.7: Run `/gsd-codewiki-update --set checkout-platform__test --phase 1 --prepare-only`, resolve maintainer tasks, then run `codewiki.verify --maintenance-only`.
- [x] Step 8.8: Confirm repo manifest and set tuple advance only after `--promote-only` passes verified maintenance.

---

## Out Of Scope For Phase 1

- Automatic hook from `/gsd-execute-phase`.
- Automatic milestone freeze from `/gsd-complete-milestone`.
- DeepWiki runner integration.
- Repomix packaging integration.
- `.planning/codebase/` projection from CodeWiki.
- Localized documentation.

---

## Phase 2 Preview

Phase 1 prompt/workflow surface is now backed by SDK lifecycle handlers for:

- `codewiki.init`
- `codewiki.select`
- `codewiki.status`
- `codewiki.project`
- `codewiki.index`
- `codewiki.contract`
- `codewiki.flow`
- `codewiki.verify`
- `codewiki.update`
- `codewiki.freeze`

Next work should focus on integrating this lifecycle into normal Bebop execution, improving semantic wiki updates, and hardening SDK coverage.

### Next Work Backlog

1. Wire CodeWiki gates into normal Bebop flows. Done.
   - [x] Add optional freshness warning before `/gsd-plan-phase` when `codewiki.require_fresh_before_plan` is true.
   - [x] Add milestone-close freshness enforcement using `codewiki.require_fresh_before_milestone_close`.
   - [x] Add `/gsd-complete-milestone` handoff to `codewiki.status` and `codewiki.freeze`.

2. Integrate post-change CodeWiki maintenance. Done for workflow handoff; semantic wiki edits remain agent-owned.
   - [x] After successful phase verification, optionally run `/gsd-codewiki-status`.
   - [x] When stale, hand off to `/gsd-codewiki-update`, whose workflow spawns `gsd-codewiki-maintainer` before `codewiki.update` promotes manifests.
   - [x] Keep SDK `codewiki.update` as mechanical manifest/index/snapshot promotion, not semantic documentation generation.
   - [x] Add `/gsd-codewiki-verify` to mechanically verify task completion, evidence paths, updated files, and blocked queues after maintainer work.

3. Harden SDK test and golden policy coverage.
   - [x] Add or update golden-policy exceptions for SDK-only `codewiki.*` handlers.
   - [x] Run SDK unit tests in a normal Node environment where Vitest native Rollup bindings load correctly.
   - [x] Keep the compiled-JS smoke tests for repo/set init, update, freeze, select, status, projection, intel indexing, and maintenance verification.

4. Add seed-source integrations.
   - [x] Add optional DeepWiki import as seed material only.
   - [x] Add optional Repomix packing discovery for large repo context.
   - [x] Ensure generated claims still require source evidence in wiki files.

5. Add projections and indexing.
   - [x] Project selected CodeWiki summaries into `.planning/codebase/` when configured.
   - [x] Optionally index CodeWiki summaries into `.planning/intel/`.
   - Keep projections disposable; Git commit and CodeWiki manifests remain authoritative.

6. Improve multi-repo ergonomics.
   - [x] Support workspace metadata discovery for member repos beyond explicit `--repos`.
   - [x] Add better per-repo roles (`frontend`, `backend`, `shared-library`, etc.).
   - [x] Add cross-repo contract and flow update helpers.

## Definition Of Done

Phase 1 is done when:

- all command, workflow, agent, template, and doc files exist
- structural tests pass
- a manual two-repo fixture can initialize, select, report stale status, and freeze a set
- no existing Bebop behavior changes when `codewiki.enabled` is false
- the design spec and implementation plan agree on command names, states, and manifest fields

## Verification Log

2026-04-29:

- `node --test tests/codewiki-structure.test.cjs tests/inventory-counts.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 211 tests.
- `sdk/node_modules/.bin/tsc --noEmit` passed.
- `sdk/node_modules/.bin/tsc` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for `codewiki.init --set` member discovery from `sub_repos` and `WORKSPACE.md`, followed by `codewiki.select` returning `set-current`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` is blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors; run in a normal Node environment after reinstalling dependencies.

2026-04-29 projection follow-up:

- `node --test tests/codewiki-structure.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 218 tests.
- `sdk/node_modules/.bin/tsc --noEmit` passed.
- `sdk/node_modules/.bin/tsc` passed.
- Compiled-JS smoke passed for repo and set `codewiki.project`, including `.planning/codebase/codewiki-summary.md` generation and `set-current` selection.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors.

2026-04-29 intel indexing follow-up:

- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 276 tests.
- `sdk/node_modules/.bin/tsc --noEmit` passed.
- `sdk/node_modules/.bin/tsc` passed.
- Compiled-JS smoke passed for repo and set `codewiki.index`, including `.planning/intel/codewiki.json` generation and `intel.query` finding the repo record.

2026-04-29 multi-repo role inference follow-up:

- Added conservative initialization-time role inference for CodeWiki set members: `frontend`, `backend`, `shared-library`, `service`, `worker`, and `docs`.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 276 tests.
- Compiled-JS smoke passed for three repos, producing `api:backend,payment-sdk:shared-library,web:frontend` and writing matching roles into `wiki-set.yaml`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-04-29 cross-repo helper follow-up:

- Added `/gsd-codewiki-contract` and `/gsd-codewiki-flow` plus SDK handlers `codewiki.contract` and `codewiki.flow`.
- Helpers create or reuse blocked set-level docs under `cross-repo/contracts/` and `cross-repo/flows/`, validate repo IDs against the set, and register docs in `wiki-set.yaml`.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 287 tests.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for a two-repo set, registering `checkout-session-api` and `create-checkout-session` into `wiki-set.yaml` and `codewiki.status` `cross_repo`.
- Compiled-JS registry smoke passed for dotted and space aliases: `codewiki.flow` and `codewiki contract`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-04-29 seed-source discovery follow-up:

- Added `codewiki.update` discovery for DeepWiki and Repomix seed files in repo CodeWiki namespaces.
- Update snapshots and JSON output now record seed source kind, path, size, timestamp, and `evidence: false`; seed files never advance freshness by themselves.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 287 tests.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for repo `codewiki.update` with both `deepwiki-export/deepwiki.md` and `repomix-output.xml`, producing `app:deepwiki,repomix`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-04-30 maintenance-plan follow-up:

- Added per-repo `coder-llm-wiki/00-meta/maintenance-plan.json` generation during `codewiki.update`.
- The plan records changed files, classifications, repo doc targets, set-level contract/flow candidates, pending task items, seed policy, and required evidence for `gsd-codewiki-maintainer`.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 287 tests.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for set `codewiki.update`, producing `api:cross-repo/contracts/,cross-repo/flows/` in `maintenance-plan.json`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-04-30 maintenance-plan task follow-up:

- Added explicit `tasks[]` generation to `coder-llm-wiki/00-meta/maintenance-plan.json` so agent-owned semantic wiki edits can be tracked as discrete pending repo/set work items.
- Repo tasks include target path, reason, classifications, changed source files, seed sources, required evidence, and completion writes to `progress.json` or `task-queue.json`.
- Set tasks cover cross-repo contracts and flows, require cross-repo evidence, and point completion output at `code-wiki/sets/<set-id>/cross-repo/`.
- Updated `gsd-codewiki-maintainer` and `/gsd-codewiki-update` docs so task completion is source-backed and blocked items are recorded instead of silently skipped.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 287 tests.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for task generation, producing repo tasks for `coder-llm-wiki/04-flows/`, `coder-llm-wiki/02-index/`, `coder-llm-wiki/08-evidence/`, `coder-llm-wiki/09-review/`, plus set tasks for `cross-repo/contracts/` and `cross-repo/flows/`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-04-30 maintenance verification follow-up:

- Added `/gsd-codewiki-verify`, workflow `codewiki-verify.md`, SDK handler `codewiki.verify`, query docs, inventory rows, and golden-policy exception.
- `codewiki.verify` reads `maintenance-plan.json`, `progress.json`, and `task-queue.json` for every selected member, then reports completed, blocked, unresolved, and invalid tasks.
- Completed tasks must include source evidence paths and updated wiki files; blocked tasks must include reasons; unresolved, conflicting, invalid, blocked, or stale selections fail the verification gate.
- Verification rejects DeepWiki and Repomix seed files as final evidence and requires multi-member evidence for set-level cross-repo tasks.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `node --test tests/codewiki-structure.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 241 tests.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 293 tests.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for `codewiki.verify`, producing `false->true; tasks=2; completed=2` after writing source-backed `progress.json`.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-04-30 freeze verification gate follow-up:

- Added `codewiki.require_verified_before_milestone_close` to the config schema and docs.
- `/gsd-complete-milestone` now runs `codewiki.verify` when CodeWiki is enabled and the verification gate is active, and passes `--require-verified` into milestone freeze.
- `/gsd-codewiki-freeze` now verifies maintenance tasks before freezing and documents `--allow-unverified` as the explicit release-risk override.
- SDK `codewiki.freeze` supports `--require-verified` and blocks unresolved or invalid maintenance tasks unless `--allow-unverified` is also present.
- `codewiki.verify` treats a missing `maintenance-plan.json` as no available task plan with a warning, so fresh namespaces with no maintenance tasks can still be frozen under the verification gate.
- `sdk/node_modules/.bin/tsc --noEmit -p sdk/tsconfig.json` passed.
- `cd sdk && ./node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types vitest src/query/codewiki.test.ts` passed.
- `node --test tests/codewiki-structure.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs` passed: 80 tests.
- `sdk/node_modules/.bin/tsc -p sdk/tsconfig.json` passed and refreshed compiled SDK output locally.
- Compiled-JS smoke passed for freeze verification gate, producing `false:true -> true:true` for blocked `--require-verified` followed by acknowledged `--allow-unverified`.
- `node --test tests/codewiki-structure.test.cjs tests/intel.test.cjs tests/config-schema-docs-parity.test.cjs tests/config-field-docs.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs tests/commands-doc-parity.test.cjs tests/agents-doc-parity.test.cjs tests/frontmatter.test.cjs` passed: 293 tests.
- `sdk/node_modules/.bin/vitest run src/query/codewiki.test.ts` remains blocked in this macOS Codex environment by Rollup native optional dependency code-signing / loading errors before tests execute.

2026-05-03 stage-completion review follow-up:

- `npm --prefix sdk test -- src/query/codewiki.test.ts src/query/init.test.ts src/query/config-mutation.test.ts src/query/intel.test.ts --testTimeout=30000` passed: 111 tests.
- `node --test tests/codewiki-structure.test.cjs tests/config-schema-docs-parity.test.cjs tests/agent-frontmatter.test.cjs` passed: 261 tests.
- `npm test` passed: 5222 tests.
- Manual temporary two-repo workspace smoke passed: `codewiki.init --set` created `wiki-index.yaml`, two repo manifests, and `wiki-set.yaml`; after a phase-scoped repo change, `codewiki.status --set` returned `set-stale`; `codewiki.update --prepare-only` plus source-backed task records passed `codewiki.verify --maintenance-only`; `codewiki.update --promote-only` advanced the changed repo manifest and set tuple; `codewiki.status --set` returned `set-current`; `codewiki.freeze v-smoke --set` returned `frozen=true`.
