<purpose>
Run or register DeepWiki exports for selected CodeWiki repos.

DeepWiki output is seed-only structure, graph, and RAG context. It must not be promoted as final CodeWiki evidence.
</purpose>

<process>

## Step 1: Select CodeWiki

Use the same selection rules as `codewiki-status`.

Supported arguments:

- `--set <set-id>`: export all members in a multi-repo set
- `--repo <repo-id>` or `--repos <repo-id,repo-id>`: restrict selected members
- `--command <template>`: command template used to run DeepWiki export
- `--register-existing`: register existing `deepwiki-export/deepwiki.md`
- `--force`: rerun even when `deepwiki.md` already exists
- `--timeout-ms <number>`: per-repo command timeout; default 30 minutes
- `--dry-run`: show planned commands without writing

If the selected CodeWiki namespace or set is missing, stop and recommend `/gsd-codewiki-init`.

## Step 2: Configure DeepWiki runner

`deepwiki-open` does not provide a universal local CLI contract inside Bebop, so the workflow uses a configured command template.

Configure one of:

```json
{
  "codewiki": {
    "deepwiki_export": {
      "command": "node \"$HOME/.claude/get-shit-done/bin/deepwiki-open-export.cjs\" --repo \"{repo}\" --output-md \"{output_md}\" --output-json \"{output_json}\""
    }
  }
}
```

or pass `--command`. The equivalent config key is `codewiki.deepwiki_export.command`.

```bash
gsd-sdk query codewiki.deepwiki-export --command 'node "$HOME/.claude/get-shit-done/bin/deepwiki-open-export.cjs" --repo "{repo}" --output-md "{output_md}" --output-json "{output_json}"' $ARGUMENTS
```

The bundled `deepwiki-open-export.cjs` helper is copied with `get-shit-done/` during runtime installation, including OpenCode installs. It expects a running deepwiki-open API server at `DEEPWIKI_API_BASE_URL` or `http://localhost:8001`. Set `DEEPWIKI_OPEN_ROOT` when deepwiki-open is not checked out beside the project.

The template variables are:

- `{repo}`: selected repo root
- `{repo_id}`: CodeWiki repo ID
- `{branch}`: current branch
- `{commit}`: current commit
- `{output_dir}`: `deepwiki-export/`
- `{output_md}`: `deepwiki-export/deepwiki.md`
- `{output_json}`: `deepwiki-export/deepwiki.json`

If the local DeepWiki runner needs shell features, wrap it in a script and call that script from the template.

## Step 3: Run SDK export query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.deepwiki-export $ARGUMENTS
```

The SDK writes or registers:

```text
code-wiki/<repo>/<version>/deepwiki-export/deepwiki.md
code-wiki/<repo>/<version>/deepwiki-export/deepwiki.json
code-wiki/<repo>/<version>/deepwiki-export/manifest.json
```

The SDK registers seed paths in `manifest.yaml`:

- `paths.deepwiki_export`
- `paths.deepwiki_json` when present
- `paths.deepwiki_meta`
- `seed_sources.deepwiki.evidence: false`

Use `--register-existing` when DeepWiki was run outside Bebop and the files already exist.

## Step 4: Methodology guardrails

- Run per repo, not against a mixed multi-repo directory.
- Bind each export to the selected repo commit.
- Keep DeepWiki output outside `coder-llm-wiki/` formal pages.
- Treat DeepWiki output as a seed for structure, module candidates, flow candidates, and graph hints.
- Verify every final CodeWiki claim against source files, config, tests, or Git diff before writing it as fact.
- Do not cross-branch or cross-version reuse DeepWiki caches without recording the source commit.

## Step 5: Report

Output:

```text
GSD > CODEWIKI DEEPWIKI EXPORT

Exported:
  - <repo-id>: deepwiki-export/deepwiki.md

Registered:
  - <repo-id>: existing deepwiki-export/deepwiki.md

Warnings:
  - <warnings or none>

Next:
  /gsd-codewiki-enrich [--set <set-id>]
```

</process>
