<purpose>
整理 sketch 设计结论，并将其打包成可持久复用的项目 skill，供后续
UI 实现使用。从 `.planning/sketches/` 读取，向 `./.claude/skills/sketch-findings-[project]/`
（项目本地）写入 skill，并向 `.planning/sketches/WRAP-UP-SUMMARY.md` 写入摘要。
它是 `/gsd-sketch` 的配套流程。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCH WRAP-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="gather">
## 收集 Sketch 清单

1. 读取 `.planning/sketches/MANIFEST.md`，获取设计方向和参考点
2. Glob `.planning/sketches/*/README.md`，并解析每个文件的 YAML frontmatter
3. 检查该项目是否已存在 `./.claude/skills/sketch-findings-*/SKILL.md`
   - 如果存在：读取其中的 `processed_sketches` 列表，并过滤掉这些 sketch
   - 如果不存在：所有 sketches 都是候选

如果没有未处理的 sketches：
```
No unprocessed sketches found in `.planning/sketches/`.
Run `/gsd-sketch` first to create design explorations.
```
退出。

检查 `commit_docs` 配置：
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="curate">
## 逐个整理 Sketch

按升序展示每个未处理的 sketch。对每个 sketch，显示：

- **Sketch 编号和名称**
- **设计问题：** 来自 frontmatter
- **Winner：** 如果已选择，显示选中的 variant
- **Tags：** 来自 frontmatter
- **关键决策：** 概括视觉上做出的决定

然后询问用户：

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                               ║
╚══════════════════════════════════════════════════════════════╝

Sketch {NNN}: {name} — Winner: Variant {X}

{key design decisions summary}

──────────────────────────────────────────────────────────────
→ Include / Exclude / Partial / Let me look at it
──────────────────────────────────────────────────────────────

**如果选择 `"Let me look at it"`：**
1. 提供：`open .planning/sketches/NNN-name/index.html`
2. 提醒他们哪个 variant 获胜，以及应该重点看什么
3. 看完后，回到 include/exclude/partial 的决策

**如果选择 `"Partial"`：**
询问这个 sketch 的哪些决策需要包含，哪些需要排除。
</step>

<step name="group">
## 按设计区域自动分组

所有 sketches 整理完后：

1. 读取所有已包含 sketches 的 tags、名称和内容
2. 提议按设计区域分组，例如：
   - "**Layout & Navigation** — sketches 001, 004"
   - "**Form Controls** — sketches 002, 005"
   - "**Color & Typography** — sketches 003"
3. 展示分组供批准，用户可以合并、拆分、重命名或重新排列

每个分组都会成为生成 skill 中的一个 reference file。
</step>

<step name="skill_name">
## 确定输出 Skill 名称

根据项目目录名推导：`./.claude/skills/sketch-findings-[project-dir-name]/`

如果该路径下已存在 skill（append mode），则原地更新。
</step>

<step name="copy_sources">
## 复制源文件

对每个已包含的 sketch：

1. 将获胜 variant 的 HTML 文件（或包含所有 variants 的完整 `index.html`）复制到 `sources/NNN-sketch-name/`
2. 将获胜的 `theme.css` 复制到 `sources/themes/`
3. 排除 `node_modules`、构建产物、`.DS_Store`
</step>

<step name="synthesize">
## 生成 Reference Files

对每个设计区域分组，在 `references/[design-area-name].md` 写入一个 reference file：

```markdown
# [Design Area Name]

## Design Decisions
[For each validated decision: what was chosen, why it won over alternatives, the key visual properties (colors, spacing, border radius, typography)]

## CSS Patterns
[Key CSS snippets from winning variants — layout structures, component patterns, animation patterns. Extracted and cleaned up for reference.]

## HTML Structures
[Key HTML patterns from winning variants — page layout, component markup, navigation structures.]

## What to Avoid
[Design directions that were tried and rejected. Why they didn't work.]

## Origin
Synthesized from sketches: NNN, NNN
Source files available in: sources/NNN-sketch-name/
```
</step>

<step name="write_skill">
## 写入 SKILL.md

创建（或更新）生成的 skill 的 `SKILL.md`：

```markdown
---
name: sketch-findings-[project-dir-name]
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments. Auto-loaded during UI implementation on [project-dir-name].
---

<context>
## Project: [project-dir-name]

[Design direction paragraph from MANIFEST.md]
[Reference points mentioned during intake]

Sketch sessions wrapped: [date(s)]
</context>

<design_direction>
## Overall Direction

[Summary of the validated visual direction: palette, typography, spacing system, layout approach, interaction patterns]
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| [Name] | references/[name].md | [One-line summary] |

## Theme

The winning theme file is at `sources/themes/default.css`.

## Source Files

Original sketch HTML files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Sketches

[List of sketch numbers wrapped up]

- 001-sketch-name
- 002-sketch-name
</metadata>
```
</step>

<step name="write_summary">
## 写入 Planning Summary

为项目历史写入 `.planning/sketches/WRAP-UP-SUMMARY.md`：

```markdown
# Sketch Wrap-Up Summary

**Date:** [date]
**Sketches processed:** [count]
**Design areas:** [list]
**Skill output:** `./.claude/skills/sketch-findings-[project]/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|

## Design Direction
[consolidated design direction summary]

## Key Decisions
[layout, palette, typography, spacing, interaction patterns]
```
</step>

<step name="update_claude_md">
## 更新项目 CLAUDE.md

添加一条自动加载路由：

```
- **Sketch findings for [project]** (design decisions, CSS patterns, visual direction) → `Skill("sketch-findings-[project-dir-name]")`
```

如果这条路由已存在（append mode），保持不变。
</step>

<step name="commit">
提交所有 artifacts（如果 `COMMIT_DOCS` 为 true）：

```bash
gsd-sdk query commit "docs(sketch-wrap-up): package [N] sketch findings into project skill" .planning/sketches/WRAP-UP-SUMMARY.md
```
</step>

<step name="report">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCH WRAP-UP COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**已整理：** {N} sketches（{included} 个纳入，{excluded} 个排除）
**设计区域：** {list}
**Skill：** `./.claude/skills/sketch-findings-[project]/`
**Summary：** `.planning/sketches/WRAP-UP-SUMMARY.md`
**CLAUDE.md：** 已添加路由行

构建 UI 时会自动加载这个 sketch-findings skill。
```

───────────────────────────────────────────────────────────────

## ▶ 下一步

**探索前沿 sketches** — 基于已探索内容，看看还有哪些值得继续 sketch

`/gsd-sketch`（不带参数运行，它的 frontier mode 会分析 sketch 全景，并提出 consistency sketch 和 frontier sketch）

───────────────────────────────────────────────────────────────

**还可使用：**
- `/gsd-plan-phase` — 开始构建真实 UI
- `/gsd-ui-phase` — 为 frontend phase 生成 UI 设计约束
- `/gsd-sketch [idea]` — 为某个新的设计区域做 sketch
- `/gsd-explore` — 继续探索

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] 每个未处理的 sketch 都已单独展示供整理
- [ ] 已提出并确认设计区域分组
- [ ] `./.claude/skills/` 下已存在 sketch-findings skill，包含 SKILL.md、references/、sources/
- [ ] 已将获胜的 theme.css 复制到 skill sources
- [ ] Reference files 包含设计决策、CSS patterns、HTML structures、anti-patterns
- [ ] 已写入 `.planning/sketches/WRAP-UP-SUMMARY.md` 作为项目历史
- [ ] 项目 CLAUDE.md 已有自动加载路由行
- [ ] 已展示 summary
- [ ] 已展示下一步选项（包括通过 `/gsd-sketch` 继续进行 frontier sketch 探索）
</success_criteria>
