<purpose>
先通过一次性 HTML mockup 探索设计方向，再决定是否进入实现。
每个 sketch 会产出 2-3 个 variants 供比较。artifacts 保存到 `.planning/sketches/`。
它是 `/gsd-sketch-wrap-up` 的配套流程。

支持两种模式：
- **Idea mode**（默认）— 用户描述一个要 sketch 的设计想法
- **Frontier mode** — 无参数，或传入 `frontier` / `what should I sketch?` — 分析现有 sketch 全景，并提出 consistency sketch 与 frontier sketch
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。

@~/.claude/get-shit-done/references/sketch-theme-system.md
@~/.claude/get-shit-done/references/sketch-variant-patterns.md
@~/.claude/get-shit-done/references/sketch-interactivity.md
@~/.claude/get-shit-done/references/sketch-tooling.md
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

解析 `$ARGUMENTS`：
- `--quick` flag → 设置 `QUICK_MODE=true`
- `--text` flag → 设置 `TEXT_MODE=true`
- `frontier` 或空参数 → 设置 `FRONTIER_MODE=true`
- 其余文本 → 作为要 sketch 的设计想法

**文本模式：** 如果启用 `TEXT_MODE`，将 `AskUserQuestion` 调用替换为纯文本编号列表。
</step>

<step name="route">
## 路由

- **`FRONTIER_MODE` 为 true** → 跳到 `frontier_mode`
- **否则** → 继续到 `setup_directory`
</step>

<step name="frontier_mode">
## Frontier Mode — 提议下一步该 Sketch 什么

### 加载 Sketch 全景

如果不存在 `.planning/sketches/` 目录，告诉用户当前没有可分析内容，并提供从一个新想法开始的选项。

否则，按以下顺序加载：

**a. MANIFEST.md** — 设计方向、参考点，以及包含 winners 的 sketch 表。

**b. Findings skills** — glob `./.claude/skills/sketch-findings-*/SKILL.md`，读取存在的文件及其 `references/*.md`。这些文件包含此前 wrap-up 整理出的设计决策。

**c. 所有 sketch README** — 读取 `.planning/sketches/*/README.md`，获取设计问题、winners 和 tags。

### 分析 Consistency Sketches

检查所有 sketches 中的 winning variants。寻找：

- **视觉一致性缺口：** 两个 sketches 分别做出了独立设计选择，但还没一起验证过。
- **状态组合：** 单独状态已经验证过，但还没按真实顺序串起来看。
- **响应式缺口：** 只在一个 viewport 验证过，但真实应用需要多个。
- **主题一致性：** 单个组件看起来不错，但还没组合成完整页面验证。

如果存在 consistency 风险，把它们作为具体 sketch 提案展示出来，包含名称和设计问题。如果没有有意义的缺口，直接说明并跳过。

### 分析 Frontier Sketches

围绕 MANIFEST.md 中的设计方向，以及已经探索过的内容，横向思考：

- **尚未 sketch 的页面：** 已被默认需要，但尚未探索的 UI 面。
- **交互模式：** 静态布局已验证，但 transitions、loading、drag-and-drop 还需要实际感觉。
- **边界情况 UI：** 0 项、1000 项、错误、慢连接。
- **替代方向：** 对“还行但不够好”的 sketches 给出新思路。
- **打磨轮次：** typography、spacing、micro-interactions、empty states。

将 frontier sketches 作为具体提案展示，并从当前最大 sketch 编号继续编号。

### 对齐并执行

展示所有 consistency 和 frontier 候选，然后询问要运行哪些。用户选定 sketches 后，更新 `.planning/sketches/MANIFEST.md`，并直接从 `build_sketches` 开始构建。
</step>

<step name="setup_directory">
如果不存在，则创建 `.planning/sketches/` 和 themes 目录：

```bash
mkdir -p .planning/sketches/themes
```

检查现有 sketches，以确定编号：
```bash
ls -d .planning/sketches/[0-9][0-9][0-9]-* 2>/dev/null | sort | tail -1
```

检查 `commit_docs` 配置：
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="mood_intake">
**如果 `QUICK_MODE` 为 true：** 跳过 mood intake。直接使用用户在 `$ARGUMENTS` 中提供的内容作为设计方向。跳到 `load_spike_context`。

**否则：**

在开始 sketch 之前，先通过对话探索设计意图。一次只问一个问题：普通模式用 `AskUserQuestion`，如果启用 `TEXT_MODE`，则使用纯文本编号列表。

**需要覆盖的问题（根据用户已提供的信息灵活调整）：**

1. **Feel：** `"What should this feel like? Give me adjectives, emotions, or a vibe."`
2. **References：** `"What apps, sites, or products have a similar feel to what you're imagining?"`
3. **Core action：** `"What's the single most important thing a user does here?"`

每次回答后，简短复述你听到的内容，以及这会如何影响你的判断。

当你认为信息已经足够时，询问：**`"I think I have a good sense of the direction. Ready for me to sketch, or want to keep discussing?"`**

只有在用户明确表示开始后，才继续。
</step>

<step name="load_spike_context">
## 加载 Spike 上下文

如果该项目存在 spikes，先读取它们，让 sketches 建立在真实信息上。mockups 仍然是纯 HTML，但应反映已经被验证过的内容：真实的数据形状、真实的组件名称、真实的交互模式。

**a.** Glob `./.claude/skills/spike-findings-*/SKILL.md` 并读取存在的文件及其 `references/*.md`。这些文件包含已验证的 patterns 和 requirements。

**b.** 如果存在，就读取 `.planning/spikes/MANIFEST.md` — 检查 Requirements 部分里不可协商的设计约束（例如 `"must support streaming"`、`"must render markdown"`）。即使 mockup 并未真实实现，它也应把这些要求体现出来。

**c.** 如果存在，就读取 `.planning/spikes/CONVENTIONS.md` — 已确定的 stack 会影响哪些东西可构建，以及哪些交互模式符合惯例。

**spike 上下文如何提升 sketches：**
- 使用 spike findings 中的真实字段名和数据形状，而不是泛化占位符
- 展示与 spikes 已验证结论一致的真实 UI 状态（例如，如果已验证 streaming，就展示 streaming message 状态）
- 引用目标 stack 中真实的组件名称和 patterns
- 包含能反映 spike 结论的交互状态（loading、error、reconnection states）

**如果不存在 spikes**，跳过此步骤。
</step>

<step name="decompose">
把这个想法拆成 2-5 个设计问题。用表格展示：

| Sketch | Design question | Approach | Risk |
|--------|----------------|----------|------|
| 001 | Does a two-panel layout feel right? | Sidebar + main, variants: fixed/collapsible/floating | **High** — sets page structure |
| 002 | How should the form controls look? | Grouped cards, variants: stacked/inline/floating labels | Medium |

每个 sketch 只回答一个明确的视觉问题。好的 sketches：
- `"Does this layout feel right?"` — 用接近真实的内容来构建
- `"How should these controls be grouped?"` — 用实际 labels 和 inputs 来构建
- `"What does this interaction feel like?"` — 构建 hover/click/transition
- `"Does this color palette work?"` — 应用到真实 UI 上，而不是单纯做色板网格

不好的 sketches：
- `"Design the whole app"` — 范围太大
- `"Set up the component library"` — 那是实现工作
- `"Pick a color palette"` — 应该把它应用到 UI 上再看

展示表格并先取得一致，再开始构建。
</step>

<step name="research_stack">
## 研究目标 Stack

开始 sketch 前，先把设计建立在真实可构建的约束上。sketches 是 HTML，但它们应反映目标实现的真实限制。

**a. 识别目标 stack。** 检查 `package.json`、`Cargo.toml` 等。如果用户提到了某个框架（React、SwiftUI、Flutter 等），记下来。

**b. 检查组件/pattern 可用性。** 使用 context7（resolve-library-id → query-docs）或 web search，回答：
- 目标框架提供哪些 layout primitives？
- 是否已经在使用现成的 component libraries？有哪些 components 可用？
- 哪些交互 patterns 符合惯例？

**c. 记录会影响设计的约束：**
- 平台惯例（iOS nav patterns、桌面 menu bars、terminal grid constraints）
- 框架限制（哪些容易做，哪些需要 custom work）
- 项目中已有的 design tokens 或 theme systems

**d. 用研究结果指导 variants。** 至少要有一个 variant 走目标 stack 的最省力路径。

**不必要时跳过。** 例如 greenfield 项目没有 stack，或用户明确说“先只做视觉探索”。重点是建立现实约束，不是设门槛。
</step>

<step name="create_manifest">
创建或更新 `.planning/sketches/MANIFEST.md`：

```markdown
# Sketch Manifest

## Design Direction
[One paragraph capturing the mood/feel/direction from the intake conversation]

## Reference Points
[Apps/sites the user referenced]

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
```

如果 MANIFEST.md 已存在，就把新 sketches 追加到现有表格中。
</step>

<step name="create_theme">
如果 `.planning/sketches/themes/default.css` 还不存在 theme，就基于 intake 步骤里确定的 mood/direction 创建一个。完整模板见 `sketch-theme-system.md`。

调整 colors、fonts、spacing 和 shapes 以匹配已达成一致的审美；除非默认值刚好符合该 mood，否则不要原样照搬。
</step>

<step name="build_sketches">
按顺序构建每个 sketch。

### 对每个 Sketch：

**a.** 找到下一个可用编号。格式：三位零填充数字 + 连字符描述名。

**b.** 创建 sketch 目录：`.planning/sketches/NNN-descriptive-name/`

**c.** 构建包含 2-3 个 variants 的 `index.html`：

**第一轮 — 强烈差异：** 2-3 个真正不同的方向。
**后续轮次 — 细化：** 在选定方向内做更细微的变化。

每个 variant 都是同一个 HTML 文件中的一个页面/tab。需要包含：
- 用于切换 variants 的 tab navigation（见 `sketch-variant-patterns.md`）
- 清晰标签：`"Variant A: Sidebar Layout"`、`"Variant B: Top Nav"` 等
- sketch toolbar（见 `sketch-tooling.md`）
- 所有交互元素都可用（见 `sketch-interactivity.md`）
- 接近真实的内容，而不是 lorem ipsum（如可用，使用 spike 上下文中的真实字段名）
- 链接到 `../themes/default.css` 以复用共享 theme variables

**所有 sketches 都必须是带内联 CSS 和 JS 的纯 HTML。** 不要 build step，不要 npm，不要 framework。

**d.** 写入 `README.md`：

```markdown
---
sketch: NNN
name: descriptive-name
question: "What layout structure feels right for the dashboard?"
winner: null
tags: [layout, dashboard]
---

# Sketch NNN: Descriptive Name

## Design Question
[The specific visual question this sketch answers]

## How to View
open .planning/sketches/NNN-descriptive-name/index.html

## Variants
- **A: [name]** — [one-line description of this approach]
- **B: [name]** — [one-line description]
- **C: [name]** — [one-line description]

## What to Look For
[Specific things to pay attention to when comparing variants]
```

**e.** 向用户展示，并设置 checkpoint：

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Sketch {NNN}: {name}**

Open: `open .planning/sketches/NNN-name/index.html`

Compare: {what to look for between variants}

──────────────────────────────────────────────────────────────
→ Which variant feels right? Or cherry-pick elements across variants.
──────────────────────────────────────────────────────────────

**f.** 处理反馈：
- **选定方向：** 标记 winner，进入下一个 sketch
- **混搭元素：** 生成新的综合 variant，再次展示
- **想继续探索：** 构建新的 variants

迭代直到用户满意。

**g.** 定稿：
1. 在 README frontmatter 中标记 winning variant（`winner: "B"`）
2. 在 HTML 中给获胜 tab 添加 ★ 标记
3. 更新 `.planning/sketches/MANIFEST.md`

**h.** 提交（如果 `COMMIT_DOCS` 为 true）：
```bash
gsd-sdk query commit "docs(sketch-NNN): [winning direction] — [key visual insight]" .planning/sketches/NNN-descriptive-name/ .planning/sketches/MANIFEST.md
```

**i.** 报告：
```
◆ Sketch NNN: {name}
  Winner: Variant {X} — {description}
  Insight: {key visual decision made}
```
</step>

<step name="report">
所有 sketches 完成后：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Design Direction
{what we landed on overall}

## Key Decisions
{layout, palette, typography, spacing, interaction patterns}

## Open Questions
{anything unresolved or worth revisiting}
```

───────────────────────────────────────────────────────────────

## ▶ 下一步

**打包结论** — 将设计决策整理为可复用 skill

`/gsd-sketch-wrap-up`

───────────────────────────────────────────────────────────────

**还可使用：**
- `/gsd-sketch` — 继续做 sketch（或无参数运行以进入 frontier mode）
- `/gsd-plan-phase` — 开始构建真实 UI
- `/gsd-spike` — 对某个设计模式的技术可行性做 spike

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] 已创建 `.planning/sketches/`（若缺失则自动创建，无需项目初始化）
- [ ] 在任何编码前，已先通过对话探索设计方向（除非 `--quick`）
- [ ] 已加载 spike 上下文，真实数据形状、requirements 和 conventions 已用于 mockups
- [ ] 已研究目标 stack，组件可用性、约束和惯用法已纳入考虑（除非 greenfield/显式跳过）
- [ ] 每个 sketch 都有 2-3 个 variants 供比较（至少一个遵循最省力路径）
- [ ] 用户可以在浏览器中打开并交互查看 sketches
- [ ] 已为每个 sketch 选出并标记 winning variant
- [ ] 保留了所有 variants（只标记 winner，不删除其他项）
- [ ] MANIFEST.md 已保持最新
- [ ] 提交使用 `docs(sketch-NNN): [winner]` 格式
- [ ] 已展示 summary 和下一步路由
</success_criteria>
