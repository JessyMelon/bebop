<purpose>
Run the full `coder-llm-wiki` repository analysis workflow inside an existing repo CodeWiki namespace.

This workflow is for deep initial CodeWiki construction. It is stricter and broader than `/gsd-codewiki-enrich`: it can collect an optional code-agent seed, applies explicit source-scope exclusions, then executes `/wiki-init`, `/wiki-inventory`, `/wiki-index`, module queue preparation, module and flow analysis, review, and snapshot/status refresh. DeepWiki, Repomix, and code-agent outputs may be read as navigation seeds only; durable facts require source/config/test/script evidence.
</purpose>

<available_agent_types>
- gsd-codewiki-maintainer - Maintains source-backed CodeWiki namespaces and can run `coder-llm-wiki` bootstrap batches.
</available_agent_types>

<process>

## Step 1: Parse arguments

Parse `$ARGUMENTS`:

- `<repo-id>`: required target member repo ID.
- `--set <set-id>`: optional multi-repo set ID. If omitted, use `codewiki.active_set` from `.planning/config.json` when present.
- `--max-auto-steps <n>`: optional automatic task limit. Default `20`.
- `--allow-dirty`: allow bootstrap to document current dirty local edits. Without this flag, dirty repo state is a hard stop.
- `--agent-seed <auto|none|codex|opencode|claude-code>`: optional code-agent seed provider. Default `auto`. Seed output is navigation context only, never final evidence.
- `--agent-seed-depth <quick|full>`: optional seed depth. Default `quick`. Use `full` to write a structured seed analysis directory under `coder-llm-wiki/11-agent-seeds/`.
- `--agent-seed-dir <path>`: optional existing code-agent seed file or directory to import as seed-only context.
- `--exclude-path <glob>`: optional source path exclusion, repeatable. Patterns are relative to the target source repo root and are treated as out-of-scope for inventory, index, module analysis, flow analysis, and final evidence.
- `--exclude-file <path>`: optional JSON source-scope file. If omitted, read `coder-llm-wiki/00-meta/source-scope.json` when present.

If `<repo-id>` is missing, stop and show:

```text
Usage: /gsd-codewiki-bootstrap <repo-id> [--set <set-id>] [--max-auto-steps <n>] [--allow-dirty] [--agent-seed auto|none|codex|opencode|claude-code] [--agent-seed-depth quick|full] [--agent-seed-dir <path>] [--exclude-path <glob>]... [--exclude-file <path>]
```

## Step 2: Load config and select namespace

Read `.planning/config.json` when present and record:

- `response_language`
- `codewiki.root`
- `codewiki.active_set`
- `codewiki.evidence_policy`

If `response_language` is absent, use Chinese (`zh-CN`) for durable CodeWiki Markdown pages, template-filled prose, review notes, dashboard text, progress summaries, and the final confirmation. Keep code, commands, file paths, config keys, package names, protocol names, service names, and source identifiers unchanged.

Prefer SDK status for authoritative paths and freshness:

```bash
gsd-sdk query codewiki.status --set <set-id>
```

Use the JSON result to find the target member by `repo_id`.

If SDK status is unavailable, manually read:

- `code-wiki/wiki-index.yaml`
- `code-wiki/sets/<set-id>/wiki-set.yaml` when a set is active
- target repo `manifest.yaml`

Stop if:

- the selected set or repo namespace is missing; recommend `/gsd-codewiki-init`
- `<repo-id>` is not a member of the set
- the selected manifest or set is frozen
- the target repo is dirty and `--allow-dirty` was not provided

## Step 3: Verify coder-llm-wiki contract presence

The target namespace must contain `coder-llm-wiki/` and at least these files:

- `coder-llm-wiki/README.md`
- `coder-llm-wiki/00-meta/project-charter.md`
- `coder-llm-wiki/00-meta/workflow-contract.md`
- `coder-llm-wiki/00-meta/quality-gates.md`
- `coder-llm-wiki/00-meta/command-contract.md`
- `coder-llm-wiki/00-meta/review-rubric.md`
- `coder-llm-wiki/00-meta/snapshot-format.md`
- `coder-llm-wiki/00-meta/status-dashboard.md`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`

If the contract files are missing, repair the namespace from the scaffold created by `/gsd-codewiki-init` when possible. If repair is not possible, stop and recommend rerunning `/gsd-codewiki-init`.

## Step 4: Read bootstrap context

Read:

- target `manifest.yaml`
- selected `wiki-set.yaml` when present
- `code-wiki/wiki-index.yaml`
- every required `coder-llm-wiki/00-meta/` contract listed in Step 3
- `coder-llm-wiki/00-meta/agent-seeds.json` when present
- `coder-llm-wiki/00-meta/source-scope.json` when present, or the file provided by `--exclude-file`
- latest repo snapshot when present
- `coder-llm-wiki/11-agent-seeds/*` when present
- `coder-llm-wiki/09-review/open-questions.md`
- `coder-llm-wiki/09-review/human-review.md`
- optional seed sources:
  - `deepwiki-export/deepwiki.md`
  - `repomix-output.xml`, `repomix-output.md`, or files under `repomix/`
  - paths provided by `--agent-seed-dir`

Seed sources are context only. They can help pick reading order, but they cannot appear as final `evidence_paths` for completed tasks. Use `seed_paths` for seed provenance.

## Step 4.25: Resolve source scope

Build the effective source scope before reading repository implementation files:

- Start with the full target source repo.
- Apply exclusions from `coder-llm-wiki/00-meta/source-scope.json` when present.
- Apply exclusions from `--exclude-file <path>` when provided. This can be an absolute path, a workspace-relative path, or a path relative to the selected CodeWiki namespace.
- Apply every `--exclude-path <glob>` argument.
- In JSON scope files, active exclusions come from `exclude_paths[]` and `exclusions[].pattern`; ignore `example_exclusion`.
- Normalize exclusion patterns as repo-root-relative globs such as `legacy/**`, `deprecated/**`, `src/old/**`, or `**/generated/**`.
- Record the effective exclusions in `progress.json.execution.source_scope.exclude_paths`.
- Record the source-scope file path in `progress.json.execution.source_scope.exclude_file` when used.

Excluded paths are out of scope:

- Do not traverse them for inventory, index, module analysis, flow analysis, or evidence collection.
- Do not create module or flow tasks whose `source_files` are inside excluded paths.
- Do not write excluded paths into completed task `evidence_paths`.
- If an excluded path appears relevant because live code references it, record an Open Question and an `out-of-scope` task instead of analyzing it silently.
- It is acceptable to mention excluded paths in inventory as “已排除/不在分析范围”, with the exclusion reason when available.

## Step 4.5: Prepare optional code-agent seed

Treat the code-agent seed phase as optional and non-blocking:

- If `--agent-seed none` is provided, skip seed generation and record the skip in `progress.json.execution.agent_seed` when practical.
- If `--agent-seed-dir <path>` points to an existing file or directory, import or reference those files as seed-only context and record them in `coder-llm-wiki/00-meta/agent-seeds.json`.
- If `--agent-seed auto` is provided, resolve only the agent that is actually available in the current runtime. Prefer the current runtime provider when identifiable (`opencode`, `claude-code`, or `codex`). If no supported provider is available, set the resolved provider to `none` and continue bootstrap without blocking.
- If `--agent-seed codex|opencode|claude-code` is provided but that provider is not available non-interactively, record `status=skipped` or `status=blocked` with the reason, then continue if source-backed bootstrap can still proceed.
- If `--agent-seed-depth` is omitted, use `quick`.
- Do not launch interactive external CLIs unless the runtime explicitly supports non-interactive execution for the selected provider.

When a quick seed is generated or imported, write a single concise file under:

- `coder-llm-wiki/11-agent-seeds/<provider>-<yyyy-mm-dd>-<batch-id>.md`

The quick seed document should be concise and structured:

- 候选架构结论
- 候选数据流
- 候选设计约束
- 候选源码文件
- 建议 module / flow / risk 任务
- Open Questions

When a full seed is generated or imported, write a structured seed directory under:

- `coder-llm-wiki/11-agent-seeds/<provider>-analysis-<yyyy-mm-dd>-<batch-id>/`

The full seed directory must contain:

- `README.md` - provider, depth, status, source commit, scope exclusions, and seed-only warning.
- `architecture.md` - candidate components, package boundaries, entrypoints, and dependencies.
- `data-flow.md` - candidate request/event flows, state changes, external calls, failure paths, and async paths.
- `design-notes.md` - candidate design patterns, conventions, coupling points, risks, and likely invariants.
- `candidate-modules.md` - prioritized module tasks with concrete non-excluded `source_files`.
- `candidate-flows.md` - prioritized flow tasks with concrete non-excluded `source_files`.
- `open-questions.md` - questions that require source follow-up or human confirmation.

Full seed pages should be useful for later analysis but must still mark facts, inferences, and open questions separately. Keep every durable-looking claim tied to candidate source paths, and state that the page is seed-only until validated by module/flow evidence.

Update `coder-llm-wiki/00-meta/agent-seeds.json` with provider, depth, status, path or root directory, source paths, timestamp, and `evidence=false`. Seed-derived queue items may be added only when they include concrete `source_files`; record seed provenance in `seed_paths`, never in `evidence_paths`.

## Step 5: Spawn maintainer or run sequentially

If the runtime has a `Task` tool, spawn `gsd-codewiki-maintainer` with:

```text
Task(
  subagent_type="gsd-codewiki-maintainer",
  description="Bootstrap coder-llm-wiki for <repo-id>",
  prompt="
Mode: coder-llm-wiki-bootstrap
Target repo: <repo-id>
Set: <set-id or none>
Response language: <response_language>
Max auto steps: <max-auto-steps>
Allow dirty: <true|false>
Agent seed requested: <agent-seed>
Agent seed depth: <agent-seed-depth>
Agent seed dir: <agent-seed-dir or none>
Exclude paths: <exclude-path globs or none>
Exclude file: <exclude-file or default source-scope.json or none>

Run a full source-backed `coder-llm-wiki` bootstrap batch inside the selected repo namespace.
This is NOT free-form summarization and NOT manifest promotion.

Required reads:
- .planning/config.json when present
- code-wiki/wiki-index.yaml
- code-wiki/sets/<set-id>/wiki-set.yaml when present
- target manifest.yaml
- target coder-llm-wiki/README.md
- target coder-llm-wiki/00-meta/project-charter.md
- target coder-llm-wiki/00-meta/workflow-contract.md
- target coder-llm-wiki/00-meta/quality-gates.md
- target coder-llm-wiki/00-meta/command-contract.md
- target coder-llm-wiki/00-meta/review-rubric.md
- target coder-llm-wiki/00-meta/snapshot-format.md
- target coder-llm-wiki/00-meta/status-dashboard.md
- target coder-llm-wiki/00-meta/agent-seeds.json when present
- target coder-llm-wiki/00-meta/source-scope.json when present
- target coder-llm-wiki/00-meta/progress.json
- target coder-llm-wiki/00-meta/task-queue.json
- latest target coder-llm-wiki/10-snapshots/* when present
- target coder-llm-wiki/11-agent-seeds/* when present
- target source/config/test/script files needed for evidence
- optional DeepWiki, Repomix, or code-agent seed files as navigation only

Execution policy:
- Set progress.json.execution.mode=unattended.
- Set progress.json.execution.ask_for_confirmation=false.
- Set progress.json.execution.block_on_human_review=false.
- Set progress.json.execution.max_auto_steps=<max-auto-steps>.
- Set progress.json.execution.agent_seed.enabled according to Agent seed requested.
- Set progress.json.execution.agent_seed.requested_provider=<agent-seed>.
- Set progress.json.execution.agent_seed.depth=<agent-seed-depth>.
- Set progress.json.execution.agent_seed.resolved_provider to the available provider or none.
- Set progress.json.execution.agent_seed.status to generated, imported, skipped, blocked, or not_run.
- Set progress.json.execution.agent_seed.seed_paths to generated/imported seed paths.
- Set progress.json.execution.source_scope.exclude_paths to the effective repo-root-relative exclude globs.
- Set progress.json.execution.source_scope.exclude_file to the resolved exclude file path or null.
- Set progress.json.execution.source_scope.allow_excluded_evidence=false unless the user explicitly overrides this in a future workflow.
- Never use excluded paths for inventory/index/module/flow source reads or completed task evidence_paths.
- If human context is needed, write it to coder-llm-wiki/09-review/human-review.md and keep working unless reliability is blocked.
- Only mark blocked for missing required files, unreadable source, frozen namespace, disallowed dirty state, unresolvable state conflict, or evidence gaps that would make the output unreliable.

Required phase progression:
1. Execute `/wiki-init`.
2. Resolve `/wiki-source-scope` from source-scope.json, --exclude-file, and --exclude-path arguments.
3. Execute `/wiki-agent-seed` when a seed provider or import path is available; otherwise record a non-blocking skip.
4. Execute `/wiki-inventory` unless current inventory already passes gates.
5. Execute `/wiki-index` unless current index already passes gates.
6. Prepare module queue from inventory/index if module tasks are missing.
7. Complete at least 2 high-value module tasks or at least 1 high-value flow task within max auto steps.
8. If flow tasks are missing, create at least one from entrypoints/modules/test-map before flow analysis when feasible.
9. Execute `/wiki-review`.
10. Refresh status dashboard.
11. Write a new snapshot and update progress.json.last_snapshot.

Write targets:
- coder-llm-wiki/11-agent-seeds/*
- coder-llm-wiki/01-inventory/*
- coder-llm-wiki/02-index/*
- coder-llm-wiki/03-modules/*
- coder-llm-wiki/04-flows/*
- coder-llm-wiki/08-evidence/*
- coder-llm-wiki/09-review/*
- coder-llm-wiki/10-snapshots/*
- coder-llm-wiki/00-meta/progress.json
- coder-llm-wiki/00-meta/task-queue.json
- coder-llm-wiki/00-meta/status-dashboard.md
- coder-llm-wiki/00-meta/agent-seeds.json
- coder-llm-wiki/00-meta/source-scope.json
- coder-llm-wiki/00-meta/maintenance-plan.json

Maintenance-plan rule:
- Write or update coder-llm-wiki/00-meta/maintenance-plan.json with only source-backed content tasks that this bootstrap batch attempted.
- Each completed task in progress.json.completed_tasks must include task_id, target_path, evidence_paths, and updated_files.
- Each blocked task in task-queue.json must include task_id or id, target_path, source_files, and reason.
- Do not use DeepWiki, Repomix, or code-agent seed paths as final evidence_paths.
- If a task was discovered from a seed, record the seed document under seed_paths and still cite real source/config/test/script files under evidence_paths before marking it done.
- If agent seed depth is `full`, include the full seed directory or the specific full seed page under `seed_paths`, not `evidence_paths`.
- Do not use excluded source paths as `source_files` or `evidence_paths`; if a planned task depends only on excluded paths, mark it `out-of-scope` with the exclusion reason.
- `out-of-scope` task-queue records must include `task_id` or `id`, `status: out-of-scope`, `target_path`, non-excluded context `source_files` when available, and `reason`. Keep them in review/status queues, but they are resolved by source-scope policy and should not make verification fail.

Return confirmation only.
"
)
```

If `Task` is unavailable, perform the same workflow sequentially in the current context. Do not use browser tools for source analysis.

## Step 6: Quality checks

Verify:

- `coder-llm-wiki/01-inventory/` and `02-index/` are populated from source/config/test evidence or explicitly recorded as incomplete.
- Completed module docs have corresponding `08-evidence/*.refs.md` and `09-review/*.questions.md`.
- Completed flow docs describe main path, failure paths, state changes, external calls, risks, tests, evidence, and open questions.
- Important claims cite source/config/test/script paths.
- Facts, inferences, and open questions are separated.
- `progress.json` records execution policy, phase, coverage, latest snapshot, and completed task records.
- `progress.json.execution.agent_seed` records requested provider, depth, resolved provider, status, and seed paths.
- `progress.json.execution.source_scope` records effective exclude paths and exclude file.
- `agent-seeds.json` records any imported/generated code-agent seed with `evidence=false`.
- `source-scope.json` records durable source-scope exclusions when maintained in the wiki.
- `task-queue.json` records pending/review-needed/blocked/out-of-scope tasks with reasons.
- `status-dashboard.md` reflects current phase, blockers, review queue, high-risk gaps, and next steps.
- a new snapshot exists under `coder-llm-wiki/10-snapshots/`.
- `maintenance-plan.json` tasks are resolved as completed, blocked, or out-of-scope.

Then run:

```bash
gsd-sdk query codewiki.verify --set <set-id>
```

If verification returns `verified=false`, resolve invalid task records when the evidence exists. If evidence is genuinely missing, report the blocked queue clearly and do not promote manifests. Do not convert explicit source-scope exclusions back into blocked work; use `out-of-scope` for those review-queue records.

## Step 7: Refresh projection

After bootstrap produces source-backed content, refresh the disposable planning projection:

```bash
gsd-sdk query codewiki.project --set <set-id>
```

If projection fails because the selected wiki is stale, report the warning and leave CodeWiki files intact.

## Step 8: Report

Output:

```text
GSD > CODEWIKI BOOTSTRAP

Repo:
  <repo-id>

Updated:
  - <wiki file>

Completed:
  - <task-id>

Blocked:
  - <task or none>

Verified:
  yes|no

Agent seed:
  <requested>/<resolved>/<depth>/<status>

Source scope:
  excluded=<n> file=<path or none>

Snapshot:
  <snapshot path>

Projected:
  .planning/codebase/codewiki-summary.md | not projected

Next:
  /gsd-codewiki-status --set <set-id>
```

</process>
