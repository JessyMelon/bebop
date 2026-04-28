# GSD Artifact Types

本文档记录 GSD 规划分类体系中的所有 artifact 类型。每种类型都有明确的
形态、生命周期、位置与消费机制。一个格式良好的 artifact 如果没有任何工作流
会读取它，那它就是惰性的；真正赋予 artifact 意义的是消费机制。

---

## Core Artifacts

### ROADMAP.md
- **Shape**: 带目标与规范 refs 的里程碑 + 阶段列表
- **Lifecycle**: 创建 → 每个里程碑更新 → 归档
- **Location**: `.planning/ROADMAP.md`
- **Consumed by**: `plan-phase`, `discuss-phase`, `execute-phase`, `progress`, `state` commands

### STATE.md
- **Shape**: 当前位置跟踪器（phase、plan、progress、decisions）
- **Lifecycle**: 整个项目期间持续更新
- **Location**: `.planning/STATE.md`
- **Consumed by**: 所有编排工作流；`resume-project`, `progress`, `next` commands

### REQUIREMENTS.md
- **Shape**: 带可追踪性表格的编号验收标准
- **Lifecycle**: 项目开始时创建 → 随需求满足情况更新
- **Location**: `.planning/REQUIREMENTS.md`
- **Consumed by**: `discuss-phase`, `plan-phase`, CONTEXT.md generation；executor 负责标记完成

### CONTEXT.md (per-phase)
- **Shape**: 6 段式格式：domain、decisions、canonical_refs、code_context、specifics、deferred
- **Lifecycle**: 规划前创建 → 规划和执行期间使用 → 被下一阶段取代
- **Location**: `.planning/phases/XX-name/XX-CONTEXT.md`
- **Consumed by**: `plan-phase`（读取 decisions）、`execute-phase`（读取 code_context 和 canonical_refs）

### PLAN.md (per-plan)
- **Shape**: Frontmatter + objective + 带类型的 tasks + success criteria + output spec
- **Lifecycle**: 由 planner 创建 → 被执行 → 产出 SUMMARY.md
- **Location**: `.planning/phases/XX-name/XX-YY-PLAN.md`
- **Consumed by**: `execute-phase` executor；task commits 会引用 plan IDs

### SUMMARY.md (per-plan)
- **Shape**: 带 dependency graph 的 frontmatter + narrative + deviations + self-check
- **Lifecycle**: 计划完成时创建 → 同一阶段后续计划会读取
- **Location**: `.planning/phases/XX-name/XX-YY-SUMMARY.md`
- **Consumed by**: Orchestrator（progress）、planner（未来计划的上下文）、`milestone-summary`

### HANDOFF.json / .continue-here.md
- **Shape**: 结构化暂停状态（JSON 机器可读 + Markdown 人类可读）
- **Lifecycle**: 暂停时创建 → 恢复时消费 → 被下一次暂停替换
- **Location**: `.planning/HANDOFF.json` + `.planning/phases/XX-name/.continue-here.md`（或 spike/deliberation path）
- **Consumed by**: `resume-project` workflow

---

## Extended Artifacts

### DISCUSSION-LOG.md (per-phase)
- **Shape**: discuss-phase 中假设与修正的审计轨迹
- **Lifecycle**: 讨论时创建 → 只读审计记录
- **Location**: `.planning/phases/XX-name/XX-DISCUSSION-LOG.md`
- **Consumed by**: 人工审查；自动化工作流不会读取

### USER-PROFILE.md
- **Shape**: 校准层级与偏好配置
- **Lifecycle**: 由 `profile-user` 创建 → 随偏好观察结果更新
- **Location**: `~/.claude/get-shit-done/USER-PROFILE.md`
- **Consumed by**: `discuss-phase-assumptions`（calibration tier）、`plan-phase`

### SPIKE.md / DESIGN.md (per-spike)
- **Shape**: 研究问题 + 方法 + 发现 + 建议
- **Lifecycle**: 创建 → 调查 → 决策 → 归档
- **Location**: `.planning/spikes/SPIKE-NNN/`
- **Consumed by**: 被引用时供 planner 使用；`pause-work` 用于 spike 上下文交接

### Spike README.md / MANIFEST.md (per-spike, via /gsd-spike)
- **Shape**: YAML frontmatter（spike, name, validates, verdict, related, tags）+ 运行说明 + 结果
- **Lifecycle**: 由 `/gsd-spike` 创建 → 验证 → 由 `/gsd-spike-wrap-up` 收尾
- **Location**: `.planning/spikes/NNN-name/README.md`, `.planning/spikes/MANIFEST.md`
- **Consumed by**: `/gsd-spike-wrap-up` 做整理；`pause-work` 用于 spike 上下文交接

### Sketch README.md / MANIFEST.md / index.html (per-sketch)
- **Shape**: YAML frontmatter（sketch, name, question, winner, tags）+ 以 tabbed HTML 展示的 variants
- **Lifecycle**: 由 `/gsd-sketch` 创建 → 评估 → 由 `/gsd-sketch-wrap-up` 收尾
- **Location**: `.planning/sketches/NNN-name/README.md`, `.planning/sketches/NNN-name/index.html`, `.planning/sketches/MANIFEST.md`
- **Consumed by**: `/gsd-sketch-wrap-up` 做整理；`pause-work` 用于 sketch 上下文交接

### WRAP-UP-SUMMARY.md (per wrap-up session)
- **Shape**: 整理结果、纳入/排除项、功能/设计区域分组
- **Lifecycle**: 由 `/gsd-spike-wrap-up` 或 `/gsd-sketch-wrap-up` 创建
- **Location**: `.planning/spikes/WRAP-UP-SUMMARY.md` 或 `.planning/sketches/WRAP-UP-SUMMARY.md`
- **Consumed by**: 项目历史；自动化工作流不会读取

---

## Standing Reference Artifacts

### METHODOLOGY.md

- **Shape**: 常驻参考资料 —— 可跨阶段复用的解释框架（lenses）
- **Lifecycle**: 创建 → 生效 → 被替代（当某个 lens 被更好的替换时）
- **Location**: `.planning/METHODOLOGY.md`（项目级，而非阶段级）
- **Contents**: 具名 lenses，每个都记录：
  - 它诊断什么（能检测的问题类型）
  - 它建议什么（推荐的响应类型）
  - 何时应用（触发条件）
  - 示例：Bayesian updating、STRIDE threat modeling、Cost-of-delay prioritization
- **Consumed by**:
  - `discuss-phase-assumptions` —— 读取 METHODOLOGY.md（若存在），并在向用户呈现发现前，
    将活动 lenses 应用到当前假设分析中
  - `plan-phase` —— 读取 METHODOLOGY.md，为每个计划的方法选择提供参考
  - `pause-work` —— 将 METHODOLOGY.md 纳入 `.continue-here.md` 的 Required Reading 段，
    使恢复中的 agents 继承项目的分析取向

**Why consumption matters:** 没有任何工作流会读取的 METHODOLOGY.md 是惰性的。只有当 agent 在分析前将这些 lenses 加载进自己的推理上下文中时，它们才会真正生效。这就是为什么 discuss-phase-assumptions 和 pause-work 工作流都会显式引用该文件。

**Example lens entry:**

```markdown
## Bayesian Updating

**Diagnoses:** Decisions made with stale priors — assumptions formed early that evidence has since
contradicted, but which remain embedded in the plan.

**Recommends:** Before confirming an assumption, ask: "What evidence would make me change this?"
If no evidence could change it, it's a belief, not an assumption. Flag for user review.

**Apply when:** Any assumption carries Confident label but was formed before recent architectural
changes, library upgrades, or scope corrections.
```
