---
name: gsd:add-backlog
description: 将一个想法加入 backlog 停放区（使用 999.x 编号）
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
使用 999.x 编号将一个 backlog 条目添加到 roadmap。Backlog 条目是尚未准备进入主动规划的未排序想法，它们位于正常 phase 序列之外，并会随着时间逐步积累上下文。
</objective>

<process>

1. **读取 ROADMAP.md** 以查找现有 backlog 条目：
   ```bash
   cat .planning/ROADMAP.md
   ```

2. **找到下一个 backlog 编号：**
   ```bash
   NEXT=$(gsd-sdk query phase.next-decimal 999 --raw)
   ```
   如果不存在任何 999.x phase，则从 999.1 开始。

3. **将内容添加到 ROADMAP.md** 的 `## Backlog` 区段下。如果该区段不存在，就在文件末尾创建。
   在创建目录之前先写入 ROADMAP 条目，这样目录是否存在始终可以可靠地表示该 phase 是否已注册，从而避免任何检查现有 999.x 目录的 hook 出现重复误判（#2280）：

   ```markdown
   ## Backlog

   ### Phase {NEXT}: {description} (BACKLOG)

   **Goal:** [Captured for future planning]
   **Requirements:** TBD
   **Plans:** 0 plans

   Plans:
   - [ ] TBD (promote with /gsd-review-backlog when ready)
   ```

4. **创建 phase 目录：**
   ```bash
   SLUG=$(gsd-sdk query generate-slug "$ARGUMENTS" --raw)
   mkdir -p ".planning/phases/${NEXT}-${SLUG}"
   touch ".planning/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

5. **提交：**
   ```bash
   gsd-sdk query commit "docs: add backlog item ${NEXT} — ${ARGUMENTS}" .planning/ROADMAP.md ".planning/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

6. **报告：**
   ```
   ## 📋 已添加 Backlog 条目

   Phase {NEXT}: {description}
   目录：.planning/phases/{NEXT}-{slug}/

   该条目位于 backlog 停放区。
   使用 /gsd-discuss-phase {NEXT} 进一步展开。
   使用 /gsd-review-backlog 将条目提升到活跃 milestone。
   ```

</process>

<notes>
- 999.x 编号可让 backlog 条目保持在活跃 phase 序列之外
- 会立即创建 phase 目录，因此 /gsd-discuss-phase 和 /gsd-plan-phase 可以直接作用于这些条目
- 不使用 `Depends on:` 字段，backlog 条目按定义就是未排序的
- 稀疏编号是可以的（999.1、999.3），始终使用 next-decimal
</notes>
