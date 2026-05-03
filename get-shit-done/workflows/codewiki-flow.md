<purpose>
Create or register a set-level CodeWiki cross-repo flow.

This workflow creates `code-wiki/sets/<set-id>/cross-repo/flows/<name>.md` and registers it in `wiki-set.yaml` under `cross_repo.flows`. It does not mark the flow current; every participating repo must be backed by source evidence first.
</purpose>

<process>

## Step 1: Run SDK flow query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.flow $ARGUMENTS
```

Expected arguments:

- `<name>` or `--name <name>`: stable flow name
- `--set <set-id>`: target CodeWiki set
- `--repos <repo-id,repo-id>`: participating repos

Use the JSON result as the authoritative write report when available. It creates the missing flow doc, reuses an existing doc without overwriting it, validates repo IDs against the selected set, and updates `wiki-set.yaml`.

If the SDK query is unavailable, continue with the fallback manual initialization below.

## Step 2: Validate the set

Read the selected `wiki-set.yaml`.

Stop if:

- no set is selected
- `wiki-set.yaml` is missing
- the set is frozen
- any `--repos` repo ID is not in `members`

If the set is `set-stale` or `set-partial`, warn that the flow scaffold can be created but must not be marked current until member freshness is resolved.

## Step 3: Create or reuse the flow document

Create:

```text
code-wiki/sets/<set-id>/cross-repo/flows/<flow-name>.md
```

Use `get-shit-done/templates/codewiki/cross-repo-flow.md` as the structure. Keep status blocked until the document cites exact source evidence for each participating repo.

## Step 4: Register the flow

Update `wiki-set.yaml`:

```yaml
cross_repo:
  flows:
    - name: <flow-name>
      repos: [<repo-id>]
      docs:
        - cross-repo/flows/<flow-name>.md
      status: blocked
```

Do not remove existing flow fields or overwrite existing flow narrative.

## Step 5: Report

Output:

```text
GSD > CODEWIKI FLOW

Flow:
  - code-wiki/sets/<set-id>/cross-repo/flows/<flow-name>.md

Next:
  Fill participating repo evidence, then run /gsd-codewiki-status --set <set-id>
```

</process>
