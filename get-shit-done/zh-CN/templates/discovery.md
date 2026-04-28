# 调研模板

用于 `.planning/phases/XX-name/DISCOVERY.md` 的模板，用于为库/方案决策做浅层调研。

**用途：** 回答 plan-phase 强制 discovery 中“我们该用哪个库/方案”这类问题。

若需要深入生态研究（“专家通常怎么做这个”），请使用 `/gsd-research-phase`，它会生成 RESEARCH.md。

---

## 文件模板

```markdown
---
phase: XX-name
type: discovery
topic: [discovery-topic]
---

<session_initialization>
开始 discovery 前，先确认今天的日期：
!`date +%Y-%m-%d`

在搜索“current”或“latest”信息时使用这个日期。
例如：如果今天是 2025-11-22，应搜索 “2025” 而不是 “2024”。
</session_initialization>

<discovery_objective>
调研 [topic]，为 [phase name] 的实现提供依据。

Purpose: [它支持什么决策/实现]
Scope: [边界]
Output: 包含建议的 DISCOVERY.md
</discovery_objective>

<discovery_scope>
<include>
- [要回答的问题]
- [要调研的领域]
- [如有需要，填写具体对比项]
</include>

<exclude>
- [不属于本次 discovery 范围]
- [推迟到 implementation phase]
</exclude>
</discovery_scope>

<discovery_protocol>

**来源优先级：**
1. **Context7 MCP** - 用于库/框架文档（当前、权威）
2. **Official Docs** - 用于平台专属或未被索引的库
3. **WebSearch** - 用于对比、趋势、社区模式（所有结论都要核验）

**质量检查清单：**
在完成 discovery 前，确认：
- [ ] 所有结论都有权威来源（Context7 或官方文档）
- [ ] 否定性结论（“X 不可行”）已用官方文档核实
- [ ] API 语法/配置来自 Context7 或官方文档（不能只靠 WebSearch）
- [ ] WebSearch 发现已与权威来源交叉核对
- [ ] 已检查最新更新/changelog 是否有 breaking changes
- [ ] 已考虑替代方案（而不是只看第一个找到的解法）

**置信度等级：**
- HIGH: 由 Context7 或官方文档确认
- MEDIUM: 由 WebSearch + Context7/官方文档共同确认
- LOW: 仅来自 WebSearch 或训练知识（需标记待验证）

</discovery_protocol>


<output_structure>
创建 `.planning/phases/XX-name/DISCOVERY.md`：

```markdown
# [Topic] Discovery

## 摘要
[2-3 段执行摘要，说明调研了什么、发现了什么、推荐什么]

## 主要建议
[具体且可执行地说明该做什么以及原因]

## 已考虑的替代方案
[还评估了什么，以及为什么未选]

## 关键发现

### [类别 1]
- [带来源 URL 的发现，以及它与我们场景的相关性]

### [类别 2]
- [带来源 URL 的发现，以及相关性]

## 代码示例
[如适用，填写相关实现模式]

## 元数据

<metadata>
<confidence level="high|medium|low">
[为什么是这个置信度，基于来源质量和验证情况]
</confidence>

<sources>
- [使用的主要权威来源]
</sources>

<open_questions>
[哪些内容无法确定，或需要在实现时验证]
</open_questions>

<validation_checkpoints>
[如果置信度是 LOW 或 MEDIUM，列出实现时需要验证的具体事项]
</validation_checkpoints>
</metadata>
```
</output_structure>

<success_criteria>
- 范围内所有问题都已用权威来源回答
- 质量检查项已完成
- 给出清晰的主要建议
- 低置信度结论已标记验证检查点
- 已可用于指导 PLAN.md 创建
</success_criteria>

<guidelines>
**何时使用 discovery：**
- 技术选择不明确（library A vs B）
- 对不熟悉集成需要最佳实践
- 需要调研 API/库
- 只剩一个决策待定

**何时不要使用：**
- 已经成熟的模式（CRUD、使用已知库的 auth）
- 实现细节（推迟到 execution）
- 现有项目上下文就能回答的问题

**何时改用 RESEARCH.md：**
- 小众/复杂领域（3D、游戏、音频、shader）
- 需要生态知识，而不只是库选择
- “专家怎么做这个”类问题
- 这类情况使用 `/gsd-research-phase`
</guidelines>
