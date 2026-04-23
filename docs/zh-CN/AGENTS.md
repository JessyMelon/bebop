# GSD 代理参考

> 21 个主代理的完整角色卡，以及 10 个高级/专用代理的简要说明（共 31 个已发布代理）。`agents/` 目录和 [`docs/INVENTORY.md`](INVENTORY.md) 是权威清单；上下文请参阅 [Architecture](ARCHITECTURE.md)。

---

## 概览

GSD 使用多代理架构：轻量级编排器（工作流文件）会启动带有全新上下文窗口的专门代理。每个代理都有聚焦的职责、有限的工具权限，并产出特定工件。

### 代理分类

> 下表覆盖本节中详细说明的 **21 个主代理**。另外 10 个已发布代理（pattern-mapper、debug-session-manager、code-reviewer、code-fixer、ai-researcher、domain-researcher、eval-planner、eval-auditor、framework-selector、intel-updater）在下面的 [高级和专用代理](#高级和专用代理) 中提供简要说明。关于权威的 31 代理清单，请参阅 [`docs/INVENTORY.md`](INVENTORY.md) 和 `agents/` 目录。

| 分类 | 数量 | 代理 |
|----------|-------|--------|
| 研究员 | 3 | project-researcher、phase-researcher、ui-researcher |
| 分析员 | 2 | assumptions-analyzer、advisor-researcher |
| 综合器 | 1 | research-synthesizer |
| 规划者 | 1 | planner |
| 路线图制定者 | 1 | roadmapper |
| 执行者 | 1 | executor |
| 检查器 | 3 | plan-checker、integration-checker、ui-checker |
| 验证者 | 1 | verifier |
| 审计员 | 3 | nyquist-auditor、ui-auditor、security-auditor |
| 映射器 | 1 | codebase-mapper |
| 调试器 | 1 | debugger |
| 文档编写者 | 2 | doc-writer、doc-verifier |
| 用户画像 | 1 | user-profiler |

---

## 代理详情

### gsd-project-researcher

**角色：** 在创建路线图之前研究领域生态。

| 属性 | 值 |
|----------|-------|
| **由谁启动** | `/gsd-new-project`、`/gsd-new-milestone` |
| **并行度** | 4 个实例（stack、features、architecture、pitfalls） |
| **工具** | Read、Write、Bash、Grep、Glob、WebSearch、WebFetch、mcp（context7） |
| **模型（平衡）** | Sonnet |
| **产出** | `.planning/research/STACK.md`、`FEATURES.md`、`ARCHITECTURE.md`、`PITFALLS.md` |

**能力：**
- 搜索当前生态信息
- 使用 Context7 MCP 获取库文档
- 直接把研究文档写入磁盘（减少编排器上下文负载）

---

### gsd-phase-researcher

**角色：** 在规划前研究特定阶段的实现方式。

| 属性 | 值 |
|----------|-------|
| **由谁启动** | `/gsd-plan-phase` |
| **并行度** | 4 个实例（与项目研究员相同的关注点） |
| **工具** | Read、Write、Bash、Grep、Glob、WebSearch、WebFetch、mcp（context7） |
| **模型（平衡）** | Sonnet |
| **产出** | `{phase}-RESEARCH.md` |

**能力：**
- 读取 CONTEXT.md，聚焦用户的决策
- 调查特定阶段领域的实现模式
- 检测用于 Nyquist 验证映射的测试基础设施

---

### gsd-ui-researcher

**角色：** 为前端阶段生成 UI 设计契约。

| 属性 | 值 |
|----------|-------|
| **由谁启动** | `/gsd-ui-phase` |
| **并行度** | 单实例 |
| **工具** | Read、Write、Bash、Grep、Glob、WebSearch、WebFetch、mcp（context7） |
| **模型（平衡）** | Sonnet |
| **颜色** | `#E879F9`（fuchsia） |
| **产出** | `{phase}-UI-SPEC.md` |

**能力：**
- 检测设计系统状态（shadcn components.json、Tailwind 配置、已有 tokens）
- 为 React/Next.js/Vite 项目提供 shadcn 初始化建议
- 只问尚未回答的设计契约问题
- 对第三方组件执行注册表安全门禁

---

### gsd-assumptions-analyzer

**角色：** 深度分析阶段代码库，返回带证据、置信度和错误后果的结构化假设。

| 属性 | 值 |
|----------|-------|
| **由谁启动** | `discuss-phase-assumptions` 工作流（当 `workflow.discuss_mode = 'assumptions'` 时） |
| **并行度** | 单实例 |
| **工具** | Read、Bash、Grep、Glob |
| **模型（平衡）** | Sonnet |
| **颜色** | Cyan |
| **产出** | 带决策语句、证据文件路径和置信度的结构化假设 |

**关键行为：**
- 读取 ROADMAP.md 中的阶段描述和之前的 CONTEXT.md
- 搜索与该阶段相关的文件（组件、模式、相似功能）
- 读取 5-15 个最相关的源码文件形成基于证据的假设
- 置信度分类：Confident（代码中明确）、Likely（合理推断）、Unclear（可能有多种方向）
- 标记需要外部研究的话题（库兼容性、生态最佳实践）
- 输出按层级校准：full_maturity（3-5 个领域）、standard（3-4 个）、minimal_decisive（2-3 个）

---

### gsd-advisor-researcher

**角色：** 在 discuss-phase 的 advisor 模式下研究单个灰色决策，并返回结构化对比表。

| 属性 | 值 |
|----------|-------|
| **由谁启动** | `discuss-phase` 工作流（当 ADVISOR_MODE = true） |
| **并行度** | 多实例（每个灰色区域一个） |
| **工具** | Read、Bash、Grep、Glob、WebSearch、WebFetch、mcp（context7） |
| **模型（平衡）** | Sonnet |
| **颜色** | Cyan |
| **产出** | 5 列对比表（Option / Pros / Cons / Complexity / Recommendation）以及说明段落 |

**关键行为：**
- 使用 Claude 知识、Context7 和网络搜索研究单个分配的灰色区域
- 产出真正可行的选项，不堆砌无意义备选项
- Complexity 列以影响面 + 风险来衡量（从不写时间估算）
- 推荐是条件式的（“如果 X 则推荐”），不是单一胜出排序
- 输出按层级校准：full_maturity（3-5 个选项带成熟度信号）、standard（2-4 个）、minimal_decisive（2 个选项，给出明确建议）
