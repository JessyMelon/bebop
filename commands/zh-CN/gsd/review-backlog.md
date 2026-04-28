---
name: gsd:review-backlog
description: 审查 backlog 条目，并将其提升到当前活跃里程碑
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
审查所有 999.x backlog 条目，并可选择将它们提升到当前活跃里程碑序列，或删除陈旧条目。
</objective>

<process>

1. **列出 backlog 条目：**
   ```bash
   ls -d .planning/phases/999* 2>/dev/null || echo "No backlog items found"
   ```

2. **读取 ROADMAP.md** 并提取所有 999.x phase 条目：
   ```bash
   cat .planning/ROADMAP.md
   ```
   展示每个 backlog 条目的描述、累计上下文（CONTEXT.md、RESEARCH.md）和创建日期。

3. **通过 AskUserQuestion 向用户展示列表：**
   - 对每个 backlog 条目，展示：phase 编号、描述、累计产物
   - 每项可选：**Promote**（移入活跃序列）、**Keep**（保留在 backlog）、**Remove**（删除）

4. **对于要 PROMOTE 的条目：**
   - 找到当前活跃里程碑中的下一个顺序 phase 编号
   - 将目录从 `999.x-slug` 重命名为 `{new_num}-slug`：
     ```bash
     NEW_NUM=$(gsd-sdk query phase.add "${DESCRIPTION}" --raw)
     ```
   - 将累计产物移动到新的 phase 目录
   - 更新 ROADMAP.md：将条目从 `## Backlog` section 移到活跃 phase 列表
   - 移除 `(BACKLOG)` 标记
   - 添加合适的 `**Depends on:**` 字段

5. **对于要 REMOVE 的条目：**
   - 删除 phase 目录
   - 从 ROADMAP.md 的 `## Backlog` section 中移除条目

6. **提交变更：**
   ```bash
   gsd-sdk query commit "docs: review backlog — promoted N, removed M" .planning/ROADMAP.md
   ```

7. **报告摘要：**
   ```
   ## 📋 Backlog Review Complete

   Promoted: {list of promoted items with new phase numbers}
   Kept: {list of items remaining in backlog}
   Removed: {list of deleted items}
   ```

</process>
