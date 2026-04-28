<purpose>

将已完成 milestone 累积的 phase 目录归档到 `.planning/milestones/v{X.Y}-phases/`。识别哪些 phase 属于各个已完成的 milestone，先展示 dry-run 摘要，并在确认后移动目录。

</purpose>

<required_reading>

1. `.planning/MILESTONES.md`
2. `.planning/milestones/` 目录列表
3. `.planning/phases/` 目录列表

</required_reading>

<process>

<step name="identify_completed_milestones">

读取 `.planning/MILESTONES.md`，识别已完成的 milestone 及其版本。

```bash
cat .planning/MILESTONES.md
```

提取每个 milestone 版本（例如 `v1.0`、`v1.1`、`v2.0`）。

检查哪些 milestone 归档目录已存在：

```bash
ls -d .planning/milestones/v*-phases 2>/dev/null || true
```

筛选出尚未拥有 `-phases` 归档目录的 milestone。

如果所有 milestone 都已经有 phase 归档：

```
All completed milestones already have phase directories archived. Nothing to clean up.
```

到此停止。

</step>

<step name="determine_phase_membership">

对每个尚未拥有 `-phases` 归档的已完成 milestone，读取其已归档的 ROADMAP 快照，以确定哪些 phase 属于它：

```bash
cat .planning/milestones/v{X.Y}-ROADMAP.md
```

从归档的 roadmap 中提取 phase 编号和名称（例如 `Phase 1: Foundation`、`Phase 2: Auth`）。

检查这些 phase 目录中哪些仍然存在于 `.planning/phases/`：

```bash
ls -d .planning/phases/*/ 2>/dev/null || true
```

将 phase 目录与 milestone 归属关系匹配。只包含那些仍存在于 `.planning/phases/` 中的目录。

</step>

<step name="show_dry_run">

为每个 milestone 展示 dry-run 摘要：

```
## Cleanup Summary

### v{X.Y} — {Milestone Name}
These phase directories will be archived:
- 01-foundation/
- 02-auth/
- 03-core-features/

Destination: .planning/milestones/v{X.Y}-phases/

### v{X.Z} — {Milestone Name}
These phase directories will be archived:
- 04-security/
- 05-hardening/

Destination: .planning/milestones/v{X.Z}-phases/
```

如果没有剩余的 phase 目录可归档（都已被移动或删除）：

```
No phase directories found to archive. Phases may have been removed or archived previously.
```

到此停止。


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
AskUserQuestion: "Proceed with archiving?" with options: "Yes — archive listed phases" | "Cancel"

如果选择 "Cancel"：停止。

</step>

<step name="archive_phases">

对每个 milestone，移动 phase 目录：

```bash
mkdir -p .planning/milestones/v{X.Y}-phases
```

对属于该 milestone 的每个 phase 目录：

```bash
mv .planning/phases/{dir} .planning/milestones/v{X.Y}-phases/
```

对 cleanup 集合中的所有 milestone 重复此操作。

</step>

<step name="commit">

提交这些变更：

```bash
gsd-sdk query commit "chore: archive phase directories from completed milestones" .planning/milestones/ .planning/phases/
```

</step>

<step name="report">

```
Archived:
{For each milestone}
- v{X.Y}: {N} phase directories → .planning/milestones/v{X.Y}-phases/

.planning/phases/ cleaned up.
```

</step>

</process>

<success_criteria>

- [ ] 已识别所有尚无现有 phase 归档的已完成 milestone
- [ ] 已根据归档的 ROADMAP 快照确定 phase 归属
- [ ] 已展示 dry-run 摘要并获得用户确认
- [ ] 已将 phase 目录移动到 `.planning/milestones/v{X.Y}-phases/`
- [ ] 变更已提交

</success_criteria>
