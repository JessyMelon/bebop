<purpose>
Create or register a set-level CodeWiki cross-repo contract.

This workflow creates `code-wiki/sets/<set-id>/cross-repo/contracts/<name>.md` and registers it in `wiki-set.yaml` under `cross_repo.contracts`. It does not mark the contract current; source-backed producer and consumer evidence must be filled before the contract is trusted.
</purpose>

<process>

## Step 1: Run SDK contract query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.contract $ARGUMENTS
```

Expected arguments:

- `<name>` or `--name <name>`: stable contract name
- `--set <set-id>`: target CodeWiki set
- `--producer <repo-id>`: repo that owns the contract surface
- `--consumers <repo-id,repo-id>`: repos that depend on the contract

Use the JSON result as the authoritative write report when available. It creates the missing contract doc, reuses an existing doc without overwriting it, validates repo IDs against the selected set, and updates `wiki-set.yaml`.

If the SDK query is unavailable, continue with the fallback manual initialization below.

## Step 2: Validate the set

Read the selected `wiki-set.yaml`.

Stop if:

- no set is selected
- `wiki-set.yaml` is missing
- the set is frozen
- `--producer` or any `--consumers` repo ID is not in `members`

If the set is `set-stale` or `set-partial`, warn that the contract scaffold can be created but must not be marked current until member freshness is resolved.

## Step 3: Create or reuse the contract document

Create:

```text
code-wiki/sets/<set-id>/cross-repo/contracts/<contract-name>.md
```

Use `get-shit-done/templates/codewiki/cross-repo-contract.md` as the structure. Keep status blocked until the document cites exact producer and consumer source evidence.

## Step 4: Register the contract

Update `wiki-set.yaml`:

```yaml
cross_repo:
  contracts:
    - name: <contract-name>
      producer_repo: <repo-id>
      consumer_repos: [<repo-id>]
      docs:
        - cross-repo/contracts/<contract-name>.md
      status: blocked
```

Do not remove existing contract fields or overwrite existing contract narrative.

## Step 5: Report

Output:

```text
GSD > CODEWIKI CONTRACT

Contract:
  - code-wiki/sets/<set-id>/cross-repo/contracts/<contract-name>.md

Next:
  Fill producer and consumer evidence, then run /gsd-codewiki-status --set <set-id>
```

</process>
