# AI Evaluation Reference

> `gsd-eval-planner` 和 `gsd-eval-auditor` 使用的参考资料。
> 基于 “AI Evals for Everyone” 课程（Reganti & Badam）以及行业实践。

---

## Core Concepts

### Why Evals Exist
AI 系统是非确定性的。输入 X 并不会在不同运行、不同用户或边界情形下稳定地产生输出 Y。Evals 是一个持续评估过程，用来判断你的系统行为在真实世界条件下是否符合预期。仅靠单元测试和集成测试并不足够。

### Model vs. Product Evaluation
- **Model evals**（MMLU、HumanEval、GSM8K）用于在标准化条件下衡量通用能力。只能作为初筛。
- **Product evals** 用于衡量你的特定系统中的行为，结合你的数据、用户和领域规则。这才是 80% eval 工作真正应该投入的地方。

### The Three Components of Every Eval
- **Input** — 影响系统的一切：query、history、retrieved docs、system prompt、config
- **Expected** — 好的行为应当是什么样，通过 rubrics 定义
- **Actual** — 系统实际产出的内容，包括中间步骤、tool calls 和 reasoning traces

### Three Measurement Approaches
1. **Code-based metrics** — 确定性检查：JSON 校验、必需免责声明、性能阈值、分类标记。快速、便宜、可靠。优先使用。
2. **LLM judges** — 一个模型依据 rubric 评估另一个模型。对主观质量（语气、推理、升级）很强，但在可信之前必须先与人工判断校准。
3. **Human evaluation** — 对细微判断来说是金标准，但无法扩展。用于校准、边界案例、周期性抽样和高风险决策。

最有效的系统会把三者结合起来。

---

## Evaluation Dimensions

### Pre-Deployment (Development Phase)

| Dimension | What It Measures | When It Matters |
|-----------|-----------------|-----------------|
| **Factual accuracy** | 相对于事实真值的断言正确性 | RAG、知识库、任何事实性陈述 |
| **Context faithfulness** | 回答是否基于提供的上下文，而非捏造 | RAG pipelines、文档问答、检索增强系统 |
| **Hallucination detection** | 看似合理但无依据的断言 | 所有生成式系统、高风险领域 |
| **Escalation accuracy** | 是否正确识别何时需要人工介入 | 客服、医疗、金融顾问 |
| **Policy compliance** | 是否遵守业务规则、法律要求和免责声明 | 受监管行业、企业部署 |
| **Tone/style appropriateness** | 是否符合品牌语气、受众预期和情绪语境 | 面向客户系统、内容生成 |
| **Output structure validity** | schema 合规性、必填字段、格式正确性 | 结构化抽取、API 集成、数据管道 |
| **Task completion** | 系统是否完成了声明的目标 | agentic workflows、多步骤任务 |
| **Tool use correctness** | 工具选择和调用是否正确 | 带 tool calls 的 agent 系统 |
| **Safety** | 是否不存在有害、偏见或不当输出 | 所有面向用户的系统 |

### Production Monitoring

| Dimension | Monitoring Approach |
|-----------|---------------------|
| **Safety violations** | 在线 guardrail — 实时、立即干预 |
| **Compliance failures** | 在线 guardrail — 在用户看到输出前拦截或升级 |
| **Quality degradation trends** | 离线 flywheel — 对抽样交互做批量分析 |
| **Emerging failure modes** | signal-metric divergence — 当用户行为信号与指标分数背离时，手动调查 |
| **Cost/latency drift** | code-based metrics — 自动阈值告警 |

---

## The Guardrail vs. Flywheel Decision

问自己：“如果这种行为出错了，会对我的业务造成灾难性后果吗？”

- **Yes → Guardrail** — 在线、实时运行，并立即干预（拦截、升级、交接）。要有选择性：guardrails 会增加延迟。
- **No → Flywheel** — 离线批处理运行，把分析结果持续反馈给系统优化。

---

## Rubric Design

没有上下文的通用指标毫无意义。在房地产领域里，“helpfulness” 可能意味着清晰总结房源；在医疗领域，它意味着知道何时 *不该* 回答。

一个 rubric 必须定义：
1. 要衡量的维度
2. 在 5 分量表中 1、3、5 分各代表什么（或 pass/fail 标准）
3. 领域内可接受与不可接受行为的具体示例

没有 rubrics，LLM judges 产生的只会是噪声，而不是信号。

---

## Reference Dataset Guidelines

- 从 **10-20 个高质量样本** 开始，而不是 200 个平庸样本
- 覆盖：关键成功场景、常见用户流程、已知边界情况、历史失败模式
- 让领域专家给样本打标（而不只是工程师）
- 根据你在生产中学到的东西扩展，而不是为假想覆盖率去构建

---

## Eval Tooling Guide

| Tool | Type | Best For | Key Strength |
|------|------|----------|-------------|
| **RAGAS** | Python library | RAG 评估 | 针对性指标：faithfulness、answer relevance、context precision/recall |
| **Langfuse** | Platform（open-source，可自托管） | 所有系统类型 | tracing 强、prompt management 完整，适合想自己掌控基础设施的团队 |
| **LangSmith** | Platform（commercial） | LangChain/LangGraph 生态 | 与 LangChain 集成最紧；如果你已经在该生态内，这是最佳选择 |
| **Arize Phoenix** | Platform（open-source + hosted） | RAG + 多 agent tracing | RAG eval 与 trace visualization 很强；开源且可托管 |
| **Braintrust** | Platform（commercial） | 模型无关评估 | dataset 和 experiment 管理；适合跨 framework 对比 |
| **Promptfoo** | CLI tool（open-source） | Prompt 测试、CI/CD | CLI-first，非常适合在 CI/CD 中做 prompt regression testing |

### Tool Selection by System Type

| System Type | Recommended Tooling |
|-------------|---------------------|
| RAG / Knowledge Q&A | RAGAS + Arize Phoenix or Braintrust |
| Multi-agent systems | Langfuse + Arize Phoenix |
| Conversational / single-model | Promptfoo + Braintrust |
| Structured extraction | Promptfoo + code-based validators |
| LangChain/LangGraph projects | LangSmith（原生集成） |
| Production monitoring (all types) | Langfuse、Arize Phoenix 或 LangSmith |

---

## Evals in the Development Lifecycle

### Plan Phase (Evaluation-Aware Design)
写代码前，先定义：
1. 正在构建哪种 AI 系统 → 这决定 framework 与主要 eval 关注点
2. 关键失败模式（3-5 个绝不能出错的行为）
3. Rubrics — 针对每个维度明确可接受/不可接受行为的定义
4. Evaluation strategy — 哪些维度用 code metrics、LLM judges 或人工审查
5. Reference dataset requirements — 大小、构成、标注方式
6. Eval tooling 选择

输出：AI-SPEC.md 的 EVALS-SPEC 段

### Execute Phase (Instrument While Building)
- 从第一天开始加入 tracing（Langfuse、Arize Phoenix 或 LangSmith）
- 与实现同步构建 reference dataset
- 先实现 code-based checks；只在主观维度上再加入 LLM judges
- 通过 Promptfoo 或 Braintrust 在 CI/CD 中运行 evals

### Verify Phase (Pre-Deployment Validation)
- 用所有指标跑完整个 reference dataset
- 对边界案例和 LLM judge 分歧进行人工审查
- 将 LLM judges 与人工评分校准（在可信之前，目标相关性 ≥ 0.7）
- 定义并配置 production guardrails
- 建立监控基线

### Monitor Phase (Production Evaluation Loop)
- Smart sampling — 对带有可疑信号的交互加权（重试、异常长度、显式升级）
- 每次交互都运行在线 guardrails
- 对抽样批次运行离线 flywheel
- 关注 signal-metric divergence — 这是评估缺口的早期预警系统

---

## Common Pitfalls

1. **假设 benchmark 能预测产品成功** — 不能；model evals 是过滤器，不是裁决
2. **孤立地做工程评估** — rubrics 必须由领域专家共同定义；只有工程师会漏掉关键细节
3. **第一天就追求全面覆盖** — 先从小做起（10-20 个样本），再根据真实失败模式扩展
4. **相信未经校准的 LLM judges** — 在依赖它们之前，先对照人工判断验证
5. **什么都测量** — 只跟踪能驱动决策的指标；“全部收集”只会制造噪声
6. **把 evaluation 当成一次性设置** — 用户行为会演化、需求会变化、失败模式会出现；evaluation 是持续过程
