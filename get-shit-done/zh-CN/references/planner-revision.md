# 修订模式 - 规划器参考

当 orchestrator 提供带有 checker 问题的 `<revision_context>` 时触发。不是从头开始，而是对现有计划做定向更新。

**思维方式：** 外科医生，而不是架构师。针对具体问题做最小改动。

### 第 1 步：加载现有计划

```bash
cat .planning/phases/$PHASE-*/$PHASE-*-PLAN.md
```

建立对当前计划结构、现有任务、must_haves 的心智模型。

### 第 2 步：解析 Checker 问题

问题以结构化格式给出：

```yaml
issues:
  - plan: "16-01"
    dimension: "task_completeness"
    severity: "blocker"
    description: "Task 2 missing <verify> element"
    fix_hint: "Add verification command for build output"
```

按 plan、dimension、severity 分组。

### 第 3 步：修订策略

| Dimension | Strategy |
|-----------|----------|
| requirement_coverage | Add task(s) for missing requirement |
| task_completeness | Add missing elements to existing task |
| dependency_correctness | Fix depends_on, recompute waves |
| key_links_planned | Add wiring task or update action |
| scope_sanity | Split into multiple plans |
| must_haves_derivation | Derive and add must_haves to frontmatter |

### 第 4 步：做定向更新

**要做：** 编辑被标记的具体部分，保留可工作的部分；如果依赖关系变化，则更新 waves。

**不要做：** 因小问题重写整个计划，添加不必要的任务，或破坏现有可工作的计划。

### 第 5 步：验证变更

- [ ] 所有被标记的问题都已处理
- [ ] 没有引入新问题
- [ ] Wave 编号仍然有效
- [ ] 依赖关系仍然正确
- [ ] 磁盘上的文件已更新

### 第 6 步：提交

```bash
gsd-sdk query commit "fix($PHASE): revise plans based on checker feedback" .planning/phases/$PHASE-*/$PHASE-*-PLAN.md
```

### 第 7 步：返回修订摘要

```markdown
## 修订完成

**已处理问题：** {N}/{M}

### 已做变更

| Plan | 变更 | 已处理问题 |
|------|------|------------|
| 16-01 | Added <verify> to Task 2 | task_completeness |
| 16-02 | Added logout task | requirement_coverage (AUTH-02) |

### 已更新文件

- .planning/phases/16-xxx/16-01-PLAN.md
- .planning/phases/16-xxx/16-02-PLAN.md

{若有未处理的问题：}

### 未处理问题

| Issue | 原因 |
|-------|------|
| {issue} | {why - needs user input, architectural change, etc.} |
```
