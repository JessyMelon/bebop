# 里程碑归档模板

此模板由 `complete-milestone` 工作流使用，用于在 `.planning/milestones/` 中创建归档文件。

---

## 文件模板

# 里程碑 v{{VERSION}}：{{MILESTONE_NAME}}

**状态：** ✅ SHIPPED {{DATE}}
**阶段：** {{PHASE_START}}-{{PHASE_END}}
**计划总数：** {{TOTAL_PLANS}}

## 概览

{{MILESTONE_DESCRIPTION}}

## 阶段

{{PHASES_SECTION}}

[对该里程碑中的每个阶段，包含以下内容：]

### 阶段 {{PHASE_NUM}}：{{PHASE_NAME}}

**目标**：{{PHASE_GOAL}}
**依赖于**：{{DEPENDS_ON}}
**计划**：{{PLAN_COUNT}} 个计划

计划：

- [x] {{PHASE}}-01: {{PLAN_DESCRIPTION}}
- [x] {{PHASE}}-02: {{PLAN_DESCRIPTION}}
      [... 所有计划 ...]

**详情：**
{{PHASE_DETAILS_FROM_ROADMAP}}

**对于小数阶段，包含 (INSERTED) 标记：**

### 阶段 2.1：关键安全补丁 (INSERTED)

**目标**：修复认证绕过漏洞
**依赖于**：阶段 2
**计划**：1 个计划

计划：

- [x] 02.1-01: 修补认证漏洞

**详情：**
{{PHASE_DETAILS_FROM_ROADMAP}}

---

## 里程碑总结

**小数阶段：**

- 阶段 2.1：关键安全补丁（在阶段 2 后插入以修复紧急问题）
- 阶段 5.1：性能热修复（在阶段 5 后插入以处理生产问题）

**关键决策：**
{{DECISIONS_FROM_PROJECT_STATE}}
[示例：]

- 决策：使用 ROADMAP.md 拆分（理由：上下文成本恒定）
- 决策：使用小数阶段编号（理由：插入语义清晰）

**已解决问题：**
{{ISSUES_RESOLVED_DURING_MILESTONE}}
[示例：]

- 修复了 100+ 阶段时的上下文溢出
- 解决了阶段插入的混乱

**延期问题：**
{{ISSUES_DEFERRED_TO_LATER}}
[示例：]

- PROJECT-STATE.md 分层（延期到决策数 > 300 时）

**产生的技术债：**
{{SHORTCUTS_NEEDING_FUTURE_WORK}}
[示例：]

- 某些工作流仍有硬编码路径（在阶段 5 修复）

---

_当前项目状态见 .planning/ROADMAP.md_

---

## 使用指南

<guidelines>
**何时创建里程碑归档：**
- 完成一个里程碑中的所有阶段后（v1.0、v1.1、v2.0 等）
- 由 `complete-milestone` 工作流触发
- 在规划下一个里程碑工作之前

**如何填写模板：**

- 用实际值替换 {{PLACEHOLDERS}}
- 从 ROADMAP.md 提取阶段详情
- 用 (INSERTED) 标记记录小数阶段
- 包含来自 PROJECT-STATE.md 或 SUMMARY 文件的关键决策
- 列出已解决与延期的问题
- 记录技术债，便于后续参考

**归档位置：**

- 保存到 `.planning/milestones/v{VERSION}-{NAME}.md`
- 示例：`.planning/milestones/v1.0-mvp.md`

**归档后：**

- 更新 ROADMAP.md，在 `<details>` 标签中折叠已完成里程碑
- 将 PROJECT.md 更新为带 Current State 部分的 brownfield 格式
- 在下一个里程碑中继续阶段编号（不要重新从 01 开始）
  </guidelines>
