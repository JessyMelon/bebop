<purpose>
Apply confirmed human review answers to durable repo CodeWiki pages.

This workflow reads a selected repo wiki, `09-review/human-review.md`, `09-review/open-questions.md`, source/config evidence, and existing durable CodeWiki pages. It promotes only confirmed human answers into the affected `coder-llm-wiki/01-*` through `08-*` pages, while preserving source evidence and clearly marking human-confirmed facts. It does not modify business code and must not promote repo or set manifests.
</purpose>

<available_agent_types>
- gsd-codewiki-maintainer - Maintains source-backed CodeWiki namespaces and multi-repo CodeWiki sets, including applying confirmed human review answers.
</available_agent_types>

<process>

## Step 1: Parse arguments

Parse `$ARGUMENTS`:

- `<repo-id>`: required target member repo ID, for example `service-slb-controller`
- `--set <set-id>`: optional multi-repo set ID. If omitted, use `codewiki.active_set` from `.planning/config.json` when present.
- `--dry-run`: optional. Report the planned durable wiki changes without writing files.

Set:

- `DRY_RUN = true` when `--dry-run` is present.

If `<repo-id>` is missing, stop and show:

```text
Usage: /gsd-codewiki-apply-review <repo-id> [--set <set-id>] [--dry-run]
```

## Step 2: Load config and language

Read `.planning/config.json` when present.

Record:

- `response_language`
- `codewiki.root`
- `codewiki.active_set`
- `codewiki.evidence_policy`

If `response_language` is set, all generated CodeWiki prose, review notes, progress summaries, task queue reasons, and user-facing reports MUST be written in that language. Keep code, commands, file paths, config keys, package names, protocol names, service names, Git refs, and quoted source identifiers unchanged.

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
- the target wiki directory does not exist
- the selected manifest or set is frozen

If the target repo state is stale or dirty, continue only after reporting that the applied review answers will document the current wiki namespace, not silently refresh source freshness or promote manifests.

## Step 4: Read review and wiki context

Read the target repo wiki state:

- target `manifest.yaml`
- selected `wiki-set.yaml` when present
- `code-wiki/wiki-index.yaml`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`
- `coder-llm-wiki/09-review/human-review.md`
- `coder-llm-wiki/09-review/open-questions.md`
- all repo-level CodeWiki pages under `coder-llm-wiki/01-*` through `coder-llm-wiki/08-*`

Read source/config files cited by the review evidence paths and affected wiki pages. Source/config evidence remains authoritative for source-backed facts; human answers can supply business context, ownership decisions, operational policy, rollout conventions, and historical rationale that source files cannot prove.

## Step 5: Extract confirmed answers

Extract only confirmed human answers from `coder-llm-wiki/09-review/human-review.md`.

Treat an item as confirmed when it has an explicit answer label such as:

- `Maintainer answer:`
- `Human answer:`
- `Answer:`
- `维护人回答：`
- `人工回答：`
- `人工确认：`

Do not apply:

- unanswered questions
- skipped questions
- questions marked pending
- model suggestions without a human answer label
- answers that contradict source/config evidence unless the contradiction is preserved as a review note or blocked task

For each confirmed answer, capture:

- original question text
- priority and category when present
- affected wiki path when present
- evidence paths
- answer text
- answer source, using `human-review.md` as the review source and preserving any timestamp already recorded

If no confirmed answers are found, report `Applied: none` and recommend running `/gsd-codewiki-review <repo-id> --set <set-id> --interactive`.

## Step 6: Map answers to durable wiki pages

For each confirmed answer:

1. Prefer the `wiki_path` or affected wiki path recorded in the review item.
2. If the review item has no path, infer the target page only when the mapping is obvious from category and existing pages:
   - `operations` or `operational-policy` -> `coder-llm-wiki/06-ops/`
   - `config` or `config-semantics` -> `coder-llm-wiki/06-ops/`
   - `contracts` or `cross-repo-contract` -> an existing set-level `cross-repo/contracts/` page when the item references a CodeWiki set contract, otherwise the closest existing repo page under `coder-llm-wiki/04-flows/` or `coder-llm-wiki/05-data/`
   - `business-context` or `ownership-decision` -> the page that made the original claim
3. If the target page is still ambiguous, do not guess. Add or update a blocked task in `coder-llm-wiki/00-meta/task-queue.json`.

Only update existing durable wiki pages or clearly relevant pages under `coder-llm-wiki/01-*` through `08-*`. Do not create broad new pages when a focused edit to an existing page is sufficient.

## Step 7: Apply confirmed answers

Skip this step when `DRY_RUN` is true; report the planned edits instead.

For each mapped answer:

- Update only the affected section of the target durable wiki page.
- Prefer incremental edits over full rewrites.
- Mark human-sourced content explicitly with `Human-confirmed` or a localized equivalent.
- Keep source-backed facts separate from human-confirmed context.
- Preserve existing source/config evidence paths.
- Add new evidence paths only when the human answer provides a source/config path that exists.
- Do not convert human context into source-backed fact unless source/config evidence was read and cited.
- Do not remove open questions that were not answered and applied.
- Do not modify repo manifests, set manifests, source files, generated package metadata, or unrelated wiki pages.

Recommended durable page pattern:

```markdown
### Human-confirmed context

- [YYYY-MM-DD] <answer summary>
  - Review source: `coder-llm-wiki/09-review/human-review.md`
  - Evidence: `<source/config path>` or `human-confirmed operational policy`
```

Use a more specific section name when the target page already has a better local structure.

## Step 8: Resolve review questions and task records

When an answer was successfully applied:

- Remove the matching unanswered Markdown list item from `coder-llm-wiki/09-review/open-questions.md`.
- If preserving answered history in `open-questions.md` is necessary, do not format it as a `- ` or `* ` Markdown list item because CodeWiki status treats Markdown list items in that file as open questions.
- Append a completed apply-review record to `coder-llm-wiki/00-meta/progress.json` with:
  - `task_id`
  - `task_type: "apply-review"`
  - `target_path`
  - `review_source: "coder-llm-wiki/09-review/human-review.md"`
  - `evidence_paths`
  - `updated_files`
  - `answer_source: "human-confirmed review answer"`
- Remove or mark resolved any matching blocked review task in `coder-llm-wiki/00-meta/task-queue.json`.

When an answer cannot be safely applied:

- Keep the question pending in `open-questions.md`.
- Add or update a blocked task in `task-queue.json` with `task_type: "apply-review"`, `target_path` when known, `source_files`, and the concrete reason.

## Step 9: Spawn maintainer or apply sequentially

If the runtime has a `Task` tool, spawn `gsd-codewiki-maintainer` with:

```text
Task(
  subagent_type="gsd-codewiki-maintainer",
  description="Apply CodeWiki review answers for <repo-id>",
  prompt="
Mode: apply-review
Target repo: <repo-id>
Set: <set-id>
Dry run: yes|no
Response language: <response_language>

Apply confirmed human review answers from the target repo CodeWiki into durable repo-level CodeWiki pages.
This is NOT human-review question discovery, NOT baseline enrichment, and NOT Git-diff maintenance.

Required reads:
- .planning/config.json
- code-wiki/wiki-index.yaml
- code-wiki/sets/<set-id>/wiki-set.yaml
- target manifest.yaml
- target coder-llm-wiki/00-meta/progress.json
- target coder-llm-wiki/00-meta/task-queue.json
- target coder-llm-wiki/09-review/human-review.md
- target coder-llm-wiki/09-review/open-questions.md
- target repo CodeWiki pages under 01-* through 08-*
- source/config files cited by the review evidence paths

Write targets when Dry run is no:
- affected repo-level CodeWiki pages under coder-llm-wiki/01-* through 08-*
- coder-llm-wiki/09-review/open-questions.md
- coder-llm-wiki/00-meta/progress.json
- coder-llm-wiki/00-meta/task-queue.json only for blocked apply-review items

Rules:
- Write prose in response_language when set.
- Keep code, commands, file paths, config keys, service names, Git refs, and source identifiers unchanged.
- Apply only explicit human-confirmed answers from human-review.md.
- Mark applied content as Human-confirmed or localized equivalent.
- Preserve source/config evidence paths.
- Do not turn human context into source-backed fact unless source/config evidence supports it.
- Do not modify business code.
- Do not modify repo manifests or set manifests.
- Do not full-rewrite durable wiki pages.
- Do not update unrelated wiki pages.
- Return a concise apply report.
"
)
```

If `Task` is unavailable, perform the same apply-review process sequentially in the current context. Do not use browser tools for source analysis.

## Step 10: Quality checks

Verify:

- every updated durable wiki page still separates source-backed facts, human-confirmed context, and open questions
- every source/config evidence path exists
- every applied human answer has a review source reference
- answered questions were removed from `open-questions.md` only after successful application
- `progress.json` records completed apply-review tasks
- `task-queue.json` records blocked apply-review tasks when application was unsafe
- no business source files changed
- no `manifest.yaml` or `wiki-set.yaml` changed

Then run:

```bash
gsd-sdk query codewiki.verify --set <set-id>
```

If verification returns `verified=false`, resolve invalid task records or report the blocked queue clearly. Do not run `gsd-sdk query codewiki.update`; this workflow must not promote manifests or set tuples.

## Step 11: Report

Output:

```text
GSD > CODEWIKI APPLY REVIEW

Repo:
  <repo-id>

Applied:
  - <question summary> -> <wiki file>

Blocked:
  - <question summary> - <reason or none>

Review questions resolved:
  <count>

Updated:
  - <wiki file>
  - coder-llm-wiki/09-review/open-questions.md
  - coder-llm-wiki/00-meta/progress.json

Verified:
  yes|no

Dry run:
  yes|no

Next:
  /gsd-codewiki-status --set <set-id>
```

If all repo review answers in the set have been applied, recommend set-level closure with `/gsd-codewiki-status --set <set-id>` followed by `/gsd-codewiki-verify --set <set-id>`.

</process>
