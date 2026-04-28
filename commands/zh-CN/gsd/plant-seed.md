---
name: gsd:plant-seed
description: 记录一个面向未来的想法及其触发条件，在合适的里程碑自动浮现
argument-hint: "[idea summary]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
记录一个当前还太大的想法，但在合适的里程碑到来时应自动浮现。Seed 可以解决上下文腐蚀：与其在 Deferred 里留下没人会看的单行备注，不如用 seed 保留完整的 WHY、何时浮现，以及指向细节的线索。

Creates: .planning/seeds/SEED-NNN-slug.md
Consumed by: /gsd-new-milestone（会扫描 seeds 并展示匹配项）
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plant-seed.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/plant-seed.md 中的 plant-seed workflow。
</process>
