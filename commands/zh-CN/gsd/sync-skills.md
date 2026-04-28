---
name: gsd:sync-skills
description: 在各个 runtime root 之间同步受管理的 GSD skills，确保多 runtime 用户在更新后保持一致
allowed-tools:
  - Bash
  - AskUserQuestion
---

<objective>
将受管理的 `gsd-*` skill 目录，从一个规范 runtime 的 skills root，同步到一个或多个目标 runtime skills root。

转到 sync-skills 工作流，由它处理以下内容：
- 参数解析（--from、--to、--dry-run、--apply）
- 通过 install.js --skills-root 解析 runtime skills root
- 差异计算（针对每个目标的 CREATE / UPDATE / REMOVE）
- Dry-run 报告（默认，不执行写入）
- Apply 执行（带幂等性的复制与移除）
- 保留非 GSD skill（只处理 gsd-* 目录）
</objective>
