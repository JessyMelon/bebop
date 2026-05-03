<purpose>
Generate Repomix seed bundles for selected CodeWiki repos.

Repomix output is seed-only context for navigation and summarization. It must not be cited as final CodeWiki evidence.
</purpose>

<process>

## Step 1: Select CodeWiki

Use the same selection rules as `codewiki-status`.

Supported arguments:

- `--set <set-id>`: pack all members in a multi-repo set
- `--repo <repo-id>` or `--repos <repo-id,repo-id>`: restrict selected members
- `--style xml|markdown|json|plain`: Repomix output format; default `xml`
- `--include <patterns>` and `--ignore <patterns>`: pass through to Repomix
- `--compress`: pass `--compress` to Repomix
- `--repomix-bin <path>`: override the Repomix executable
- `--force`: regenerate existing bundles
- `--dry-run`: show planned commands without writing

If the selected CodeWiki namespace or set is missing, stop and recommend `/gsd-codewiki-init`.

## Step 2: Run SDK pack query

Prefer the SDK query layer:

```bash
gsd-sdk query codewiki.pack $ARGUMENTS
```

The SDK writes per-repo seed files beside each repo manifest:

```text
code-wiki/<repo>/<version>/repomix-output.xml
code-wiki/<repo>/<version>/repomix-output.meta.json
```

For non-XML styles, the output extension follows the style:

- `markdown` -> `repomix-output.md`
- `json` -> `repomix-output.json`
- `plain` -> `repomix-output.txt`

The SDK registers seed paths in `manifest.yaml`:

- `paths.repomix_bundle`
- `paths.repomix_meta`
- `seed_sources.repomix.evidence: false`

## Step 3: Fallback when SDK is unavailable

For each selected member, run Repomix manually:

```bash
repomix <repo-root> --output <namespace>/repomix-output.xml --style xml --quiet --parsable-style --truncate-base64
```

Then write `<namespace>/repomix-output.meta.json` with:

- source repo path
- source commit
- generated timestamp
- output file path
- `evidence: false`

Update the repo `manifest.yaml` seed paths only after the output file exists.

## Step 4: Report

Output:

```text
GSD > CODEWIKI PACK

Packed:
  - <repo-id>: <repomix-output path>

Reused:
  - <repo-id>: <existing output path>

Warnings:
  - <warnings or none>

Next:
  /gsd-codewiki-deepwiki-export [--set <set-id>]
```

</process>
