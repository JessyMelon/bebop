<purpose>
Enrich a repo CodeWiki baseline from existing `.planning/codebase/` documents and source-backed evidence.

This workflow fills durable repo-level `coder-llm-wiki/` pages for a selected repo without requiring a Git diff. It is intended for first-pass CodeWiki baseline creation after `/gsd-codewiki-init` and `/gsd-map-codebase`.
</purpose>

<available_agent_types>
- gsd-codewiki-maintainer - Maintains source-backed CodeWiki namespaces and multi-repo CodeWiki sets.
</available_agent_types>

<process>

## Step 1: Parse arguments

Parse `$ARGUMENTS`:

- `<repo-id>`: required target member repo ID, for example `service-slb-controller`
- `--set <set-id>`: optional multi-repo set ID. If omitted, use `codewiki.active_set` from `.planning/config.json` when present.
- `--pages <page,page>`: optional comma-separated page slugs to limit enrichment.
- `--profile <name>`: optional built-in enrichment profile. Supported profiles: `api-maintenance`.
- `--focus <text>`: optional natural-language focus for this enrichment run.
- `--sources <path,path>`: optional comma-separated priority source/config paths. Paths can be workspace-relative or target-repo-relative.

If `<repo-id>` is missing, stop and show:

```text
Usage: /gsd-codewiki-enrich <repo-id> [--set <set-id>] [--pages <page,page>] [--profile <name>] [--focus <text>] [--sources <path,path>]
```

If `--profile` is not one of the supported profiles, stop and show the supported profile list. If both `--pages` and `--profile` are present, `--pages` limits the final write targets while `--profile` still guides reading order and quality checks.

## Step 2: Load config and language

Read `.planning/config.json` when present.

Record:

- `response_language`
- `codewiki.root`
- `codewiki.active_set`
- `codewiki.evidence_policy`

If `response_language` is set, all generated CodeWiki Markdown, review notes, progress summaries, task queue reasons, snapshots, and user-facing reports MUST be written in that language. Keep code, commands, file paths, config keys, package names, protocol names, service names, Git refs, and quoted source identifiers unchanged.

## Step 3: Select CodeWiki set and repo

Prefer SDK status for authoritative freshness and paths:

```bash
gsd-sdk query codewiki.status --set <set-id>
```

Use the JSON result to find the target member by `repo_id`.

If SDK status is unavailable, manually read:

- `code-wiki/wiki-index.yaml`
- `code-wiki/sets/<set-id>/wiki-set.yaml`
- target repo `manifest.yaml`

Stop if:

- the selected set or repo namespace is missing; recommend `/gsd-codewiki-init`
- `<repo-id>` is not a member of the set
- the selected manifest or set is frozen

If the target repo state is stale or dirty, continue only after explicitly reporting the state and asking the user whether to proceed. Baseline enrichment may proceed for dirty workspaces only when the user confirms that local edits should be documented.

## Step 4: Read enrichment context

Read the target repo wiki state:

- target `manifest.yaml`
- selected `wiki-set.yaml` when present
- `code-wiki/wiki-index.yaml`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`
- latest repo snapshot
- `coder-llm-wiki/09-review/open-questions.md`

Read planning maps:

- `.planning/codebase/STACK.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/codewiki-summary.md` when present

Then read source files that support the target repo facts. Start with:

```bash
find <target-repo> -maxdepth 4 -type f \( -name 'README*' -o -name 'pom.xml' -o -name 'package.json' -o -name 'service.yml' -o -name 'product.yml' -o -name 'application-conf.yml' -o -name 'public.conf' -o -name 'docker.json' -o -name 'Dockerfile*' -o -name '*.fw.yml' \) | sort
```

If `--sources` is provided, verify each path exists and read those files before broader discovery. Use priority sources to guide evidence gathering, not as an exhaustive source list. Missing priority sources should be recorded in `coder-llm-wiki/09-review/open-questions.md` or `coder-llm-wiki/00-meta/task-queue.json` rather than guessed around.

For multi-repo claims, also read the referenced source/config files in the producer and consumer repos. Cross-repo claims require evidence from each participating repo.

## Step 5: Determine target pages

Create only pages that are relevant to the target repo. Use `--pages` as the final write-target limiter when present.

If `--profile api-maintenance` is provided, prefer these maintenance-oriented targets when evidence exists:

```text
coder-llm-wiki/02-index/request-entrypoints.md
coder-llm-wiki/03-modules/action-service-dao-sql-map.md
coder-llm-wiki/06-ops/config-loading-and-runtime-overrides.md
coder-llm-wiki/04-flows/core-api-flows.md
coder-llm-wiki/04-flows/runtime-contracts.md
coder-llm-wiki/06-ops/debugging-and-product-issue-playbook.md
```

For `api-maintenance`, prioritize facts useful for coding and product issue maintenance:

- request entrypoints, routing, interceptors, and dispatch rules
- Action to Service to DAO to SQL/data-store mappings
- API parameters, validation, error/result shapes, and compatibility risks
- configuration keys, load order, defaults, and runtime override sources
- cross-repo runtime contracts with image/package/deployment repos
- debugging entrypoints, logs, post-checks, monitors, and common failure triage

Unless `--pages` or `--profile` restricts the list, use these default repo-level targets when the evidence exists:

```text
coder-llm-wiki/01-inventory/service-role-map.md
coder-llm-wiki/02-index/application-runtime-map.md
coder-llm-wiki/06-ops/config-variable-contracts.md
coder-llm-wiki/06-ops/post-checks-and-monitors.md
coder-llm-wiki/04-flows/cross-repo-dependencies.md
```

For non-service repos, adapt page names to the repo evidence while keeping them under the closest existing category. Examples:

- `03-modules/module-map.md`
- `02-index/entrypoints.md`
- `06-ops/configuration.md`
- `04-flows/key-flows.md`
- `04-flows/dependencies.md`

Each generated page must include:

- scope and authority note
- source evidence table with real paths
- facts, inferences, and open questions separated
- changed or created date using the workflow date when available
- no unsupported claims

If `--focus` is provided, use it to choose reading order, target-page emphasis, and open-question wording. Do not treat focus text itself as evidence.

## Step 6: Spawn maintainer or enrich sequentially

If the runtime has a `Task` tool, spawn `gsd-codewiki-maintainer` with:

```text
Task(
  subagent_type="gsd-codewiki-maintainer",
  description="Enrich CodeWiki baseline for <repo-id>",
  prompt="
Mode: baseline-enrich
Target repo: <repo-id>
Set: <set-id>
Response language: <response_language>
Requested profile: <profile or none>
Requested focus: <focus or none>
Priority sources: <sources or none>

Create or update source-backed baseline CodeWiki pages for the target repo.
This is NOT a Git-diff update. Use .planning/codebase maps as seed context only; every durable claim must be re-validated against source/config files.
Use the requested profile/focus to choose write targets and reading order. When profile/focus conflicts with generic defaults, prefer profile/focus while preserving source-backed evidence requirements.

Required reads:
- .planning/config.json
- code-wiki/wiki-index.yaml
- code-wiki/sets/<set-id>/wiki-set.yaml
- target manifest.yaml
- target coder-llm-wiki/00-meta/progress.json
- target coder-llm-wiki/00-meta/task-queue.json
- target coder-llm-wiki/09-review/open-questions.md
- .planning/codebase/*.md
- priority sources from --sources, if present
- target repo source/config files needed for evidence
- cross-repo source/config files needed for cross-repo claims

Write targets:
- repo-level CodeWiki pages selected in Step 5
- coder-llm-wiki/09-review/open-questions.md
- coder-llm-wiki/00-meta/progress.json
- coder-llm-wiki/00-meta/task-queue.json if anything is blocked

Rules:
- Write prose in response_language when set.
- Keep code, commands, file paths, config keys, service names, Git refs, and source identifiers unchanged.
- Do not modify business code.
- Do not promote manifests.
- Return confirmation only.
"
)
```

If `Task` is unavailable, perform the same enrichment sequentially in the current context. Do not use browser tools for source analysis.

## Step 7: Quality checks

Verify:

- all written wiki files exist
- every important claim cites source/config evidence
- source paths in evidence tables exist
- requested profile/focus is reflected in page selection or recorded as blocked
- priority sources from `--sources` were read or recorded as missing/blocking
- cross-repo claims cite all participating repos
- tests are referenced honestly or marked absent
- open questions are recorded instead of guessed
- `progress.json` records completed enrichment tasks with `task_id`, `target_path`, `evidence_paths`, and `updated_files`
- `task-queue.json` records blocked enrichment tasks with `task_id`, `target_path`, `source_files`, and `reason`

Then run:

```bash
gsd-sdk query codewiki.verify --set <set-id>
```

If verification returns `verified=false`, resolve invalid task records or report the blocked queue clearly.

## Step 8: Refresh projection

After enrichment succeeds, refresh the disposable planning projection:

```bash
gsd-sdk query codewiki.project --set <set-id>
```

## Step 9: Report

Output:

```text
GSD > CODEWIKI ENRICH

Repo:
  <repo-id>

Profile:
  <profile or default>

Focus:
  <focus or none>

Updated:
  - <wiki file>

Blocked:
  - <task or none>

Verified:
  yes|no

Projected:
  .planning/codebase/codewiki-summary.md

Next:
  /gsd-codewiki-status --set <set-id>
```

</process>
