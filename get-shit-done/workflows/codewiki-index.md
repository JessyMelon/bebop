<purpose>
Index selected CodeWiki facts into `.planning/intel/codewiki.json`.

This workflow lets `/gsd-intel query` search durable CodeWiki repo/set facts without making `.planning/intel/` authoritative. The index is derived JSON and can be regenerated.
</purpose>

<process>

## Step 1: Check Intel gate

CodeWiki indexing requires the existing intel feature flag:

```bash
INTEL_ENABLED=$(gsd-sdk query config-get intel.enabled 2>/dev/null || echo "false")
```

If `INTEL_ENABLED` is not `true`, stop and report:

```text
CodeWiki intel indexing requires intel.enabled=true.

Enable it with:
  gsd-sdk query config-set intel.enabled true
```

## Step 2: Run SDK index query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.index $ARGUMENTS
```

Use the JSON result as the authoritative indexing report. It writes:

```text
.planning/intel/codewiki.json
```

If the SDK query returns `indexed: false`, stop and follow `next_action`.

## Step 3: Parse arguments

Parse `$ARGUMENTS`:

- `--set <set-id>`: index a multi-repo CodeWiki set

When `--set` is omitted, the SDK may use `codewiki.active_set` or select the current repo namespace.

## Step 4: Verify queryability

After indexing, a targeted intel query should be able to find repo IDs, set IDs, commit SHAs, wiki paths, and open questions:

```bash
gsd-sdk query intel.query <repo-or-set-term>
```

Do not copy full wiki documents into `.planning/intel/`. Store compact structured records only.

## Step 5: Report

Output:

```text
GSD > CODEWIKI INDEX

Indexed:
  .planning/intel/codewiki.json

State: <state>
Set: <set-id or none>
Records: <count>

Next:
  /gsd-intel query <term>
```

</process>
