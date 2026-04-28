---
name: gsd:from-gsd2
description: 将 GSD-2（`.gsd/`）项目导回 GSD v1（`.planning/`）格式
argument-hint: "[--path <dir>] [--force]"
allowed-tools:
  - Read
  - Write
  - Bash
type: prompt
---

<objective>
将一个 GSD-2 项目（`.gsd/` 目录）反向迁移回 GSD v1（`.planning/`）格式。

把 GSD-2 层级（Milestone → Slice → Task）映射为 GSD v1 层级（ROADMAP.md 中的 Milestone sections → Phase → Plan），同时保留完成状态、研究文件和摘要。

**仅限 CJS：** `from-gsd2` 不在 `gsd-sdk query` 注册表中；请按下文所示调用 `gsd-tools.cjs`（见 `docs/CLI-TOOLS.md`）。
</objective>

<process>

1. **定位 .gsd/ 目录**：检查当前工作目录（或 `--path` 参数指定的位置）：
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" from-gsd2 --dry-run
   ```
   如果未找到 `.gsd/`，报告错误并停止。

2. **展示 dry-run 预览**：向用户展示完整文件列表和迁移统计信息。写入任何内容前先请求确认。

3. **确认后执行迁移**：
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" from-gsd2
   ```
   如果 `.planning/` 已存在，且用户已确认覆盖，则使用 `--force`。

4. **报告结果**：展示 `filesWritten` 数量、`planningDir` 路径，以及预览摘要。

</process>

<notes>
- 迁移是非破坏性的：绝不会修改或删除 `.gsd/`。
- 传入 `--path <dir>` 可迁移当前目录之外路径下的项目。
- Slices 会跨所有 milestones 顺序编号（M001/S01 → phase 01，M001/S02 → phase 02，M002/S01 → phase 03，依此类推）。
- 每个 slice 内的 tasks 会变成 plans（T01 → plan 01，T02 → plan 02，依此类推）。
- 已完成的 slices 和 tasks 会将完成状态带入 ROADMAP.md 的复选框和 SUMMARY.md 文件。
- GSD-2 的 cost/token ledger、database state 和 VS Code extension state 无法迁移。
</notes>
