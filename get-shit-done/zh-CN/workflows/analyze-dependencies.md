<purpose>
在执行前分析 ROADMAP.md 中各 phase 的依赖关系。检测 phases 之间的文件重叠、语义化 API/数据流依赖，并建议填写 `Depends on` 条目，以避免 `/gsd-manager` 并行执行时产生 merge conflicts。
</purpose>

<process>

## 1. 加载 ROADMAP.md

读取 `.planning/ROADMAP.md`。如果不存在，报错："No ROADMAP.md found — run `/gsd-new-project` first."

提取所有 phases。对每个 phase 记录：
- Phase 编号和名称
- Scope/Goal 描述
- `Files` 或 `files_modified` 字段中列出的文件（如果有）
- 现有 `Depends on` 字段值

## 2. 推断可能修改的文件

对每个没有显式 `files_modified` 的 phase，根据 scope/goal 描述推断其可能修改的文件。使用以下启发式：

- **Database/schema phases** → migration files、schema definitions、model files
- **API/backend phases** → route files、controller files、service files、handler files
- **Frontend/UI phases** → component files、page files、style files
- **Auth phases** → middleware files、auth route files、session/token files
- **Config/infra phases** → config files、environment files、CI/CD files
- **Test phases** → test files、spec files、fixture files
- **Shared utility phases** → lib/utils files、shared type definitions

按推断出的文件域（database、API、frontend、auth、config、shared）对 phases 分组。

## 3. 检测依赖关系

对每一对 phases（A、B），检查依赖信号：

### 文件重叠检测
如果 phase A 和 B 都会修改同一文件域或相同的具体文件，则二者必须有先后顺序。先执行的是提供基础的一方。

### 语义依赖检测
读取每个 phase 的 scope/goal，关注以下模式：
- Phase B 提到要消费、使用或调用某个由 Phase A 创建/实现的内容
- Phase B 引用了由 Phase A 构建的 "API"、"schema"、"model"、"endpoint" 或 "interface"
- Phase B 写了 "after X is complete"、"once X is built"、"using the X from Phase N"
- Phase B 扩展或修改了由 Phase A 建立的代码

### 数据流检测
- Phase A 创建数据结构、schemas 或 types → Phase B 消费或转换它们
- Phase A seed/migrate 数据库 → Phase B 从该数据库读取
- Phase A 暴露 API contract → Phase B 实现对应 client

## 4. 构建依赖表

输出依赖建议表：

```
Phase Dependency Analysis
=========================

Phase N: <name>
  Scope: <brief scope>
  Likely touches: <inferred file domains>

  Suggested dependencies:
  → Depends on: <Phase M> — reason: <overlap/semantic/data-flow explanation>

  Current "Depends on": <existing value or "(none)">
```

对未检测到依赖的 phase 对，说明："No dependency detected between Phase X and Phase Y."

## 5. 汇总建议变更

展示建议写入 ROADMAP.md 的 `Depends on` 变更汇总 diff：

```
Suggested ROADMAP.md updates:
  Phase 3: add "Depends on: 1, 2"   (file overlap: database schema)
  Phase 5: add "Depends on: 3"      (semantic: uses auth API from Phase 3)
  Phase 4: no change needed         (independent scope)
```

## 6. 确认并应用

询问用户："Apply these `Depends on` suggestions to ROADMAP.md? (yes / no / edit)"

- **yes** — 将所有建议的 `Depends on` 条目写入 ROADMAP.md，并逐项确认。
- **no** — 仅输出文字建议，由用户手动更新。
- **edit** — 逐条展示建议，让用户对每条选择 yes/no/skip。

写入 ROADMAP.md 时：
- 定位到对应 phase 条目并新增或更新 `Depends on:` 字段
- 保持其他 phase 内容不变
- 不重新排序 phases

应用后："ROADMAP.md updated. Run `/gsd-manager` to execute phases in the correct order."

</process>
