# AI-SPEC — 阶段 {N}: {phase_name}

> 由 `/gsd-ai-integration-phase` 生成的 AI 设计契约。供 `gsd-planner` 和 `gsd-eval-auditor` 使用。
> 在规划开始前锁定框架选择、实现指导和评估策略。

---

## 1. 系统分类

**System Type:** <!-- RAG | Multi-Agent | Conversational | Extraction | Autonomous Agent | Content Generation | Code Automation | Hybrid -->

**Description:**
<!-- 用一段话说明这个 AI 系统做什么、谁在使用它，以及什么才算“做好” -->

**Critical Failure Modes:**
<!-- 这个系统中绝对不能出错的 3-5 种行为 -->
1.
2.
3.

---

## 1b. 领域上下文

> 由 `gsd-domain-researcher` 调研。用领域专家知识为评估策略提供依据。

**Industry Vertical:** <!-- healthcare | legal | finance | customer service | education | developer tooling | e-commerce | etc. -->

**User Population:** <!-- 谁在什么场景下使用这个系统 -->

**Stakes Level:** <!-- Low | Medium | High | Critical -->

**Output Consequence:** <!-- 当 AI 输出被执行后，下游会发生什么 -->

### 领域专家的评估依据

<!-- 领域专属的评分维度，用从业者语言表达，而不是 AI 术语 -->
<!-- 格式：维度 / 好（专家接受）/ 坏（专家标记）/ 风险级别 / 来源 -->

### 该领域已知的失败模式

<!-- 来自调研的领域专属失败模式，不是泛泛的幻觉，而是它在这里的具体表现 -->

### 监管 / 合规背景

<!-- 相关法规或约束；如果确实没有，则写 “None identified” -->

### 参与评估的领域专家角色

| Role | Responsibility |
|------|---------------|
| <!-- e.g., Senior practitioner --> | <!-- Dataset labeling / rubric calibration / production sampling --> |

---

## 2. 框架决策

**Selected Framework:** <!-- e.g., LlamaIndex v0.10.x -->

**Version:** <!-- 固定版本 -->

**Rationale:**
<!-- 为什么这个框架适合该系统类型、团队背景和生产要求 -->

**已考虑的替代方案：**

| Framework | Ruled Out Because |
|-----------|------------------|
| | |

**Vendor Lock-In Accepted:** <!-- Yes / No / Partial — 有意识地记录这项权衡 -->

---

## 3. 框架速查

> 由 `gsd-ai-researcher` 从官方文档获取。已针对当前用例提炼。

### Installation
```bash
# 安装命令
```

### Core Imports
```python
# 该用例需要的关键导入
```

### Entry Point Pattern
```python
# 该系统类型的最小可运行示例
```

### Key Abstractions
<!-- 开始编码前，开发者必须理解的框架专属概念 -->
| Concept | What It Is | When You Use It |
|---------|-----------|-----------------|
| | | |

### Common Pitfalls
<!-- 这个框架和该系统类型特有的常见坑，来自文档、issues 和社区报告 -->
1.
2.
3.

### Recommended Project Structure
```
project/
├── # 框架专属的目录布局
```

---

## 4. 实现指导

**Model Configuration:**
<!-- 使用哪些模型、temperature、max tokens 和其他关键参数 -->

**Core Pattern:**
<!-- 该框架下，这种系统类型的主要实现模式 -->

**Tool Use:**
<!-- 所需工具/集成以及如何配置 -->

**State Management:**
<!-- 状态如何持久化、读取和更新 -->

**上下文窗口策略：**
<!-- 该系统类型如何管理上下文限制 -->

---

## 4b. AI 系统最佳实践

> 由 `gsd-ai-researcher` 编写。构建 AI 系统的每位开发者都需要的通用模式，与框架选择无关。

### Structured Outputs with Pydantic

<!-- 该用例下与框架配套的 Pydantic 集成模式 -->
<!-- 包含：输出模型定义、框架如何使用它、校验失败时的重试逻辑 -->

```python
# 该系统类型的 Pydantic 输出模型
```

### Async-First Design

<!-- 这个框架如何处理 async、一个常见错误，以及何时 stream 与 await -->

### Prompt Engineering Discipline

<!-- system 与 user prompt 的分离、few-shot 指导、token 预算策略 -->

### 上下文窗口管理

<!-- 该系统类型的专属策略：RAG chunking / conversation summarisation / agent compaction -->

### Cost and Latency Budget

<!-- 单次调用成本估算、缓存策略、子任务模型路由 -->

---

## 5. 评估策略

### Dimensions

| Dimension | Rubric (Pass/Fail or 1-5) | Measurement Approach | Priority |
|-----------|--------------------------|---------------------|----------|
| | | Code / LLM Judge / Human | Critical / High / Medium |

### Eval Tooling

**Primary Tool:** <!-- e.g., RAGAS + Langfuse -->

**Setup:**
```bash
# 安装与配置
```

**CI/CD Integration:**
```bash
# 在 CI/CD 流水线中运行评估的命令
```

### Reference Dataset

**Size:** <!-- e.g., 20 examples to start -->

**Composition:**
<!-- 数据集覆盖哪些场景类型：关键路径、边界情况、失败模式 -->

**Labeling:**
<!-- 由谁以及如何标注示例（领域专家、经校准的 LLM judge 等） -->

---

## 6. 护栏

### Online (Real-Time)

| Guardrail | Trigger | Intervention |
|-----------|---------|--------------|
| | | Block / Escalate / Flag |

### Offline (Flywheel)

| Metric | Sampling Strategy | Action on Degradation |
|--------|------------------|----------------------|
| | | |

---

## 7. 生产监控

**Tracing Tool:** <!-- e.g., Langfuse self-hosted -->

**Key Metrics to Track:**
<!-- 生产中要监控的 3-5 个指标 -->

**Alert Thresholds:**
<!-- 何时触发告警/通知 -->

**Smart Sampling Strategy:**
<!-- 如何选择交互供人工复查，基于信号的过滤策略 -->

---

## 检查清单

- [ ] 已完成系统类型分类
- [ ] 已识别关键失败模式（≥ 3）
- [ ] 已完成领域上下文调研（第 1b 节：行业、风险级别、专家标准、失败模式）
- [ ] 已识别监管/合规背景，或明确注明无相关要求
- [ ] 已定义参与评估的领域专家角色
- [ ] 已选择框架并记录理由
- [ ] 已考虑并排除替代方案
- [ ] 已编写框架速查（安装、导入、模式、常见坑）
- [ ] 已编写 AI 系统最佳实践（第 4b 节：Pydantic、async、prompt 规范、上下文）
- [ ] 评估维度已基于领域评分要素制定
- [ ] 每个评估维度都有明确评分标准（用领域语言描述 Good/Bad）
- [ ] 已选择评估工具，并确认 Arize Phoenix 默认值或注明覆盖原因
- [ ] 已编写参考数据集规范（大小 ≥ 10，已定义组成和标注方式）
- [ ] 已指定 CI/CD 评估集成
- [ ] 已定义在线护栏
- [ ] 已配置生产监控（tracing tool + sampling strategy）
