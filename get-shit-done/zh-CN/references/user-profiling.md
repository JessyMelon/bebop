# 用户画像：检测启发式参考

本参考文档定义了跨 8 个维度进行行为画像的检测启发式规则。`gsd-user-profiler` agent 在分析提取出的会话消息时会应用这些规则。不要编造此处未定义的维度或评分规则。

## 如何使用本文档

1. `gsd-user-profiler` agent 在分析任何消息前先读取本文档
2. 对每个维度，agent 扫描消息中下方定义的信号模式
3. agent 应用检测启发式规则，对开发者的模式进行分类
4. 置信度按各维度定义的阈值评分
5. 证据引用按 Evidence Curation 部分的规则筛选
6. 输出必须符合 Output Schema 部分中的 JSON schema

---

## 维度

### 1. 沟通风格

`dimension_id: communication_style`

**衡量内容：**开发者如何表述请求、指令与反馈，即他们发给 Claude 的消息结构模式。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `terse-direct` | 简短、祈使式消息，背景极少。直奔主题。 |
| `conversational` | 中等长度消息，混合指令、问题和边想边说。语气自然、非正式。 |
| `detailed-structured` | 长消息，结构明确，如标题、编号列表、问题陈述、预分析。 |
| `mixed` | 没有主导模式；风格会随任务类型或项目上下文切换。 |

**信号模式：**

1. **Message length distribution** -- 跨消息的平均词数。简短型 < 50 词， conversational 为 50-200 词， detailed 为 > 200 词。
2. **Imperative-to-interrogative ratio** -- 命令（"fix this"、"add X"）与提问（"what do you think?"、"should we?"）的比例。高祈使比例倾向 `terse-direct`。
3. **Structural formatting** -- 消息内是否存在 markdown 标题、编号列表、代码块或项目符号。格式化频繁倾向 `detailed-structured`。
4. **Context preambles** -- 开发者是否在请求前提供背景/上下文。存在前置背景倾向 conversational 或 detailed-structured。
5. **Sentence completeness** -- 消息是完整句子还是碎片/速记。碎片化倾向 `terse-direct`。
6. **Follow-up pattern** -- 开发者是否会在后续消息补充上下文（多消息请求倾向 conversational）。

**检测启发式规则：**

1. 如果平均消息长度 < 50 词，且主要为祈使语气，且格式极少 --> `terse-direct`
2. 如果平均消息长度为 50-200 词，且祈使与疑问混合，且偶尔使用格式 --> `conversational`
3. 如果平均消息长度 > 200 词，且结构化格式频繁，且带有上下文前言 --> `detailed-structured`
4. 如果消息长度方差较高（标准差 > 平均值的 60%），且没有单一模式占主导（少于 60% 的消息匹配同一种风格） --> `mixed`
5. 如果模式会随项目类型系统性变化（例如 CLI 项目简短，前端项目详细） --> `mixed`，并附上下文相关说明

**置信度评分：**

- **HIGH:** 10+ 条消息显示一致模式（> 70% 匹配），且同一模式出现在 2+ 个项目中
- **MEDIUM:** 5-9 条消息显示该模式，或仅在 1 个项目内保持一致
- **LOW:** < 5 条具有相关信号的消息，或信号混杂（相似上下文中观察到矛盾模式）
- **UNSCORED:** 0 条与该维度相关的消息

**示例引用：**

- **terse-direct:** "fix the auth bug" / "add pagination to the list endpoint" / "this test is failing, make it pass"
- **conversational:** "I'm thinking we should probably handle the error case here. What do you think about returning a 422 instead of a 500? The client needs to know it was a validation issue."
- **detailed-structured:** "## Context\nThe auth flow currently uses session cookies but we need to migrate to JWT.\n\n## Requirements\n1. Access tokens (15min expiry)\n2. Refresh tokens (7-day)\n3. httpOnly cookies\n\n## What I've tried\nI looked at jose and jsonwebtoken..."

**上下文相关模式：**

当沟通风格会随项目或任务类型系统性变化时，应报告这种分裂，而不是强行给出单一评分。例如："context-dependent: terse-direct for bug fixes and CLI tooling, detailed-structured for architecture and frontend work." Phase 3 orchestration 会通过向用户展示这种分裂来解决上下文相关分歧。

---

### 2. 决策速度

`dimension_id: decision_speed`

**衡量内容：**当 Claude 提供选项、替代方案或权衡时，开发者做出选择的速度。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `fast-intuitive` | 基于经验或直觉立即决定。思考极少。 |
| `deliberate-informed` | 决定前先要求比较或摘要。希望理解取舍。 |
| `research-first` | 先独立调研，再决定。可能离开后带着结论回来。 |
| `delegator` | 直接采用 Claude 的建议。信任推荐。 |

**信号模式：**

1. **Response latency to options** -- 从 Claude 提供选项到开发者选择，中间隔了多少条消息。立即决定（同条或下一条消息）倾向 fast-intuitive。
2. **Comparison requests** -- 出现 "compare these"、"what are the trade-offs?"、"pros and cons?" 倾向 deliberate-informed。
3. **External research indicators** -- 诸如 "I looked into X and..."、"according to the docs..."、"I read that..." 倾向 research-first。
4. **Delegation language** -- 诸如 "just pick one"、"whatever you recommend"、"your call"、"go with the best option" 倾向 delegator。
5. **Decision reversal frequency** -- 开发者做出决定后又改变决定的频率。频繁反转可能表示 low confidence 的 fast-intuitive。

**检测启发式规则：**

1. 如果开发者在选项给出后的 1-2 条消息内完成选择，且使用果断措辞（"use X"、"go with A"），且很少要求比较 --> `fast-intuitive`
2. 如果开发者请求权衡分析或对比表，且在收到比较后做决定，并会提出澄清问题 --> `deliberate-informed`
3. 如果开发者用 "let me look into this" 推迟决定，随后带着外部信息返回，并引用文档或文章 --> `research-first`
4. 如果开发者多次使用委托措辞（> 3 次），且很少推翻 Claude 的选择，并会说 "sounds good" 或 "your call" --> `delegator`
5. 如果没有明显模式，或证据分散在多种风格中 --> 分类为主导风格，并加上下文说明

**置信度评分：**

- **HIGH:** 观察到 10+ 个决策点且模式一致，同一模式出现在 2+ 个项目中
- **MEDIUM:** 5-9 个决策点，或仅在 1 个项目内一致
- **LOW:** 观察到 < 5 个决策点，或决策风格混杂
- **UNSCORED:** 0 条包含决策相关信号的消息

**示例引用：**

- **fast-intuitive:** "Use Tailwind. Next question." / "Option B, let's move on"
- **deliberate-informed:** "Can you compare Prisma vs Drizzle for this use case? I want to understand the migration story and type safety differences before I pick."
- **research-first:** "Hold off on the DB choice -- I want to read the Drizzle docs and check their GitHub issues first. I'll come back with a decision."
- **delegator:** "You know more about this than me. Whatever you recommend, go with it."

**上下文相关模式：**

决策速度通常会随风险高低变化。开发者可能对样式选择是 fast-intuitive，但对数据库或 auth 决策是 research-first。若模式明确，应报告这种分裂："context-dependent: fast-intuitive for low-stakes (styling, naming), deliberate-informed for high-stakes (architecture, security)."

---

### 3. 解释深度

`dimension_id: explanation_depth`

**衡量内容：**开发者希望在代码之外得到多少解释，即他们对“理解”与“速度”的偏好。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `code-only` | 只想要可运行代码，几乎不需要解释。能直接读懂代码。 |
| `concise` | 希望附带简要方法说明。点出关键决策，不要求穷尽。 |
| `detailed` | 希望得到完整的方案、推理和代码讲解。偏好结构化说明。 |
| `educational` | 希望深入的概念解释。把交互视为学习机会。 |

**信号模式：**

1. **Explicit depth requests** -- "just show me the code"、"explain why"、"teach me about X"、"skip the explanation"
2. **Reaction to explanations** -- 开发者会跳过解释吗？会要求更多细节吗？会说 "too much" 吗？
3. **Follow-up question depth** -- 表层追问（"does it work?"）还是概念性追问（"why this pattern over X?"）
4. **Code comprehension signals** -- 开发者是否在消息中提到实现细节？这通常表示他们能直接读懂代码。
5. **"I know this" signals** -- 如 "I'm familiar with X"、"skip the basics"、"I know how hooks work"，说明对解释的偏好较低。

**检测启发式规则：**

1. 如果开发者说 "just the code" 或 "skip the explanation"，且很少追问概念问题，并且会直接引用代码细节 --> `code-only`
2. 如果开发者接受简短解释而不要求更多，并会针对具体决策提出聚焦追问 --> `concise`
3. 如果开发者会问 "why"，要求 walkthrough，并认可结构化解释 --> `detailed`
4. 如果开发者会提出超出当前任务的概念问题，并使用学习语言（"I want to understand"、"teach me"） --> `educational`

**置信度评分：**

- **HIGH:** 10+ 条消息表现出一致偏好，同一偏好出现在 2+ 个项目中
- **MEDIUM:** 5-9 条消息，或仅在 1 个项目内一致
- **LOW:** < 5 条相关消息，或不同交互中的偏好发生变化
- **UNSCORED:** 0 条具有相关信号的消息

**示例引用：**

- **code-only:** "Just give me the implementation. I'll read through it." / "Skip the explanation, show the code."
- **concise:** "Quick summary of the approach, then the code please." / "Why did you use a Map here instead of an object?"
- **detailed:** "Walk me through this step by step. I want to understand the auth flow before we implement it."
- **educational:** "Can you explain how JWT refresh token rotation works conceptually? I want to understand the security model, not just implement it."

**上下文相关模式：**

解释深度通常与领域熟悉度相关。开发者可能对熟悉技术只要 code-only，但在新领域需要 educational。若观察到分裂，应报告："context-dependent: code-only for React/TypeScript, detailed for database optimization."

---

### 4. 调试方式

`dimension_id: debugging_approach`

**衡量内容：**开发者在与 Claude 协作时，面对问题、报错和异常行为的处理方式。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `fix-first` | 直接贴错误，希望立刻修好。对诊断兴趣较低。结果导向。 |
| `diagnostic` | 带上下文共享错误，希望先理解原因再修复。 |
| `hypothesis-driven` | 先独立调查，再带着具体猜测来找 Claude 验证。 |
| `collaborative` | 希望与 Claude 一步步共同排查。 |

**信号模式：**

1. **Error presentation style** -- 只贴原始错误（fix-first），还是“错误 + 我觉得可能是...” （hypothesis-driven），还是 "Can you help me understand why..."（diagnostic）
2. **Pre-investigation indicators** -- 开发者是否分享了自己已尝试的内容？是否提到查日志、检查状态或隔离问题？
3. **Root cause interest** -- 修好之后，开发者会问 "why did that happen?" 还是直接进入下一项？
4. **Step-by-step language** -- "Let's check X first"、"what should we look at next?"、"walk me through the debugging"
5. **Fix acceptance pattern** -- 开发者会立刻采用修复方案，还是先质疑/确认？

**检测启发式规则：**

1. 如果开发者贴错误时不带上下文，接受修复也不追问根因，并且立刻转向下一项 --> `fix-first`
2. 如果开发者提供错误上下文，问 "why is this happening?"，并希望修复时附带解释 --> `diagnostic`
3. 如果开发者分享自己的分析，并提出理论（"I think the issue is X because..."），然后请 Claude 证实或反驳 --> `hypothesis-driven`
4. 如果开发者使用协作措辞（"let's"、"what should we check?"），偏好增量诊断，并愿意一起走完整个排查过程 --> `collaborative`

**置信度评分：**

- **HIGH:** 10+ 次调试交互显示一致方式，同一方式出现在 2+ 个项目中
- **MEDIUM:** 5-9 次调试交互，或仅在 1 个项目内一致
- **LOW:** < 5 次调试交互，或方式变化较大
- **UNSCORED:** 0 条具有调试相关信号的消息

**示例引用：**

- **fix-first:** "Getting this error: TypeError: Cannot read properties of undefined. Fix it."
- **diagnostic:** "The API returns 500 when I send a POST to /users. Here's the request body and the server log. What's causing this?"
- **hypothesis-driven:** "I think the race condition is in the useEffect cleanup. I checked and the subscription isn't being cancelled on unmount. Can you confirm?"
- **collaborative:** "Let's debug this together. The test passes locally but fails in CI. What should we check first?"

**上下文相关模式：**

调试方式可能随紧急程度变化。开发者可能在截止期前更偏 fix-first，而在日常开发中更偏 hypothesis-driven。如果检测到，应注明这种时间相关模式。

---

### 5. UX 理念

`dimension_id: ux_philosophy`

**衡量内容：**相较于功能实现，开发者对用户体验、设计与视觉质量的重视程度。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `function-first` | 先跑通，再打磨。实现阶段对 UX 关注较少。 |
| `pragmatic` | 从一开始就保证基本可用性。不丑不坏，但不追求设计洁癖。 |
| `design-conscious` | 设计与 UX 与功能同等重要。关注视觉细节。 |
| `backend-focused` | 主要做 backend/CLI。前端接触或兴趣都较少。 |

**信号模式：**

1. **Design-related requests** -- 是否提到样式、布局、响应式、动画、配色、间距
2. **Polish timing** -- 开发者会在实现过程中就要求视觉打磨，还是推后处理？
3. **UI feedback specificity** -- 模糊（"make it look better"）还是具体（"increase the padding to 16px, change the font weight to 600"）
4. **Frontend vs. backend distribution** -- 以前端为主的请求与以后端为主的请求之比
5. **Accessibility mentions** -- 是否提到 a11y、屏幕阅读器、键盘导航、ARIA labels

**检测启发式规则：**

1. 如果开发者很少提 UI/UX，更关注逻辑、API、数据，并且会推迟样式（"we'll make it pretty later"） --> `function-first`
2. 如果开发者会包含基本 UX 要求，提可用性但不追求像素级完美，并在形式与功能间保持平衡 --> `pragmatic`
3. 如果开发者给出具体设计要求，提到打磨、动画、间距，并像对待逻辑 bug 一样重视 UI bug --> `design-conscious`
4. 如果开发者主要做 CLI 工具、API 或 backend 系统，几乎不做 frontend，消息集中在数据、性能、基础设施 --> `backend-focused`

**置信度评分：**

- **HIGH:** 10+ 条消息含有 UX 相关信号，同一模式出现在 2+ 个项目中
- **MEDIUM:** 5-9 条消息，或仅在 1 个项目内一致
- **LOW:** < 5 条相关消息，或理念会随项目类型变化
- **UNSCORED:** 0 条具有 UX 相关信号的消息

**示例引用：**

- **function-first:** "Just get the form working. We'll style it later." / "I don't care how it looks, I need the data flowing."
- **pragmatic:** "Make sure the loading state is visible and the error messages are clear. Standard styling is fine."
- **design-conscious:** "The button needs more breathing room -- add 12px vertical padding and make the hover state transition 200ms. Also check the contrast ratio."
- **backend-focused:** "I'm building a CLI tool. No UI needed." / "Add the REST endpoint, I'll handle the frontend separately."

**上下文相关模式：**

UX 理念天然受项目影响。开发 CLI 工具的开发者在该项目中必然更偏 backend-focused。应尽量区分是项目驱动，还是偏好驱动。如果开发者只有 backend 项目，应注明该评分受可用数据限制："backend-focused (note: all analyzed projects are backend/CLI -- may not reflect frontend preferences)."

---

### 6. 供应商理念

`dimension_id: vendor_philosophy`

**衡量内容：**开发者选择和评估库、框架与外部服务时的方式。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `pragmatic-fast` | 用能工作的、Claude 建议的，或最快的方案。评估很少。 |
| `conservative` | 偏好知名、久经考验、广泛采用的选项。规避风险。 |
| `thorough-evaluator` | 在承诺之前会研究替代方案、读文档并比较特性与取舍。 |
| `opinionated` | 对特定工具有强烈且既有的偏好。清楚自己要什么。 |

**信号模式：**

1. **Library selection language** -- "just use whatever"、"is X the standard?"、"I want to compare A vs B"、"we're using X, period"
2. **Evaluation depth** -- 开发者会接受第一个建议，还是要求备选方案？
3. **Stated preferences** -- 是否明确提到偏好工具、过往经验或工具理念
4. **Rejection patterns** -- 开发者会拒绝 Claude 的建议吗？理由是什么（流行度、个人经验、文档质量）？
5. **Dependency attitude** -- "minimize dependencies"、"no external deps"、"add whatever we need"，体现其对外部代码的态度

**检测启发式规则：**

1. 如果开发者接受库建议时没有明显异议，会说 "sounds good" 或 "go with that"，且很少问备选方案 --> `pragmatic-fast`
2. 如果开发者会问流行度、维护情况、社区情况，偏好 "industry standard" 或 "battle-tested"，并回避新/实验性方案 --> `conservative`
3. 如果开发者要求比较，会在决定前读文档，并会问边界情况、许可证、bundle size --> `thorough-evaluator`
4. 如果开发者在未被提示时就点名具体库，会推翻 Claude 的建议，并表达强烈偏好 --> `opinionated`

**置信度评分：**

- **HIGH:** 观察到 10+ 次 vendor/library 决策，同一模式出现在 2+ 个项目中
- **MEDIUM:** 5-9 次决策，或仅在 1 个项目内一致
- **LOW:** 观察到 < 5 次 vendor 决策，或模式会变化
- **UNSCORED:** 0 条具有 vendor selection 信号的消息

**示例引用：**

- **pragmatic-fast:** "Use whatever ORM you recommend. I just need it working." / "Sure, Tailwind is fine."
- **conservative:** "Is Prisma the most widely used ORM for this? I want something with a large community." / "Let's stick with what most teams use."
- **thorough-evaluator:** "Before we pick a state management library, can you compare Zustand vs Jotai vs Redux Toolkit? I want to understand bundle size, API surface, and TypeScript support."
- **opinionated:** "We're using Drizzle, not Prisma. I've used both and Drizzle's SQL-like API is better for complex queries."

**上下文相关模式：**

vendor 理念可能随项目重要性或领域变化。个人项目可能更 pragmatic-fast，而专业项目更 thorough-evaluator。若检测到，应报告这种分裂。

---

### 7. 挫败触发因素

`dimension_id: frustration_triggers`

**衡量内容：**什么会在开发者发给 Claude 的消息中引发明显的挫败感、纠正行为或负面情绪信号。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `scope-creep` | Claude 做了没被要求的事时会让其沮丧。希望执行边界清晰。 |
| `instruction-adherence` | Claude 未精确遵循指令时会让其沮丧。重视准确性。 |
| `verbosity` | Claude 解释过多或太啰嗦时会让其沮丧。偏好简洁。 |
| `regression` | Claude 修一处却把其他正常代码弄坏时会让其沮丧。重视稳定性。 |

**信号模式：**

1. **Correction language** -- "I didn't ask for that"、"don't do X"、"I said Y not Z"、"why did you change this?"
2. **Repetition patterns** -- 重复同一指令并加重语气，倾向 instruction-adherence 型挫败
3. **Emotional tone shifts** -- 从中性转为简短、使用大写、感叹号或明确表达不满
4. **"Don't" statements** -- "don't add extra features"、"don't explain so much"、"don't touch that file"，他们禁止什么，就反映了什么最让他们恼火
5. **Frustration recovery** -- 开发者在一次挫败事件后多久恢复到中性语气

**检测启发式规则：**

1. 如果开发者因 Claude 做了未请求的工作而纠正它，并使用 "I only asked for X"、"stop adding things"、"stick to what I asked" 等措辞 --> `scope-creep`
2. 如果开发者重复指令，并纠正与已陈述要求不符的具体偏差，同时强调精确性（"I specifically said..."） --> `instruction-adherence`
3. 如果开发者要求 Claude 更短，跳过解释，并对篇幅表达不耐烦（"too much"、"just the answer"） --> `verbosity`
4. 如果开发者对功能回归表达不满，会检查 regression，并说 "you broke X while fixing Y" --> `regression`

**置信度评分：**

- **HIGH:** 10+ 次挫败事件呈现一致触发模式，同一触发因素出现在 2+ 个项目中
- **MEDIUM:** 5-9 次挫败事件，或仅在 1 个项目内一致
- **LOW:** 观察到 < 5 次挫败事件（注意：挫败次数低是正向信号，表示开发者整体满意，而不是数据不足）
- **UNSCORED:** 0 条具有挫败信号的消息（注意："no frustration detected" 是有效结论）

**示例引用：**

- **scope-creep:** "I asked you to fix the login bug, not refactor the entire auth module. Revert everything except the bug fix."
- **instruction-adherence:** "I said to use a Map, not an object. I was specific about this. Please redo it with a Map."
- **verbosity:** "Way too much explanation. Just show me the code change, nothing else."
- **regression:** "The search was working fine before. Now after your 'fix' to the filter, search results are empty. Don't touch things I didn't ask you to change."

**上下文相关模式：**

挫败触发因素往往跨项目保持稳定（更偏人格驱动，而不是项目驱动）。不过其强度可能会随项目风险而变化。如果观察到多个触发因素，应报告主因（最常见者），并注明次要因素。

---

### 8. 学习风格

`dimension_id: learning_style`

**衡量内容：**开发者在接触新概念、工具或模式时，更喜欢怎样理解它们。

**评分范围：**

| 评分 | 说明 |
|--------|-------------|
| `self-directed` | 直接读代码，独立弄清楚。向 Claude 提具体问题。 |
| `guided` | 让 Claude 解释相关部分。偏好被引导式理解。 |
| `documentation-first` | 先看官方文档和教程，再深入。会引用文档。 |
| `example-driven` | 想要可运行示例，在修改示例中学习。属于模式匹配型学习者。 |

**信号模式：**

1. **Learning initiation** -- 开发者是从读代码、请求解释、索要文档，还是请求示例开始？
2. **Reference to external sources** -- 提到文档、教程、Stack Overflow、博客文章，倾向 documentation-first
3. **Example requests** -- "show me an example"、"can you give me a sample?"、"let me see how this looks in practice"
4. **Code-reading indicators** -- "I looked at the implementation"、"I see that X calls Y"、"from reading the code..."
5. **Explanation requests vs. code requests** -- "explain X" 与 "show me X" 消息的比例

**检测启发式规则：**

1. 如果开发者提到直接读代码、提出具体聚焦问题，并表现出独立调查 --> `self-directed`
2. 如果开发者让 Claude 解释概念、要求 walkthrough，并偏好由 Claude 中介的理解 --> `guided`
3. 如果开发者引用文档、要求文档链接，并提到阅读教程或官方指南 --> `documentation-first`
4. 如果开发者请求示例、会修改提供的示例，并通过模式匹配学习 --> `example-driven`

**置信度评分：**

- **HIGH:** 10+ 次学习型交互显示一致偏好，同一偏好出现在 2+ 个项目中
- **MEDIUM:** 5-9 次学习型交互，或仅在 1 个项目内一致
- **LOW:** < 5 次学习型交互，或偏好会随主题熟悉度变化
- **UNSCORED:** 0 条具有学习相关信号的消息

**示例引用：**

- **self-directed:** "I read through the middleware code. The issue is that the token check happens after the rate limiter. Should those be swapped?"
- **guided:** "Can you walk me through how the auth flow works in this codebase? Start from the login request."
- **documentation-first:** "I read the Prisma docs on relations. Can you help me apply the many-to-many pattern from their guide to our schema?"
- **example-driven:** "Show me a working example of a protected API route with JWT validation. I'll adapt it for our endpoints."

**上下文相关模式：**

学习风格往往会随领域熟练度变化。开发者在熟悉领域可能 self-directed，而在新领域更 guided 或 example-driven。若检测到，应报告这种分裂："context-dependent: self-directed for TypeScript/Node, example-driven for Rust/systems programming."

---

## 证据整理

### 证据格式

每条证据都使用以下组合格式：

**信号：** [模式解释 -- 该引用体现了什么] / **示例：** "[裁剪后的引用，约 100 字符]" -- project: [project name]

### 证据目标

- **每个维度 3 条 evidence quotes**（8 个维度共 24 条）
- 选择最能说明评分模式的引用
- 优先选择来自不同项目的引用，以证明跨项目一致性
- 如果相关引用不足 3 条，则纳入现有内容，并注明证据数量

### 引用裁剪

- 将引用裁到行为信号本身，即最能体现模式的片段
- 目标是每条引用约 100 个字符
- 保留有意义的片段，而不是整条消息
- 如果信号位于长消息中间，用 "..." 表示裁剪
- 如果 50 个字符已足以表达信号，就不要附上 500 字符整段消息

### 项目归属

- 每条 evidence quote 都必须包含项目名
- 项目归属便于验证，也能展示跨项目模式
- 格式：`-- project: [name]`

### 敏感内容排除（Layer 1）

profiler agent 绝不能选择包含以下模式的引用：

- `sk-`（API key 前缀）
- `Bearer `（auth token）
- `password`（凭据）
- `secret`（秘密）
- `token`（当它作为凭据值使用，而不是概念讨论时）
- `api_key` 或 `API_KEY`（API key 引用）
- 含用户名的完整绝对文件路径（例如 `/Users/john/...`、`/home/john/...`）

**当发现并排除敏感内容时**，应在分析输出的 metadata 中报告：

```json
{
  "sensitive_excluded": [
    { "type": "api_key_pattern", "count": 2 },
    { "type": "file_path_with_username", "count": 1 }
  ]
}
```

这些 metadata 支持纵深防御式审计。Layer 2（write-profile 步骤中的 regex filter）会再做一次过滤，但 profiler 仍然应避免选择敏感引用。

### 自然语言优先级

以下内容的权重应低于自然语言消息：
- 粘贴的日志输出（可通过时间戳、重复格式串、`[DEBUG]`、`[INFO]`、`[ERROR]` 检测）
- 会话上下文转储（以 "This session is being continued from a previous conversation" 开头的消息）
- 大段代码粘贴（消息中 > 80% 的内容位于代码围栏内）

这些消息类型是真实的，但行为信号较少。选择 evidence quotes 时应降低其优先级。

---

## 近期加权

### 指南

分析模式时，最近 30 天内的会话权重应约为旧会话的 3 倍。

### 原理

开发者风格会演变。一个六个月前很简短的开发者，现在可能会提供详细且结构化的上下文。近期行为更能反映当前工作风格。

### 应用方式

1. 在统计置信度信号时，近期信号按 3 倍计（例如 4 个近期信号 = 12 个加权信号）
2. 选择 evidence quotes 时，如果新旧引用都能体现同一模式，应优先近期引用
3. 当近期与旧会话的模式冲突时，评分应以近期模式为准，但需注明演变："recently shifted from terse-direct to conversational"
4. 30 天窗口相对于分析日期，而不是固定日期

### 边界情况

- 如果**所有**会话都早于 30 天，则不加权（所有会话都同样过时）
- 如果**所有**会话都在最近 30 天内，则不加权（所有会话都同样新）
- 3 倍权重只是指导，不是硬性倍数；当加权结果刚好跨越置信度阈值时，应结合判断

---

## 稀薄数据处理

### 消息阈值

| 真实消息总数 | 模式 | 行为 |
|------------------------|------|----------|
| > 50 | `full` | 对全部 8 个维度做完整分析。questionnaire 可选（用户可选择补充）。 |
| 20-50 | `hybrid` | 分析现有消息。为每个维度给出带置信度的评分。对 LOW/UNSCORED 维度用 questionnaire 补充。 |
| < 20 | `insufficient` | 所有维度都评为 LOW 或 UNSCORED。建议将 questionnaire fallback 作为主要画像来源。备注："insufficient session data for behavioral analysis." |

### 处理数据不足的维度

当某个特定维度数据不足时（即使总消息数超过阈值）：

- 将 confidence 设为 `UNSCORED`
- 将 summary 设为："Insufficient data -- no clear signals detected for this dimension."
- 将 claude_instruction 设为中性回退："No strong preference detected. Ask the developer when this dimension is relevant."
- 将 evidence_quotes 设为空数组 `[]`
- 将 evidence_count 设为 `0`

### Questionnaire 补充

在 `hybrid` 模式下，questionnaire 用于填补那些在会话分析中得到 LOW 或 UNSCORED 的维度空白。基于 questionnaire 的评分采用：
- **MEDIUM** 置信度，用于强烈且明确的选择
- **LOW** 置信度，用于 "it varies" 或模糊选择

如果会话分析与 questionnaire 在某个维度上结论一致，则可以提升置信度（例如 session LOW + questionnaire MEDIUM 且一致 = MEDIUM）。

---

## 输出 Schema

profiler agent 必须返回与该精确 schema 匹配的 JSON，并包裹在 `<analysis>` 标签内。

```json
{
  "profile_version": "1.0",
  "analyzed_at": "ISO-8601 timestamp",
  "data_source": "session_analysis",
  "projects_analyzed": ["project-name-1", "project-name-2"],
  "messages_analyzed": 0,
  "message_threshold": "full|hybrid|insufficient",
  "sensitive_excluded": [
    { "type": "string", "count": 0 }
  ],
  "dimensions": {
    "communication_style": {
      "rating": "terse-direct|conversational|detailed-structured|mixed",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [
        {
          "signal": "Pattern interpretation describing what the quote demonstrates",
          "quote": "Trimmed quote, approximately 100 characters",
          "project": "project-name"
        }
      ],
      "summary": "One to two sentence description of the observed pattern",
      "claude_instruction": "Imperative directive for Claude: 'Match structured communication style' not 'You tend to provide structured context'"
    },
    "decision_speed": {
      "rating": "fast-intuitive|deliberate-informed|research-first|delegator",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "explanation_depth": {
      "rating": "code-only|concise|detailed|educational",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "debugging_approach": {
      "rating": "fix-first|diagnostic|hypothesis-driven|collaborative",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "ux_philosophy": {
      "rating": "function-first|pragmatic|design-conscious|backend-focused",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "vendor_philosophy": {
      "rating": "pragmatic-fast|conservative|thorough-evaluator|opinionated",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "frustration_triggers": {
      "rating": "scope-creep|instruction-adherence|verbosity|regression",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "learning_style": {
      "rating": "self-directed|guided|documentation-first|example-driven",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    }
  }
}
```

### Schema 说明

- **`profile_version`**：该 schema 版本固定为 `"1.0"`
- **`analyzed_at`**：执行分析时的 ISO-8601 时间戳
- **`data_source`**：会话式画像用 `"session_analysis"`，纯 questionnaire 用 `"questionnaire"`，混合模式用 `"hybrid"`
- **`projects_analyzed`**：贡献消息的项目名列表
- **`messages_analyzed`**：处理过的真实用户消息总数
- **`message_threshold`**：触发的阈值模式（`full`、`hybrid`、`insufficient`）
- **`sensitive_excluded`**：被排除的敏感内容类型及数量数组（若无则为空数组）
- **`claude_instruction`**：必须用对 Claude 的祈使句来写。该字段决定画像如何转化为可执行行为。
  - Good: "Provide structured responses with headers and numbered lists to match this developer's communication style."
  - Bad: "You tend to like structured responses."
  - Good: "Ask before making changes beyond the stated request -- this developer values bounded execution."
  - Bad: "The developer gets frustrated when you do extra work."

---

## 跨项目一致性

### 评估

对每个维度，都要评估所观察到的模式是否在已分析项目之间保持一致：

- **`cross_project_consistent: true`** -- 无论分析哪个项目，都会得到同样的评分。来自 2+ 个项目的证据显示相同模式。
- **`cross_project_consistent: false`** -- 模式会随项目变化。应在 summary 中加入上下文相关说明。

### 报告分裂情况

当 `cross_project_consistent` 为 false 时，summary 必须描述这种分裂：

- "Context-dependent: terse-direct for CLI/backend projects (gsd-tools, api-server), detailed-structured for frontend projects (dashboard, landing-page)."
- "Context-dependent: fast-intuitive for familiar tech (React, Node), research-first for new domains (Rust, ML)."

rating 字段应反映**主导**模式（证据最多者）。summary 负责描述细节。

### Phase 3 处理

上下文相关的分裂会在 Phase 3 orchestration 中解决。orchestrator 会向开发者展示这种分裂，并询问哪种模式更能代表其总体偏好。在解决前，Claude 采用主导模式，同时意识到这种上下文相关变化。

---

*Reference document version: 1.0*
*Dimensions: 8*
*Schema: profile_version 1.0*
