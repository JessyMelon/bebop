<purpose>
Project selected CodeWiki context into `.planning/codebase/` so normal Bebop planning can consume durable code knowledge.

This workflow does not make `.planning/codebase/` authoritative. It writes a disposable summary that records the CodeWiki state, repo commits, set tuple, snapshots, and warnings.
</purpose>

<process>

## Step 1: Run SDK projection query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.project $ARGUMENTS
```

Use the JSON result as the authoritative projection report when the command is available. It writes:

```text
.planning/codebase/codewiki-summary.md
```

If the SDK query returns `projected: false`, stop and follow `next_action`.

## Step 2: Parse arguments

Parse `$ARGUMENTS`:

- `--set <set-id>`: project a multi-repo CodeWiki set

When `--set` is omitted, the SDK may use `codewiki.active_set` or select the current repo namespace.

## Step 3: Validate source freshness

Run or reuse:

```bash
gsd-sdk query codewiki.status $ARGUMENTS
```

Projection may proceed for stale or dirty states only when the caller has not enabled a hard freshness gate. The generated file must keep the state and warning visible.

Do not invent missing CodeWiki facts. If status is `missing`, recommend:

```text
/gsd-codewiki-init
```

## Step 4: Write projection

Write a compact Markdown projection with:

- selected state and recommended next action
- set ID and tuple ID when present
- member repo table with current and manifest commits
- latest set snapshot excerpt when present
- latest repo snapshot/status excerpts
- open questions from each member wiki
- warnings when the selected wiki is stale, dirty, partial, or frozen

Keep the file suitable for planner/executor consumption. Avoid copying entire wiki trees.

## Step 5: Report

Output:

```text
GSD > CODEWIKI PROJECT

Projected:
  .planning/codebase/codewiki-summary.md

State: <state>
Set: <set-id or none>

Warnings:
  - <warning or none>

Next:
  /gsd-plan-phase <phase>
```

</process>
