# AI Framework Decision Matrix

> `gsd-framework-selector` 和 `gsd-ai-researcher` 使用的参考资料。
> 提炼自官方文档、benchmark 和开发者报告（2026）。

---

## Quick Picks

| Situation | Pick |
|-----------|------|
| 通往可工作 agent 的最简单路径（OpenAI） | OpenAI Agents SDK |
| 通往可工作 agent 的最简单路径（模型无关） | CrewAI |
| 生产级 RAG / 文档问答 | LlamaIndex |
| 带分支的复杂有状态工作流 | LangGraph |
| 角色明确的多 agent 团队 | CrewAI |
| 代码感知的自主 agent（Anthropic） | Claude Agent SDK |
| “我还不知道自己的需求” | LangChain |
| 受监管 / 需要审计轨迹 | LangGraph |
| 企业级 Microsoft/.NET 团队 | AutoGen/AG2 |
| Google Cloud / Gemini 深度绑定团队 | Google ADK |
| 需要显式控制的纯 NLP pipeline | Haystack |

---

## Framework Profiles

### CrewAI
- **Type:** 多 agent 编排
- **Language:** 仅 Python
- **Model support:** 模型无关
- **Learning curve:** 初学者（role/task/crew 映射到真实团队）
- **Best for:** 内容 pipeline、研究自动化、业务流程工作流、快速原型
- **Avoid if:** 需要细粒度状态管理、TypeScript、容错 checkpointing、复杂条件分支
- **Strengths:** 最快的多 agent 原型速度、在 QA 任务上比 LangGraph 快 5.76x、内建 memory（short/long/entity/contextual）、Flows 架构、独立运行（无 LangChain 依赖）
- **Weaknesses:** checkpointing 有限、错误处理粗粒度、仅 Python
- **Eval concerns:** 任务拆解准确性、agent 间交接、目标完成率、循环检测

### LlamaIndex
- **Type:** RAG 与数据摄取
- **Language:** Python + TypeScript
- **Model support:** 模型无关
- **Learning curve:** 中级
- **Best for:** 法务研究、内部知识助手、企业文档搜索，以及任何“检索质量是第一优先级”的系统
- **Avoid if:** 主要需求是 agent 编排、多 agent 协作或 chatbot 对话流
- **Strengths:** 一流的文档解析（LlamaParse）、检索准确率提升 35%、查询快 20-30%、混合检索策略（vector + graph + reranker）
- **Weaknesses:** 首先是数据框架，agent 编排是次要能力
- **Eval concerns:** context faithfulness、hallucination、answer relevance、retrieval precision/recall

### LangChain
- **Type:** 通用 LLM framework
- **Language:** Python + TypeScript
- **Model support:** 模型无关（生态最广）
- **Learning curve:** 中高级
- **Best for:** 需求不断演化、需要大量第三方集成、想用一个 framework 覆盖一切的团队、RAG + agents + chains
- **Avoid if:** 用例简单明确、以 RAG 为主（用 LlamaIndex）、复杂有状态工作流（用 LangGraph）、对大规模性能极度敏感
- **Strengths:** 最大的社区与集成生态、比从零开发快 25%、覆盖 RAG/agents/chains/memory
- **Weaknesses:** 抽象层开销、p99 延迟在高负载下恶化、复杂性蔓延风险
- **Eval concerns:** 端到端任务完成、chain 正确性、检索质量

### LangGraph
- **Type:** 有状态 agent 工作流（graph-based）
- **Language:** Python + TypeScript（完全对等）
- **Model support:** 模型无关（继承 LangChain 集成）
- **Learning curve:** 中高级（需要 graph 心智模型）
- **Best for:** 生产级有状态工作流、受监管行业、审计轨迹、人机协同流程、具容错能力的多步骤 agents
- **Avoid if:** 简单 chatbot、纯线性工作流、快速原型
- **Strengths:** 最强 checkpointing（每个 node）、time-travel debugging、原生 Postgres/Redis persistence、streaming 支持、2026 年有状态 agent 开发中 62% 开发者选择它
- **Weaknesses:** 前期脚手架更多、上手更陡、对简单场景来说杀鸡用牛刀
- **Eval concerns:** 状态迁移正确性、目标完成率、工具使用准确性、安全 guardrails

### OpenAI Agents SDK
- **Type:** 原生 OpenAI agent framework
- **Language:** Python + TypeScript
- **Model support:** 针对 OpenAI 优化（通过 Chat Completions 兼容 100+ 模型）
- **Learning curve:** 初学者（4 个原语：Agents、Handoffs、Guardrails、Tracing）
- **Best for:** 深度绑定 OpenAI 的团队、快速 agent 原型、语音 agents（gpt-realtime）、想要可视化构建器（AgentKit）的团队
- **Avoid if:** 需要模型灵活性、复杂多 agent 协作、持久状态管理、担心供应商锁定
- **Strengths:** 心智模型最简单、内建 tracing 和 guardrails、通过 Handoffs 做 agent 委派、Realtime Agents 支持语音
- **Weaknesses:** OpenAI 供应商锁定、无内建持久状态、生态较新
- **Eval concerns:** 指令遵循、安全 guardrails、升级准确性、语气一致性

### Claude Agent SDK (Anthropic)
- **Type:** 代码感知的自主 agent framework
- **Language:** Python + TypeScript
- **Model support:** 仅 Claude models
- **Learning curve:** 中级（18 个 hook events、MCP、tool decorators）
- **Best for:** 开发者工具、代码生成/审查 agent、自主编码助手、重度 MCP 架构、安全关键应用
- **Avoid if:** 需要模型灵活性、要求稳定成熟 API、用例与代码/工具使用无关
- **Strengths:** 最深的 MCP 集成、内建 filesystem/shell 访问、18 个生命周期 hooks、自动 context compaction、extended thinking、安全优先设计
- **Weaknesses:** Claude-only 供应商锁定、API 较新且在演化、社区较小
- **Eval concerns:** 工具使用正确性、安全性、代码质量、指令遵循

### AutoGen / AG2 / Microsoft Agent Framework
- **Type:** 多 agent 对话 framework
- **Language:** Python（AG2）、Python + .NET（Microsoft Agent Framework）
- **Model support:** 模型无关
- **Learning curve:** 中高级
- **Best for:** 研究型应用、对话式问题求解、代码生成 + 执行循环、Microsoft/.NET 团队
- **Avoid if:** 你想要稳定的生态、确定性工作流，或“最安全的长期选择”（碎片化风险）
- **Strengths:** 最成熟的对话式 agent 模式、代码生成 + 执行循环、async event-driven（v0.4+）、跨语言互操作（Microsoft Agent Framework）
- **Weaknesses:** 生态碎片化（AutoGen 维护模式、AG2 分叉、Microsoft Agent Framework 预览版）—— 这是实打实的长期风险
- **Eval concerns:** 对话目标完成、共识质量、代码执行正确性

### Google ADK (Agent Development Kit)
- **Type:** 多 agent 编排 framework
- **Language:** Python + Java
- **Model support:** 针对 Gemini 优化；通过 LiteLLM 支持其他模型
- **Learning curve:** 中级（agent/tool/session 模型；如果熟悉 LangGraph 会更容易）
- **Best for:** Google Cloud / Vertex AI 团队、需要内建 session 管理与 memory 的多 agent 工作流、已深度绑定 Gemini 的团队、需要 Google Search / BigQuery 工具集成的 agent pipeline
- **Avoid if:** 需要 Gemini 之外的模型灵活性、不能接受 Google Cloud 依赖、纯 TypeScript 技术栈
- **Strengths:** Google 官方支持、内建 session/memory/artifact 管理、与 Vertex AI 和 Google Search 深度集成、自带 eval framework（兼容 RAGAS）、天生面向多 agent（sequential、parallel、loop 模式）、适合企业团队的 Java SDK
- **Weaknesses:** 实际上仍是 Gemini 供应商锁定、社区比 LangChain/LlamaIndex 更年轻、第三方集成深度较弱
- **Eval concerns:** 多 agent 任务拆解、工具使用正确性、session 状态一致性、目标完成率

### Haystack
- **Type:** NLP pipeline framework
- **Language:** Python
- **Model support:** 模型无关
- **Learning curve:** 中级
- **Best for:** 显式、可审计的 NLP pipeline，需细粒度控制的文档处理，企业搜索，以及需要透明性的受监管行业
- **Avoid if:** 快速原型、多 agent 工作流，或希望有大社区支持
- **Strengths:** 显式 pipeline 控制、结构化数据 pipeline 表现强、文档质量好
- **Weaknesses:** 社区更小、agent 导向不如替代方案
- **Eval concerns:** 抽取准确率、pipeline 输出有效性、检索质量

---

## Decision Dimensions

### By System Type

| System Type | Primary Framework(s) | Key Eval Concerns |
|-------------|---------------------|-------------------|
| RAG / Knowledge Q&A | LlamaIndex, LangChain | Context faithfulness、hallucination、retrieval precision/recall |
| Multi-agent orchestration | CrewAI, LangGraph, Google ADK | 任务拆解、交接质量、目标完成 |
| Conversational assistants | OpenAI Agents SDK, Claude Agent SDK | 语气、安全、指令遵循、升级 |
| Structured data extraction | LangChain, LlamaIndex | schema 合规性、抽取准确率 |
| Autonomous task agents | LangGraph, OpenAI Agents SDK | 安全 guardrails、工具正确性、成本约束 |
| Content generation | Claude Agent SDK, OpenAI Agents SDK | 品牌语气、事实准确性、语气 |
| Code automation | Claude Agent SDK | 代码正确性、安全性、测试通过率 |

### By Team Size and Stage

| Context | Recommendation |
|---------|----------------|
| Solo dev, prototyping | OpenAI Agents SDK 或 CrewAI（最快跑起来） |
| Solo dev, RAG | LlamaIndex（开箱即用） |
| Team, production, stateful | LangGraph（最佳容错） |
| Team, evolving requirements | LangChain（逃生口最多） |
| Team, multi-agent | CrewAI（角色抽象最简单） |
| Enterprise, .NET | AutoGen AG2 / Microsoft Agent Framework |

### By Model Commitment

| Preference | Framework |
|-----------|-----------|
| OpenAI-only | OpenAI Agents SDK |
| Anthropic/Claude-only | Claude Agent SDK |
| Google/Gemini-committed | Google ADK |
| 模型无关（完全灵活） | LangChain, LlamaIndex, CrewAI, LangGraph, Haystack |

---

## Anti-Patterns

1. **用 LangChain 做简单 chatbot** — 直接 SDK 调用代码更少、更快，也更易调试
2. **用 CrewAI 做复杂有状态工作流** — checkpointing 缺口会在生产中反噬你
3. **在非 OpenAI 模型上用 OpenAI Agents SDK** — 你会失去最初选择它时想要的集成优势
4. **把 LlamaIndex 当多 agent framework 用** — 它能做 agents，但那不是它的强项
5. **不评估替代方案就默认 LangChain** — “大家都在用” 不等于适合你的用例
6. **在 AutoGen（不是 AG2）上启动新项目** — AutoGen 处于维护模式；请用 AG2 或等待 Microsoft Agent Framework GA
7. **为简单线性流程选择 LangGraph** — graph 的额外开销不值得；改用 LangChain chains
8. **忽视供应商锁定** — provider-native SDKs（OpenAI、Claude）用灵活性换集成深度；请有意识地做决定

---

## Combination Plays (Multi-Framework Stacks)

| Production Pattern | Stack |
|-------------------|-------|
| 带 observability 的 RAG | LlamaIndex + LangSmith or Langfuse |
| 带 RAG 的有状态 agent | LangGraph + LlamaIndex |
| 带 tracing 的多 agent | CrewAI + Langfuse |
| 带 evals 的 OpenAI agents | OpenAI Agents SDK + Promptfoo or Braintrust |
| 带 MCP 的 Claude agents | Claude Agent SDK + LangSmith or Arize Phoenix |
