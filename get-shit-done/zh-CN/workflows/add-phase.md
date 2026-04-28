<purpose>
在 roadmap 中当前 milestone 的末尾新增一个整数 phase。自动计算下一个 phase 编号、创建 phase 目录，并更新 roadmap 结构。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="parse_arguments">
解析命令参数：
- 所有参数都作为 phase 描述
- 示例：`/gsd-add-phase Add authentication` → description = "Add authentication"
- 示例：`/gsd-add-phase Fix critical performance issues` → description = "Fix critical performance issues"

如果未提供参数：

```
ERROR: Phase description required
Usage: /gsd-add-phase <description>
Example: /gsd-add-phase Add authentication system
```

退出。
</step>

<step name="init_context">
加载 phase 操作上下文：

```bash
INIT=$(gsd-sdk query init.phase-op "0")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

检查 init JSON 中的 `roadmap_exists`。如果为 false：
```
ERROR: No roadmap found (.planning/ROADMAP.md)
Run /gsd-new-project to initialize.
```
退出。
</step>

<step name="add_phase">
**将 phase 新增委托给 `gsd-sdk query phase.add`：**

```bash
RESULT=$(gsd-sdk query phase.add "${description}")
```

CLI 会负责：
- 查找现有的最大整数 phase 编号
- 计算下一个 phase 编号（max + 1）
- 根据描述生成 slug
- 创建 phase 目录（`.planning/phases/{NN}-{slug}/`）
- 在 ROADMAP.md 中插入 phase 条目，并包含 Goal、Depends on、Plans 各节

从结果中提取：`phase_number`, `padded`, `name`, `slug`, `directory`。
</step>

<step name="update_project_state">
更新 STATE.md 以反映新 phase：

1. 读取 `.planning/STATE.md`
2. 在 "## Accumulated Context" → "### Roadmap Evolution" 下新增条目：
   ```
   - Phase {N} added: {description}
   ```

如果不存在 "Roadmap Evolution" 小节，则创建它。
</step>

<step name="completion">
展示完成摘要：

```
Phase {N} added to current milestone:
- Description: {description}
- Directory: .planning/phases/{phase-num}-{slug}/
- Status: Not planned yet

Roadmap updated: .planning/ROADMAP.md

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {N}: {description}**

`/clear` 然后：

`/gsd-plan-phase {N}`

---

**也可继续：**
- `/gsd-add-phase <description>` — 再添加一个 phase
- 查看 roadmap

---
```
</step>

</process>

<success_criteria>
- [ ] `gsd-sdk query phase.add` 成功执行
- [ ] 已创建 phase 目录
- [ ] roadmap 已新增 phase 条目
- [ ] STATE.md 已写入 roadmap evolution 说明
- [ ] 已告知用户后续步骤
</success_criteria>
