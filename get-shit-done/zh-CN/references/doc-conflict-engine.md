# Doc Conflict Engine

供将外部内容摄入 `.planning/` 的工作流共享使用的冲突检测契约（例如 `/gsd-import`, `/gsd-ingest-docs`）。它定义了报告格式、严重级别语义以及安全门行为。至于每个严重级别里具体检查哪些内容，则由调用工作流自己定义。

---

## Severity Semantics

- **[BLOCKER]** — 不可安全继续。工作流**必须**退出，且不得写入任何目标文件。用于已锁定决策的冲突、缺失前置条件以及不可能的目标。
- **[WARNING]** — 含糊或部分重叠。工作流**必须**展示警告，并在写入前获得用户明确批准。绝不能自动批准。
- **[INFO]** — 仅作信息说明。无门禁；无需用户提示。出于透明度仍应纳入报告。

---

## Report Format

使用纯文本，绝不要用 markdown tables（不要出现 `|---|`）。报告会原样呈现给用户。

```
## Conflict Detection Report

### BLOCKERS ({N})

[BLOCKER] {Short title}
  Found: {what the incoming content says}
  Expected: {what existing project context requires}
  → {Specific action to resolve}

### WARNINGS ({N})

[WARNING] {Short title}
  Found: {what was detected}
  Impact: {what could go wrong}
  → {Suggested action}

### INFO ({N})

[INFO] {Short title}
  Note: {relevant information}
```

每条记录都必须包含 `Found:`，再加上 `Expected:` / `Impact:` / `Note:` 之一；而 BLOCKER/WARNING 还必须包含 `→` 修复指引行。

---

## Safety Gate

**If any [BLOCKER] exists:**

显示：
```
GSD > BLOCKED: {N} blockers must be resolved before {operation} can proceed.
```

退出，**且不写入任何目标文件**。无论 WARNING/INFO 数量如何，只要有 BLOCKER，这个门就必须生效。

**If only WARNINGS and/or INFO (no blockers):**

渲染完整报告，然后使用 `references/gate-prompts.md` 中的 `approve-revise-abort` 或 `yes-no` 模式请求批准。要遵守文本模式（见工作流自身的 text-mode 处理）。如果用户放弃，则干净退出并给出取消消息。

**If the report is empty (no entries in any bucket):**

可静默继续，或显示 `GSD > No conflicts detected.`。两者都可以，由工作流按冗长程度自行选择。

---

## Workflow Responsibilities

每个使用此契约的工作流都必须定义：

1. **其自身的 bucket 检查清单** — 哪些条件归类为 BLOCKER、WARNING、INFO。这是领域相关的（计划导入检查不等于文档导入检查）。
2. **已加载的上下文** — 在运行检查前它会读取什么（ROADMAP.md、PROJECT.md、REQUIREMENTS.md、CONTEXT.md、intel files）。
3. **操作名词** — 替换 BLOCKED 横幅中的 `{operation}`（例如 `import`、`ingest`）。

工作流**不得**：

- 引入除 BLOCKER/WARNING/INFO 之外的新严重级别
- 以 markdown table 的形式渲染报告
- 在存在 BLOCKER 时写入任何目标文件
- 在没有用户输入的情况下越过 WARNING 自动批准

---

## Anti-Patterns

不要：

- 在冲突报告中使用 markdown tables（`|---|`）—— 按上面的纯文本标签格式写
- 在存在 BLOCKER 时绕过安全门 —— 即使是“轻微” blocker 也不例外
- 将 WARNING 塞进 INFO 里来跳过批准提示 —— 只要需要用户输入，它就是 WARNING
- 每个工作流自造严重级别标签 —— 三级分类法是固定的
