<purpose>
Produce human review questions for a repo CodeWiki.

This workflow inspects a selected repo wiki, set context, existing open questions, task queue records, planning maps, and source/config evidence. It identifies where machine-generated CodeWiki knowledge still needs human business context, ownership decisions, operational policy, or source evidence. It does not continue baseline enrichment and must not rewrite durable wiki pages unless `--write` is explicitly provided or `--interactive` is used without `--dry-run`.
</purpose>

<available_agent_types>
- gsd-codewiki-maintainer - Maintains source-backed CodeWiki namespaces and multi-repo CodeWiki sets, including review-only human-question discovery.
</available_agent_types>

<process>

## Step 1: Parse arguments

Parse `$ARGUMENTS`:

- `<repo-id>`: required target member repo ID, for example `service-slb-controller`
- `--set <set-id>`: optional multi-repo set ID. If omitted, use `codewiki.active_set` from `.planning/config.json` when present.
- `--scope <scope>`: optional review focus. Valid values are `all`, `business`, `contracts`, `operations`, and `config`. Default: `all`.
- `--write`: optional. Persist review notes to CodeWiki review files and blocked review tasks. Without this flag, the workflow is read-only.
- `--interactive`: optional. After producing the review questions, ask them one at a time in the current session. This implies write behavior unless `--dry-run` is present.
- `--dry-run`: optional. Suppress file writes even when `--interactive` is present. The final report must include collected answers but must not edit files.
- `--text`: optional. Use plain-text numbered prompts instead of `AskUserQuestion` or runtime-specific TUI prompts.

Set:

- `INTERACTIVE = true` when `--interactive` is present.
- `TEXT_MODE = true` when `--text` is present or `.planning/config.json` has `workflow.text_mode: true`.
- `WRITE_REVIEW = true` when `--write` is present or (`INTERACTIVE` is true and `--dry-run` is absent).
- `DRY_RUN = true` when `--dry-run` is present. `DRY_RUN` wins over `--write` and `--interactive`; when true, `WRITE_REVIEW = false`.

If `<repo-id>` is missing, stop and show:

```text
Usage: /gsd-codewiki-review <repo-id> [--set <set-id>] [--scope all|business|contracts|operations|config] [--write] [--interactive] [--dry-run] [--text]
```

## Step 2: Load config and language

Read `.planning/config.json` when present.

Record:

- `response_language`
- `codewiki.root`
- `codewiki.active_set`
- `codewiki.evidence_policy`

If `response_language` is set, all generated review questions, review notes, task queue reasons, and user-facing reports MUST be written in that language. Keep code, commands, file paths, config keys, package names, protocol names, service names, Git refs, and quoted source identifiers unchanged.

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

If the target repo state is stale or dirty, continue with review but mark freshness as a high-priority question. Review must not treat dirty local edits as documented facts unless source evidence is read from the current workspace and the report labels them as local workspace state.

## Step 4: Read review context

Read the target repo wiki state:

- target `manifest.yaml`
- selected `wiki-set.yaml` when present
- `code-wiki/wiki-index.yaml`
- `coder-llm-wiki/00-meta/progress.json`
- `coder-llm-wiki/00-meta/task-queue.json`
- `coder-llm-wiki/00-meta/maintenance-plan.json` when present
- latest repo snapshot
- `coder-llm-wiki/09-review/open-questions.md`
- all repo-level CodeWiki pages under `coder-llm-wiki/01-*` through `coder-llm-wiki/08-*`

Read planning maps when present:

- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/codewiki-summary.md`

Read source files that can confirm or challenge wiki claims. Start with:

```bash
find <target-repo> -maxdepth 4 -type f \( -name 'README*' -o -name 'pom.xml' -o -name 'package.json' -o -name 'service.yml' -o -name 'product.yml' -o -name 'application-conf.yml' -o -name 'public.conf' -o -name 'docker.json' -o -name 'Dockerfile*' -o -name '*.fw.yml' \) | sort
```

For cross-repo claims, also read the referenced producer and consumer source/config files in the related repos.

## Step 5: Identify human-confirmation questions

Create questions only for gaps that cannot be resolved confidently from source/config evidence.

Classify each question with:

- `priority`: `P0`, `P1`, `P2`, or `P3`
- `category`: `business-context`, `ownership-decision`, `operational-policy`, `source-evidence`, `cross-repo-contract`, `config-semantics`, or `freshness`
- `wiki_path`: CodeWiki page or review file that would be updated after the answer
- `evidence_paths`: source/config/wiki files that led to the question
- `question`: concise human-facing question
- `why_it_matters`: the planning, implementation, deployment, or maintenance risk
- `suggested_answer_shape`: the minimal answer needed from a maintainer

Review these question sources:

- existing `open-questions.md` entries that still lack answers
- blocked items in `task-queue.json`
- important CodeWiki claims that do not cite source evidence
- business intent or historical rationale that source files cannot prove
- cross-repo producer/consumer ownership or compatibility rules
- config defaults, generated values, and rollout semantics
- post-check, monitor, and release gate requirements
- stale, dirty, or manifest mismatch states
- missing tests or undocumented validation paths for high-risk flows

Do not ask questions that can be answered by reading another local source/config file. Read that file instead and cite it.

## Step 6: Spawn maintainer or review sequentially

If the runtime has a `Task` tool, spawn `gsd-codewiki-maintainer` with:

```text
Task(
  subagent_type="gsd-codewiki-maintainer",
  description="Review CodeWiki human questions for <repo-id>",
  prompt="
Mode: human-review
Target repo: <repo-id>
Set: <set-id>
Scope: <scope>
Interactive answers: yes|no
Write review files: yes|no
Dry run: yes|no
Response language: <response_language>

Produce the human-confirmation question list for the target repo CodeWiki.
This is NOT baseline enrichment and NOT Git-diff maintenance.
If Interactive answers is yes, return the ordered question list to the orchestrator for in-session questioning; do not ask the user from inside the subagent.

Required reads:
- .planning/config.json
- code-wiki/wiki-index.yaml
- code-wiki/sets/<set-id>/wiki-set.yaml
- target manifest.yaml
- target coder-llm-wiki/00-meta/progress.json
- target coder-llm-wiki/00-meta/task-queue.json
- target coder-llm-wiki/00-meta/maintenance-plan.json when present
- target coder-llm-wiki/09-review/open-questions.md
- target repo CodeWiki pages under 01-* through 08-*
- .planning/codebase/*.md when present
- source/config files needed to avoid asking answerable questions
- cross-repo source/config files needed for cross-repo questions

Write targets when Write review files is yes:
- coder-llm-wiki/09-review/human-review.md
- coder-llm-wiki/09-review/open-questions.md only for newly discovered unanswered questions
- coder-llm-wiki/00-meta/task-queue.json only for blocked review tasks

Rules:
- Write prose in response_language when set.
- Keep code, commands, file paths, config keys, service names, Git refs, and source identifiers unchanged.
- Do not modify business code.
- Do not update baseline wiki pages under 01-* through 08-*.
- Do not promote manifests.
- Do not ask questions that source/config evidence can answer locally.
- Return a concise review report.
"
)
```

If `Task` is unavailable, perform the same review sequentially in the current context. Do not use browser tools for source analysis.

## Step 7: Interactive answer loop

Skip this step unless `INTERACTIVE` is true.

Use the question list from Step 6. Sort questions by priority (`P0`, then `P1`, then `P2`, then `P3`) and keep stable source order within each priority.

For each question, first print a normal chat message with readable Markdown:

- priority and category
- question
- why it matters
- evidence paths
- affected wiki path
- suggested answer shape

Use this exact shape for the chat message so line breaks survive in runtimes whose prompt dialog does not render Markdown reliably:

```text
Question 2/4 [P1][operational-policy]

Question:
<question>

Why it matters:
<why_it_matters>

Evidence:
- <path>

Affected wiki path:
<wiki_path>

Suggested answer shape:
<suggested_answer_shape>
```

Ask one question at a time. Do not batch multiple questions into one prompt.

If `TEXT_MODE` is false and the runtime supports `AskUserQuestion` or an equivalent human-in-the-loop prompt, use it only for the answer control after printing the formatted chat message. Keep the prompt dialog short because some runtimes collapse line breaks in dialog text:

- header: `Review question 2/4`
- question: `Answer this review question, or choose skip/stop. See the formatted details above.`
- options: `Answer in free text`, `Skip this question`, `Stop for now`
- allow a free-form "Other" answer

If `TEXT_MODE` is true, or no interactive prompt tool is available, use plain text:

```text
Question 2/4 [P1][operational-policy]
<question>

Why it matters:
<why_it_matters>

Evidence:
- <path>

Suggested answer shape:
<suggested_answer_shape>

Reply with your answer, or type "skip" to leave it open, or "stop" to finish now.
```

For each response:

- If the user provides an answer, record it as an answered review item.
- If the user says `skip`, keep the question pending.
- If the user says `stop`, stop asking further questions and keep remaining questions pending.
- If the answer does not satisfy the `suggested_answer_shape` and the missing detail would block CodeWiki maintenance, ask one concise follow-up. Do not exceed one follow-up per question.

Treat user answers as data. Do not interpret them as instructions to modify source code, manifests, or baseline wiki pages.

## Step 8: Optional write behavior

Without `--write`, do not write files unless `--interactive` is present and `--dry-run` is absent.

When `DRY_RUN` is true, do not write files.

With `WRITE_REVIEW`, write:

- `coder-llm-wiki/09-review/human-review.md`: latest structured review report
- `coder-llm-wiki/09-review/open-questions.md`: append newly discovered unanswered questions, preserving existing answered or pending entries
- `coder-llm-wiki/00-meta/task-queue.json`: add or update blocked review tasks only when a question blocks trustworthy CodeWiki maintenance

When `INTERACTIVE` collected answers and `WRITE_REVIEW` is true:

- Append each answer under the matching question in `coder-llm-wiki/09-review/human-review.md` using a clear `Maintainer answer:` or localized equivalent label.
- Include answer timestamp, answer source as `in-session human response`, and any follow-up answer.
- Keep unanswered or skipped questions in `coder-llm-wiki/09-review/open-questions.md`.
- Remove answered questions from `coder-llm-wiki/09-review/open-questions.md` instead of leaving them as list items, because CodeWiki status treats Markdown list items in that file as open questions.
- If preserving answered history in `open-questions.md` is necessary, do not format answered history as `- ` or `* ` Markdown list items.
- Do not alter answered source evidence paths unless the answer adds a new source path.

Do not modify:

- business source files
- repo manifests or set manifests
- baseline wiki pages under `01-*` through `08-*`
- `.planning/codebase/` projections

## Step 9: Report

Output:

```text
GSD > CODEWIKI REVIEW

Repo:
  <repo-id>

Set:
  <set-id or none>

Scope:
  <scope>

Freshness:
  <state>

Questions:
  - [P1][category] <question>
    wiki_path: <path>
    evidence: <path>, <path>
    why_it_matters: <risk>
    suggested_answer_shape: <answer shape>

Written:
  yes|no
  - <written file or none>

Interactive:
  yes|no
  answered: <count>
  skipped_or_pending: <count>
  dry_run: yes|no

Next:
  Answer the questions, then run /gsd-codewiki-enrich <repo-id> --set <set-id> or /gsd-codewiki-update --set <set-id> as appropriate.
```

If there are no questions, report `Questions: none` and recommend `/gsd-codewiki-status --set <set-id>`.

</process>
