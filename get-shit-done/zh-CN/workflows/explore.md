<purpose>
苏格拉底式构思工作流。通过追问引导开发者探索想法，在合适时提供对话中的研究支持，然后把已成形的结果路由到 GSD 工件。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。

@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/domain-probes.md
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-phase-researcher — 研究具体问题并返回简洁结论
</available_agent_types>

<process>

## Step 1: 打开对话

如果提供了主题，先确认主题并开始探索：
```
## Explore: {topic}

Let's think through this together. I'll ask questions to help clarify the idea
before we commit to any artifacts.
```

如果没有主题，则提问：
```
## Explore

What's on your mind? This could be a feature idea, an architectural question,
a problem you're trying to solve, or something you're not sure about yet.
```

## Step 2: 苏格拉底式对话（2-5 轮）

用 `questioning.md` 和 `domain-probes.md` 中的原则来引导对话：

- **一次只问一个问题**（绝不要一次列多个问题）
- 问题应探查：约束、权衡、用户、范围、依赖、风险
- 当主题涉及已知领域时，按上下文使用领域探针
- 留意这些信号："or" / "versus" / "tradeoff" 往往表示存在值得深入的优先级冲突
- 在继续前，先复述你听到的内容，确认理解无误

**对话应自然，而不是公式化。** 避免僵硬流程。跟随开发者当下的关注点，如果他们对某个方面更有兴趣，就往那里深入。

## Step 3: 对话中途提供研究选项（2-3 轮后）

如果对话暴露出事实问题、技术对比，或能通过研究澄清的未知项，则提供：

```
This touches on [specific question]. Want me to do a quick research pass before we continue?
This would take ~30 seconds and might surface useful context.

[Yes, research this] / [No, let's keep exploring]
```

如果选择 yes，启动 research agent：
```
Task(
  prompt="Quick research: {specific_question}. Return 3-5 key findings, no more than 200 words.",
  subagent_type="gsd-phase-researcher"
)
```

分享研究结果后继续对话。

如果主题不需要研究，就完全跳过这一步。**不要硬加。**

## Step 4: 凝练输出（3-6 轮后）

当对话自然收束，或开发者表示准备好了，就提出输出建议。分析对话内容，识别聊到了什么，并从下列类型中**最多建议 4 项输出**：

| Type | Destination | When to suggest |
|------|-------------|-----------------|
| Note | `.planning/notes/{slug}.md` | 值得保留的观察、上下文、决策 |
| Todo | `.planning/todos/pending/{slug}.md` | 已识别出的具体可执行任务 |
| Seed | `.planning/seeds/{slug}.md` | 带触发条件的前瞻性想法 |
| Research question | `.planning/research/questions.md` (append) | 需要更深入调查的开放问题 |
| Requirement | `REQUIREMENTS.md` (append) | 对话中浮现出的清晰需求 |
| New phase | `ROADMAP.md` (append) | 范围已经大到值得单独成 phase |
| Spike | `/gsd-spike` (invoke) | 可行性存在不确定性，如 “这个 API 能用吗？”、“我们能做 X 吗？” |
| Sketch | `/gsd-sketch` (invoke) | 设计方向不清晰，如 “它应该长什么样？”、“应该是什么感觉？” |

展示建议：
```
Based on our conversation, I'd suggest capturing:

1. **Note:** "Authentication strategy decisions" — your reasoning about JWT vs sessions
2. **Todo:** "Evaluate Passport.js vs custom middleware" — the comparison you want to do
3. **Seed:** "OAuth2 provider support" — trigger: when user management phase starts

Create these? You can select specific ones or modify them.

[Create all] / [Let me pick] / [Skip — just exploring]
```

**没有用户明确选择，就绝不要写工件。**

## Step 5: 写入所选输出

对每个选中的输出，写入对应文件：

- **Notes:** 创建 `.planning/notes/{slug}.md`，frontmatter 包含（title、date、context）
- **Todos:** 创建 `.planning/todos/pending/{slug}.md`，frontmatter 包含（title、date、priority）
- **Seeds:** 创建 `.planning/seeds/{slug}.md`，frontmatter 包含（title、trigger_condition、planted_date）
- **Research questions:** 追加到 `.planning/research/questions.md`
- **Requirements:** 追加到 `.planning/REQUIREMENTS.md`，使用下一个可用的 REQ ID
- **Phases:** 通过 SlashCommand 使用现有 `/gsd-add-phase` 命令

如果启用了 `commit_docs`，则提交：
```bash
gsd-sdk query commit "docs: capture exploration — {topic_slug}" {file_list}
```

## Step 6: 收尾

```
## Exploration Complete

**Topic:** {topic}
**Outputs:** {count} artifact(s) created
{list of created files}

Continue exploring with `/gsd-explore` or start working with `/gsd-next`.
```

</process>

<success_criteria>
- [ ] 苏格拉底式对话遵循 questioning.md 的原则
- [ ] 问题逐个提出，而不是成批抛出
- [ ] 研究是在合适语境下提供的（不是强行加入）
- [ ] 已根据对话提出最多 4 个输出
- [ ] 用户已明确选择要创建哪些输出
- [ ] 文件已写入正确位置
- [ ] 提交行为遵守 commit_docs 配置
</success_criteria>
