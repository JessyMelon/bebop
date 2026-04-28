<purpose>
在里程碑进行中发现紧急工作时，在现有整数 phase 之间插入一个小数 phase。使用小数编号（72.1、72.2 等）来保留原有 phase 的逻辑顺序，同时无需重排整份 roadmap。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="parse_arguments">
解析命令参数：
- 第一个参数：要在其后插入的整数 phase 编号
- 其余参数：phase 描述

示例：`/gsd-insert-phase 72 Fix critical auth bug`
-> after = 72
-> description = "Fix critical auth bug"

如果参数缺失：

```
ERROR: Both phase number and description required
Usage: /gsd-insert-phase <after> <description>
Example: /gsd-insert-phase 72 Fix critical auth bug
```

退出。

验证第一个参数是整数。
</step>

<step name="init_context">
加载 phase operation 上下文：

```bash
INIT=$(gsd-sdk query init.phase-op "${after_phase}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

检查 init JSON 中的 `roadmap_exists`。如果为 false：
```
ERROR: No roadmap found (.planning/ROADMAP.md)
```
退出。
</step>

<step name="insert_phase">
**将 phase 插入委派给 `gsd-sdk query phase.insert`：**

```bash
RESULT=$(gsd-sdk query phase.insert "${after_phase}" "${description}")
```

CLI 负责：
- 验证目标 phase 在 ROADMAP.md 中存在
- 计算下一个小数 phase 编号（检查磁盘上已有的小数 phase）
- 从 description 生成 slug
- 创建 phase 目录（`.planning/phases/{N.M}-{slug}/`）
- 在目标 phase 后将该 phase 条目插入 ROADMAP.md，并带 `(INSERTED)` marker

从结果中提取：`phase_number`、`after_phase`、`name`、`slug`、`directory`。
</step>

<step name="update_project_state">
更新 STATE.md 以反映插入的 phase：

1. 读取 `.planning/STATE.md`
2. 将 STATE.md 中的 next-phase 指针更新为新插入的 phase `{decimal_phase}`：
   - 将 tooling 使用的结构化字段（例如 `current_phase:`）更新为 `{decimal_phase}`。
   - 将面向人的推荐文本（例如 `## Current Phase`、`Next recommended run:`）更新为 `{decimal_phase}`。
   - 如果存在多个指针位置，需在同一次编辑中全部更新。
3. 在 "## Accumulated Context" → "### Roadmap Evolution" 下添加：
   ```
   - Phase {decimal_phase} inserted after Phase {after_phase}: {description} (URGENT)
   ```

如果不存在 "Roadmap Evolution" section，则创建它。
</step>

<step name="completion">
展示完成摘要：

```
Phase {decimal_phase} inserted after Phase {after_phase}:
- Description: {description}
- Directory: .planning/phases/{decimal-phase}-{slug}/
- Status: Not planned yet
- Marker: (INSERTED) - indicates urgent work

Roadmap updated: .planning/ROADMAP.md
Project state updated: .planning/STATE.md

---

## Next Up

**Phase {decimal_phase}: {description}** -- urgent insertion

`/clear` then:

`/gsd-plan-phase {decimal_phase}`

---

**Also available:**
- Review insertion impact: Check if Phase {next_integer} dependencies still make sense
- Review roadmap

---
```
</step>

</process>

<anti_patterns>

- 不要把它用于里程碑末尾的已规划工作（请用 /gsd-add-phase）
- 不要在 Phase 1 之前插入（小数 0.1 没有意义）
- 不要重编号现有 phases
- 不要修改目标 phase 的内容
- 不要现在创建 plans（那是 /gsd-plan-phase 的工作）
- 不要提交更改（是否 commit 由用户决定）
</anti_patterns>

<success_criteria>
满足以下条件时，phase 插入完成：

- [ ] `gsd-sdk query phase.insert` 成功执行
- [ ] 已创建 phase 目录
- [ ] Roadmap 已更新并包含新的 phase 条目（含 `(INSERTED)` marker）
- [ ] STATE.md 已更新并记录 roadmap evolution 说明
- [ ] 已告知用户后续步骤和依赖影响
</success_criteria>
