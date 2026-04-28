<purpose>
将 spike 实验的发现打包成持久化的项目 skill，作为未来构建对话可复用的实现蓝图。
从 `.planning/spikes/` 读取，向 `./.claude/skills/spike-findings-[project]/`（项目本地）写入 skill，
并向 `.planning/spikes/WRAP-UP-SUMMARY.md` 写入总结。对应 `/gsd-spike` 的配套流程。
</purpose>

<required_reading>
开始前读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPIKE WRAP-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="gather">
## 收集 Spike 清单

1. 读取 `.planning/spikes/MANIFEST.md`，获取整体想法背景和需求
2. Glob `.planning/spikes/*/README.md`，并解析每个文件的 YAML frontmatter
3. 检查当前项目是否已存在 `./.claude/skills/spike-findings-*/SKILL.md`
   - 如果存在：读取其 metadata 部分中的 `processed_spikes` 列表，并将这些 spike 过滤掉
   - 如果不存在：所有 spike 都是候选项

如果不存在未处理的 spike：
```
在 `.planning/spikes/` 中未找到未处理的 spike。
先运行 `/gsd-spike` 创建实验。
```
退出。

检查 `commit_docs` 配置：
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="auto_include">
## 自动纳入所有 Spike

自动纳入所有未处理的 spike。展示一份简短清单，说明将处理哪些内容：

```
Processing N spikes:
  001 — name (VALIDATED)
  002 — name (PARTIAL)
  003 — name (INVALIDATED)
```

每个 spike 都会带来可延续的信息：
- **VALIDATED** spikes 提供已验证可行的模式
- **PARTIAL** spikes 提供受限条件下可用的模式
- **INVALIDATED** spikes 提供雷区和死路
</step>

<step name="group">
## 按特性领域自动分组

基于 tags、name、`related` 字段和内容，按特性领域对 spike 分组。直接进入综合整理。

每个分组都会成为生成 skill 中的一个 reference 文件。
</step>

<step name="skill_name">
## 确定输出 Skill 名称

从项目目录推导 skill 名称：

1. 获取项目根目录名（例如 `solana-tracker`）
2. skill 将创建在 `./.claude/skills/spike-findings-[project-dir-name]/`

如果该路径下已存在 skill（追加模式），则原地更新。
</step>

<step name="copy_sources">
## 复制源文件

对每个纳入的 spike：

1. 找出核心源文件，即让该 spike 正常工作的实际脚本、主文件和配置。排除：
   - `node_modules/`、`__pycache__/`、`.venv/`、构建产物
   - Lock files（`package-lock.json`、`yarn.lock` 等）
   - `.git/`、`.DS_Store`
2. 将 README.md 和核心源文件复制到生成 skill 目录内的 `sources/NNN-spike-name/`
</step>

<step name="synthesize">
## 综合生成 Reference 文件

对每个特性领域分组，在 `references/[feature-area-name].md` 写入一个**实现蓝图**。它应该像配方，而不是研究论文。后续真正的构建会话应能直接照着它正确实现该特性，而无需再次做 spike。

```markdown
# [Feature Area Name]

## Requirements

[适用于该特性领域的、来自 MANIFEST.md Requirements section 的不可妥协设计决策。这些在真实构建中 MUST 被遵守。例如："Must use streaming JSON output"、"Must support reconnection"。]

## How to Build It

[分步骤说明：安装什么、如何配置、使用什么代码模式。包含从 spike 源码中提取的关键代码片段。这是已验证的做法，不是理论，而是经过测试且可工作的代码。]

## What to Avoid

[那些看起来对但实际不对的东西。坑点。spiking 过程中发现的反模式。尝试过但失败的死路。]

## Constraints

[硬性事实：速率限制、库的限制、版本要求、不兼容情况]

## Origin

Synthesized from spikes: NNN, NNN, NNN
Source files available in: sources/NNN-spike-name/, sources/NNN-spike-name/
```
</step>

<step name="write_skill">
## 写入 SKILL.md

创建（或更新）生成 skill 的 SKILL.md：

```markdown
---
name: spike-findings-[project-dir-name]
description: 为构建 [project-dir-name] 提供来自 spike experiments 的实现蓝图、需求、已验证模式和确认过的知识。会在实现工作中自动加载。
---

<context>
## Project: [project-dir-name]

[取自 MANIFEST.md 的一段文字，用于描述整体想法]

Spike sessions wrapped: [date(s)]
</context>

<requirements>
## Requirements

[直接复制自 MANIFEST.md Requirements section。这些是用户在 spiking 过程中作出的选择所形成的、不可妥协的设计决策。每个 feature area reference 都必须遵守它们。]

- [requirement 1]
- [requirement 2]
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| [Name] | references/[name].md | [单行总结] |

## Source Files

原始 spike 源文件保存在 `sources/` 中，便于完整参考。
</findings_index>

<metadata>
## Processed Spikes

[已完成整理的 spike 编号列表]

- 001-spike-name
- 002-spike-name
</metadata>
```
</step>

<step name="write_summary">
## 写入规划总结

向 `.planning/spikes/WRAP-UP-SUMMARY.md` 写入项目历史总结：

```markdown
# Spike Wrap-Up Summary

**Date:** [date]
**Spikes processed:** [count]
**Feature areas:** [list]
**Skill output:** `./.claude/skills/spike-findings-[project]/`

## Processed Spikes
| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|

## Key Findings
[汇总后的发现总结]
```
</step>

<step name="update_claude_md">
## 更新项目 CLAUDE.md

向项目的 CLAUDE.md 添加一条自动加载路由（如果文件不存在则创建）：

```
- **Spike findings for [project]** (implementation patterns, constraints, gotchas) → `Skill("spike-findings-[project-dir-name]")`
```

如果该路由已存在（追加模式），保持不变。
</step>

<step name="generate_conventions">
## 生成或更新 CONVENTIONS.md

分析所有已处理的 spikes 中反复出现的模式，并写入 `.planning/spikes/CONVENTIONS.md`。这个文件告诉后续 spike 会话*我们如何做 spike*，包括已形成的技术栈、结构和模式。

1. 读取所有 spike 源代码和 README，查找：
   - **Stack choices** — 哪些 language/framework/runtime 在多个 spike 中反复出现？
   - **Structure patterns** — 常见文件布局、端口号、命名方案
   - **Recurring approaches** — auth 如何处理、styling 如何实现、data 如何提供
   - **Tools & libraries** — 反复出现且版本验证可用的 packages

2. 写入或更新 `.planning/spikes/CONVENTIONS.md`：

```markdown
# Spike Conventions

跨多个 spike 会话形成的模式和技术栈选择。除非问题本身要求不同，否则新的 spikes 都遵循这些约定。

## Stack
[前端、后端、脚本分别使用什么，以及原因；从多个 spikes 中反复出现的内容归纳得出]

## Structure
[常见文件布局、端口分配、命名模式]

## Patterns
[反复出现的方法：auth 如何处理、styling 如何做、serving 如何做，等等]

## Tools & Libraries
[优先使用且已验证可行的 packages 及版本，以及需要避免的项]
```

3. 只纳入在 2 个以上 spike 中出现过，或由用户明确选定的模式。

4. 如果 `CONVENTIONS.md` 已存在（追加模式），用新模式更新各部分。删除被更新 spike 结论推翻的旧条目。
</step>

<step name="commit">
如果 `COMMIT_DOCS` 为 true，则提交所有产物：

```bash
gsd-sdk query commit "docs(spike-wrap-up): package [N] spike findings into project skill" .planning/spikes/WRAP-UP-SUMMARY.md .planning/spikes/CONVENTIONS.md
```
</step>

<step name="report">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPIKE WRAP-UP COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Processed:** {N} spikes
**Feature areas:** {list}
**Skill:** `./.claude/skills/spike-findings-[project]/`
**Conventions:** `.planning/spikes/CONVENTIONS.md`
**Summary:** `.planning/spikes/WRAP-UP-SUMMARY.md`
**CLAUDE.md:** 已添加 routing line

spike-findings skill 会在未来的构建对话中自动加载。
```
</step>

<step name="whats_next">
## 接下来做什么

在总结后，展示下一步选项：

───────────────────────────────────────────────────────────────

## ▶ Next Up

**探索 frontier spikes** — 基于当前已学到的内容，看看还有哪些值得继续做 spike

`/gsd-spike`（不带参数运行，它的 frontier mode 会分析 spike 全景并提出 integration / frontier spikes）

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-plan-phase` — 开始规划真实实现
- `/gsd-spike [idea]` — 对某个具体新想法做 spike
- `/gsd-explore` — 继续探索
- Other

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] 所有未处理的 spikes 均已自动纳入并处理
- [ ] spikes 已按特性领域分组
- [ ] `./.claude/skills/` 下存在 spike-findings skill，包含 SKILL.md（含 requirements）、references/、sources/
- [ ] Reference 文件是实现蓝图，包含 Requirements、How to Build It、What to Avoid、Constraints
- [ ] `.planning/spikes/CONVENTIONS.md` 已创建或更新，包含反复出现的 stack/structure/pattern 选择
- [ ] `.planning/spikes/WRAP-UP-SUMMARY.md` 已写入，用于项目历史记录
- [ ] 项目 CLAUDE.md 已添加自动加载路由
- [ ] 已展示总结
- [ ] 已展示下一步选项（包括通过 `/gsd-spike` 进行 frontier spike 探索）
</success_criteria>
