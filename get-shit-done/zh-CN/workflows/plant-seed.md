<purpose>
将一个面向未来的想法记录为带触发条件的结构化 seed 文件。
当触发条件与新 milestone 的范围匹配时，seed 会在 /gsd-new-milestone 期间自动显示。

相比延后处理的事项，seed 更有优势，因为它们会：
- 保留这个想法为什么重要（而不只是做什么）
- 定义何时显示（基于触发条件，而不是手动扫描）
- 追踪线索（代码引用、相关决策）
- 在合适的时机通过 new-milestone 扫描自动呈现
</purpose>

<process>

<step name="parse_idea">
解析 `$ARGUMENTS` 以获取想法摘要。

如果为空，询问：
```
这个想法是什么？（一句话）
```

存储为 `$IDEA`。
</step>

<step name="create_seed_dir">
```bash
mkdir -p .planning/seeds
```
</step>

<step name="gather_context">
提出聚焦问题，以构建完整的 seed：

**文本模式（配置中的 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中存在 `--text`，或者 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 启用时，用纯文本编号列表替换每一次 `AskUserQuestion` 调用，并要求用户输入所选编号。对于不支持 `AskUserQuestion` 的非-Claude 运行时（OpenAI Codex、Gemini CLI 等），这是必需的。

```
AskUserQuestion(
  header: "Trigger",
  question: "这个想法应在什么时候显示？（例如：'当我们添加用户账户时'、'下一个主版本'、'当性能成为优先事项时'）",
  options: []  // freeform
)
```

存储为 `$TRIGGER`。

```
AskUserQuestion(
  header: "Why",
  question: "这为什么重要？它解决了什么问题，或创造了什么机会？",
  options: []
)
```

存储为 `$WHY`。

```
AskUserQuestion(
  header: "Scope",
  question: "这个有多大？（粗略估计）",
  options: [
    { label: "Small", description: "几个小时 - 可以是一个快速任务" },
    { label: "Medium", description: "一个或两个阶段 - 需要规划" },
    { label: "Large", description: "一个完整 milestone - 工作量显著" }
  ]
)
```

存储为 `$SCOPE`。
</step>

<step name="collect_breadcrumbs">
在代码库中搜索相关引用：

```bash
# Find files related to the idea keywords
grep -rl "$KEYWORD" --include="*.ts" --include="*.js" --include="*.md" . 2>/dev/null | head -10
```

还要检查：
- 当前的 STATE.md 中是否有相关决策
- ROADMAP.md 中是否有相关阶段
- todos/ 中是否有相关的已记录想法

将相关文件路径存储为 `$BREADCRUMBS`。
</step>

<step name="generate_seed_id">
```bash
# Find next seed number
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
NEXT=$((EXISTING + 1))
PADDED=$(printf "%03d" $NEXT)
```

根据想法摘要生成 slug。
</step>

<step name="write_seed">
写入 `.planning/seeds/SEED-{PADDED}-{slug}.md`：

```markdown
---
id: SEED-{PADDED}
status: dormant
planted: {ISO 日期}
planted_during: {来自 STATE.md 的当前 milestone/phase}
trigger_when: {$TRIGGER}
scope: {$SCOPE}
---

# SEED-{PADDED}: {$IDEA}

## 为什么这很重要

{$WHY}

## 何时显示

**触发条件：** {$TRIGGER}

当 milestone 范围匹配以下任一条件时，
应在 `/gsd-new-milestone` 期间呈现这个 seed：
- {触发条件 1}
- {触发条件 2}

## 范围估算

**{$SCOPE}** - {基于范围选择的补充说明}

## Breadcrumbs

在当前代码库中找到的相关代码和决策：

{$BREADCRUMBS 的列表及文件路径}

## Notes

{当前会话中的任何额外上下文}
```
</step>

<step name="commit_seed">
```bash
gsd-sdk query commit "docs: plant seed — {$IDEA}" .planning/seeds/SEED-{PADDED}-{slug}.md
```
</step>

<step name="confirm">
```
✅ 已种下 seed：SEED-{PADDED}

"{$IDEA}"
触发条件：{$TRIGGER}
范围：{$SCOPE}
文件：.planning/seeds/SEED-{PADDED}-{slug}.md

当你运行 /gsd-new-milestone 且 milestone 范围匹配触发条件时，
这个 seed 会自动显示。
```
</step>

</process>

<success_criteria>
- [ ] 已在 .planning/seeds/ 中创建 seed 文件
- [ ] frontmatter 包含 status、trigger、scope
- [ ] 已从代码库收集 breadcrumbs
- [ ] 已提交到 git
- [ ] 已向用户显示包含触发信息的确认内容
</success_criteria>
