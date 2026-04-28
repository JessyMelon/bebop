<purpose>
按合适的深度级别执行 discovery。
产出 DISCOVERY.md（用于 Level 2-3），为创建 PLAN.md 提供依据。

由 plan-phase.md 的 mandatory_discovery step 传入 depth 参数后调用。

注意：若要进行完整的生态研究（"how do experts build this"），请改用 /gsd-research-phase，它会产出 RESEARCH.md。
</purpose>

<depth_levels>
**此 workflow 支持三种深度级别：**

| Level | Name         | Time      | Output                                       | When                                      |
| ----- | ------------ | --------- | -------------------------------------------- | ----------------------------------------- |
| 1     | Quick Verify | 2-5 min   | No file, proceed with verified knowledge     | Single library, confirming current syntax |
| 2     | Standard     | 15-30 min | DISCOVERY.md                                 | Choosing between options, new integration |
| 3     | Deep Dive    | 1+ hour   | Detailed DISCOVERY.md with validation gates  | Architectural decisions, novel problems   |

**深度由 plan-phase.md 在路由到此处前决定。**
</depth_levels>

<source_hierarchy>
**强制要求：先用 Context7，再用 WebSearch**

Claude 的训练数据落后 6-18 个月。始终要验证。

1. **优先使用 Context7 MCP** - 当前文档，无幻觉
2. **官方文档** - 当 Context7 覆盖不足时
3. **最后才用 WebSearch** - 仅用于比较和趋势

完整协议见 `~/.claude/get-shit-done/templates/discovery.md` 中的 `<discovery_protocol>`。
</source_hierarchy>

<process>

<step name="determine_depth">
检查从 plan-phase.md 传入的 depth 参数：
- `depth=verify` → Level 1（Quick Verification）
- `depth=standard` → Level 2（Standard Discovery）
- `depth=deep` → Level 3（Deep Dive）

路由到下面对应的级别 workflow。
</step>

<step name="level_1_quick_verify">
**Level 1: Quick Verification（2-5 分钟）**

适用于：单个已知库，确认语法/版本仍然正确。

**流程：**

1. 在 Context7 中解析库：

   ```
   mcp__context7__resolve-library-id with libraryName: "[library]"
   ```

2. 获取相关文档：

   ```
   mcp__context7__get-library-docs with:
   - context7CompatibleLibraryID: [from step 1]
   - topic: [specific concern]
   ```

3. 验证：

   - 当前版本符合预期
   - API 语法未变
   - 最近版本没有 breaking changes

4. **如果已验证：** 返回 plan-phase.md 并确认。无需 DISCOVERY.md。

5. **如果发现疑虑：** 升级到 Level 2。

**输出：** 口头确认可继续，或升级到 Level 2。
</step>

<step name="level_2_standard">
**Level 2: Standard Discovery（15-30 分钟）**

适用于：在多个选项之间做选择，或新的外部集成。

**流程：**

1. **确定要调研什么：**

   - 有哪些选项？
   - 关键对比标准是什么？
   - 我们的具体用例是什么？

2. **对每个选项使用 Context7：**

   ```
   For each library/framework:
   - mcp__context7__resolve-library-id
   - mcp__context7__get-library-docs (mode: "code" for API, "info" for concepts)
   ```

3. 对 Context7 缺失的内容查 **官方文档**。

4. 用 **WebSearch** 做比较：

   - "[option A] vs [option B] {current_year}"
   - "[option] known issues"
   - "[option] with [our stack]"

5. **交叉验证：** 任何 WebSearch 结果 → 用 Context7/官方文档确认。

6. **使用 `~/.claude/get-shit-done/templates/discovery.md` 的结构创建 DISCOVERY.md：**

   - 带推荐结论的 Summary
   - 每个选项的关键发现
   - 来自 Context7 的代码示例
   - Confidence level（Level 2 应为 MEDIUM-HIGH）

7. 返回 plan-phase.md。

**输出：** `.planning/phases/XX-name/DISCOVERY.md`
</step>

<step name="level_3_deep_dive">
**Level 3: Deep Dive（1 小时以上）**

适用于：架构决策、新颖问题、高风险选择。

**流程：**

1. **使用 `~/.claude/get-shit-done/templates/discovery.md` 确定调研范围：**

   - 定义清晰范围
   - 定义 include/exclude 边界
   - 列出要回答的具体问题

2. **穷尽式 Context7 调研：**

   - 所有相关库
   - 相关模式与概念
   - 必要时每个库的多个 topic

3. **深入阅读官方文档：**

   - 架构指南
   - Best practices 章节
   - 迁移/升级指南
   - 已知限制

4. **用 WebSearch 获取生态上下文：**

   - 其他人如何解决类似问题
   - 生产环境经验
   - Gotchas 和反模式
   - 最近变更/公告

5. **交叉验证所有发现：**

   - 每条 WebSearch 声明 → 用权威来源验证
   - 标明哪些已验证、哪些是推断
   - 标记矛盾点

6. **创建完整的 DISCOVERY.md：**

   - 使用 `~/.claude/get-shit-done/templates/discovery.md` 的完整结构
   - 带 source attribution 的质量报告
   - 每条发现的 confidence
   - 若任何关键发现为 LOW confidence → 添加 validation checkpoints

7. **置信度闸门：** 如果整体 confidence 为 LOW，先呈现选项再继续。

8. 返回 plan-phase.md。

**输出：** `.planning/phases/XX-name/DISCOVERY.md`（完整版）
</step>

<step name="identify_unknowns">
**对于 Level 2-3：** 定义我们需要弄清什么。

问：在为这个 phase 制定计划前，我们需要先弄清什么？

- 技术选型？
- 最佳实践？
- API 模式？
- 架构方案？
  </step>

<step name="create_discovery_scope">
使用 ~/.claude/get-shit-done/templates/discovery.md。

包括：

- 清晰的 discovery 目标
- 有范围的 include/exclude 列表
- Source preferences（官方文档、Context7、当年资料）
- DISCOVERY.md 的输出结构
  </step>

<step name="execute_discovery">
执行 discovery：
- 用 web search 获取最新信息
- 用 Context7 MCP 获取库文档
- 优先使用当年的资料来源
- 按模板组织发现
</step>

<step name="create_discovery_output">
写入 `.planning/phases/XX-name/DISCOVERY.md`：
- 带推荐结论的 Summary
- 附带来源的关键发现
- 如适用则附代码示例
- Metadata（confidence、dependencies、open questions、assumptions）
</step>

<step name="confidence_gate">
创建 DISCOVERY.md 后，检查 confidence level。

如果 confidence 为 LOW：

**Text mode (`workflow.text_mode: true` in config or `--text` flag)：** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 激活时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。对于不支持 `AskUserQuestion` 的非 Claude 运行时（OpenAI Codex、Gemini CLI 等），这是必需的。
使用 AskUserQuestion：

- header: "Low Conf."
- question: "Discovery confidence is LOW: [reason]. How would you like to proceed?"
- options:
  - "Dig deeper" - Do more research before planning
  - "Proceed anyway" - Accept uncertainty, plan with caveats
  - "Pause" - I need to think about this

如果 confidence 为 MEDIUM：
内联显示："Discovery complete (medium confidence). [brief reason]. Proceed to planning?"

如果 confidence 为 HIGH：
直接继续，只需注明："Discovery complete (high confidence)."
</step>

<step name="open_questions_gate">
如果 DISCOVERY.md 中有 open_questions：

内联展示：
"Open questions from discovery:

- [Question 1]
- [Question 2]

These may affect implementation. Acknowledge and proceed? (yes / address first)"

如果用户选择 "address first"：收集用户对这些问题的输入，并更新 discovery。
</step>

<step name="offer_next">
```
Discovery complete: .planning/phases/XX-name/DISCOVERY.md
Recommendation: [one-liner]
Confidence: [level]

What's next?

1. Discuss phase context (/gsd-discuss-phase [current-phase])
2. Create phase plan (/gsd-plan-phase [current-phase])
3. Refine discovery (dig deeper)
4. Review discovery

```

注意：DISCOVERY.md 不会单独提交。它会在 phase 完成时一起提交。
</step>

</process>

<success_criteria>
**Level 1（Quick Verify）：**
- 已针对库/topic 查阅 Context7
- 当前状态已验证，或疑虑已升级处理
- 已口头确认可继续（不生成文件）

**Level 2（Standard）：**
- 已针对所有选项查阅 Context7
- WebSearch 结果已交叉验证
- 已创建带推荐结论的 DISCOVERY.md
- Confidence level 为 MEDIUM 或更高
- 已可用于指导 PLAN.md 创建

**Level 3（Deep Dive）：**
- 已定义 discovery 范围
- 已穷尽查阅 Context7
- 所有 WebSearch 结果都已对照权威来源验证
- 已创建包含完整分析的 DISCOVERY.md
- 已生成带 source attribution 的质量报告
- 若存在 LOW confidence 发现 → 已定义 validation checkpoints
- 已通过 confidence gate
- 已可用于指导 PLAN.md 创建
</success_criteria>
