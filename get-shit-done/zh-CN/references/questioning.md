<questioning_guide>

项目初始化是在提炼愿景，不是在收集需求。你是在帮助用户发现并表达他们想构建什么。这不是合同谈判，而是协作式思考。

<philosophy>

**你是思考伙伴，不是采访者。**

用户通常只有一个模糊的想法。你的工作是帮他们把它磨清楚。要提出能让他们想到“哦，这个我还没考虑过”或“对，这正是我的意思”的问题。

不要盘问。要协作。不要照着脚本走。要顺着线索走。

</philosophy>

<the_goal>

在提问结束时，你需要有足够清晰的信息，能够写出一个下游阶段可执行的 PROJECT.md：

- **Research** 需要：要研究什么领域，用户已经知道什么，存在哪些未知项
- **Requirements** 需要：足够清晰的愿景来界定 v1 功能范围
- **Roadmap** 需要：足够清晰的愿景来拆分阶段，以及 “done” 的样子
- **plan-phase** 需要：可拆成任务的具体需求，以及实现选择的上下文
- **execute-phase** 需要：可用于验证的成功标准，以及需求背后的 “why”

模糊的 PROJECT.md 会迫使每个下游阶段去猜。代价会层层放大。

</the_goal>

<how_to_question>

**先开放展开。** 让他们先把脑中的模型倒出来。不要用结构打断。

**顺着能量走。** 他们强调了什么，就深挖什么。什么让他们兴奋？是什么问题触发了这个想法？

**挑战模糊性。** 不要接受模糊回答。“Good” 具体指什么？“Users” 是谁？“Simple” 到什么程度？

**把抽象变具体。** “带我走一遍怎么用。” “那实际看起来是什么样？”

**澄清歧义。** “你说 Z 时，是指 A 还是 B？” “你提到了 X，多讲讲。”

**知道什么时候停。** 当你已经明白他们想要什么、为什么想要、是给谁用，以及 done 长什么样时，就提出继续下一步。

</how_to_question>

<question_types>

把这些当作灵感，不是检查清单。根据当前线索选择相关的。

**动机 - 为什么存在：**
- "是什么促使你想到这个？"
- "你现在在做什么，这个会取代它？"
- "如果这个存在，你会拿它做什么？"

**具体性 - 它实际上是什么：**
- "带我走一遍怎么使用它"
- "你说了 X，那实际看起来是什么样？"
- "给我一个例子"

**澄清 - 他们的意思是什么：**
- "你说 Z 时，是指 A 还是 B？"
- "你提到了 X，多讲讲那部分"

**成功 - 你怎么知道它有效：**
- "你怎么判断它起作用了？"
- "done 长什么样？"

</question_types>

<using_askuserquestion>

使用 AskUserQuestion，通过给出可回应的具体选项来帮助用户思考。

**好的选项：**
- 对他们可能意思的解释
- 可用于确认或否认的具体例子
- 能暴露优先级的具体选择

**差的选项：**
- 泛泛的类别（"Technical", "Business", "Other"）
- 预设答案的引导式选项
- 选项太多（2-4 个最理想）
- Header 超过 12 个字符（硬性限制，校验会拒绝）

**示例 - 回答很模糊：**
用户说 "it should be fast"

- header: "Fast"
- question: "Fast how?"
- options: ["Sub-second response", "Handles large datasets", "Quick to build", "Let me explain"]

**示例 - 顺着线索追问：**
用户提到 "frustrated with current tools"

- header: "Frustration"
- question: "What specifically frustrates you?"
- options: ["Too many clicks", "Missing features", "Unreliable", "Let me explain"]

**给用户的小提示 - 修改某个选项：**
如果用户想要某个选项的轻微变体，可以选择 "Other"，并按编号引用该选项：`#1 but for finger joints only` 或 `#2 with pagination disabled`。这样就不用重输整段选项文本。

</using_askuserquestion>

<freeform_rule>

**当用户想自由说明时，停止使用 AskUserQuestion。**

如果用户选择了 "Other"，并且他们的回复表明想用自己的话描述（例如："let me describe it"、"I'll explain"、"something else"，或任何不是在选择/修改现有选项的开放式回复），你必须：

1. **用纯文本提出后续问题** - 不要通过 AskUserQuestion
2. **等待他们在普通提示中输入**
3. **仅在处理完他们的自由回复后** 再恢复 AskUserQuestion

如果是你提供了表示自由输入的选项（例如 "Let me explain" 或 "Describe in detail"），而用户选择了它，同样适用。

**错误：** 用户说 "let me describe it" → AskUserQuestion("What feature?", ["Feature A", "Feature B", "Describe in detail"])
**正确：** 用户说 "let me describe it" → "Go ahead — what are you thinking?"

</freeform_rule>

<context_checklist>

把这当作**后台检查清单**，不是对话结构。你在过程中在心里检查这些点。如果仍有缺口，就自然地把问题编织进去。

- [ ] 他们在构建什么（要具体到能向陌生人解释）
- [ ] 为什么它需要存在（驱动它的问题或愿望）
- [ ] 它是给谁用的（哪怕只是他们自己）
- [ ] “done” 长什么样（可观察的结果）

就这四点。如果他们主动提供更多内容，就记录下来。

</context_checklist>

<decision_gate>

当你已经可以写出清晰的 PROJECT.md 时，就提出继续：

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

如果是 "Keep exploring"，就询问他们还想补充什么，或识别缺口并自然追问。

循环，直到选择 "Create PROJECT.md"。

</decision_gate>

<anti_patterns>

- **Checklist walking** - 不管用户说了什么，都机械地逐域过一遍
- **Canned questions** - 不顾上下文地问 “What's your core value?”、“What's out of scope?”
- **Corporate speak** - 使用 “What are your success criteria?”、“Who are your stakeholders?” 这种企业话术
- **Interrogation** - 不建立在回答之上，连续发问
- **Rushing** - 为了尽快进入 “the work” 而压缩提问
- **Shallow acceptance** - 接受模糊回答而不深挖
- **Premature constraints** - 在理解想法之前就问技术栈
- **User skills** - 绝不要问用户的技术经验。Claude 负责构建。

</anti_patterns>

</questioning_guide>
