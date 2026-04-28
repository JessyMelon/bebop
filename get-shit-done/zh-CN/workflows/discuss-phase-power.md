<purpose>
discuss-phase 的 Power user mode。会一次性把所有问题生成为 JSON state file 和配套 HTML UI，然后等待用户按自己的节奏作答。等用户表示准备好后，再一次性处理所有答案并生成 CONTEXT.md。

**适用场景：** phase 较大、灰区较多，或用户更愿意离线 / 异步回答问题，而不是在聊天中交互式逐个回答。
</purpose>

<trigger>
当 `/gsd-discuss-phase` 的 ARGUMENTS 中带有 `--power` flag 时，执行此 workflow。

调用方（discuss-phase.md）已经：
- 校验该 phase 存在
- 提供 init context：`phase_dir`, `padded_phase`, `phase_number`, `phase_name`, `phase_slug`

立即从 **Step 1** 开始。
</trigger>

<step name="analyze">
执行与标准 discuss-phase mode 相同的灰区识别。

1. 加载 prior context（PROJECT.md、REQUIREMENTS.md、STATE.md、之前的 CONTEXT.md 文件）
2. 扫描代码库，找出与此 phase 相关的可复用资产和模式
3. 从 ROADMAP.md 读取 phase goal
4. 识别**所有**灰区 —— 用户应该参与权衡的具体实现决策
5. 对每个灰区，生成 2-4 个带取舍说明的具体选项

按主题将问题分组到不同 section（例如："Visual Style"、"Data Model"、"Interactions"、"Error Handling"）。每个 section 应包含 2-6 个问题。

此阶段不要向用户提任何问题。先在内部收集完整内容，然后继续生成文件。
</step>

<step name="generate_json">
将所有问题写入：

```
{phase_dir}/{padded_phase}-QUESTIONS.json
```

**JSON 结构：**

```json
{
  "phase": "{padded_phase}-{phase_slug}",
  "generated_at": "ISO-8601 timestamp",
  "stats": {
    "total": 0,
    "answered": 0,
    "chat_more": 0,
    "remaining": 0
  },
  "sections": [
    {
      "id": "section-slug",
      "title": "Section Title",
      "questions": [
        {
          "id": "Q-01",
          "title": "Short question title",
          "context": "Codebase info, prior decisions, or constraints relevant to this question",
          "options": [
            {
              "id": "a",
              "label": "Option label",
              "description": "Tradeoff or elaboration for this option"
            },
            {
              "id": "b",
              "label": "Another option",
              "description": "Tradeoff or elaboration"
            },
            {
              "id": "c",
              "label": "Custom",
              "description": ""
            }
          ],
          "answer": null,
          "chat_more": "",
          "status": "unanswered"
        }
      ]
    }
  ]
}
```

**字段规则：**
- `stats.total`: 所有 section 中问题总数
- `stats.answered`: `answer` 不为 null 且不是空字符串的问题数量
- `stats.chat_more`: `chat_more` 有内容的问题数量
- `stats.remaining`: `total - answered`
- `question.id`: 跨所有 section 顺序编号 —— Q-01、Q-02、Q-03、...
- `question.context`: 具体的代码库或 prior-decision 注释（不能泛泛而谈）
- `question.answer`: 用户填写前为 null；填写后为所选 option id 或自由文本
- `question.status`: "unanswered" | "answered" | "chat-more"（有 chat_more 但尚未选择 answer）
</step>

<step name="generate_html">
将一个自包含 HTML 配套文件写入：

```
{phase_dir}/{padded_phase}-QUESTIONS.html
```

该文件必须是单个自包含 HTML 文件，内联 CSS 和 JavaScript。不得依赖外部资源。

**布局：**

```
┌─────────────────────────────────────────────────────┐
│  Phase {N}: {phase_name} — Discussion Questions      │
│  ┌──────────────────────────────────────────────┐   │
│  │  12 total  |  3 answered  |  9 remaining     │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ▼ Visual Style (3 questions)                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│   │ Q-01     │ │ Q-02     │ │ Q-03     │            │
│   │ Layout   │ │ Density  │ │ Colors   │            │
│   │ ...      │ │ ...      │ │ ...      │            │
│   └──────────┘ └──────────┘ └──────────┘            │
│  ▼ Data Model (2 questions)                          │
│   ...                                                │
└─────────────────────────────────────────────────────┘
```

**Stats bar：**
- 总问题数、已回答数、剩余数
- 一个简单的 CSS progress bar（绿色填充 = answered / total）

**Section headers：**
- 点击可折叠展开/收起 section 中的问题
- 显示该 section 的已回答数量（例如："2/4 answered"）

**Question cards（3 列网格）：**
每张卡片包含：
- 问题 ID 徽章（例如："Q-01"）和标题
- 上下文注释（灰色斜体文本）
- 选项列表：radio buttons，带加粗 label 和 description 文本
- Chat more textarea（有内容时显示橙色边框）
- 回答后卡片高亮为绿色

**JavaScript 行为：**
- 选择 radio button 时：在页面状态中将问题标记为 answered；更新 stats bar
- textarea 输入时：更新页面状态中的 chat_more 内容；如有内容则显示橙色边框
- 顶部和底部的 "Save answers" 按钮：将页面状态序列化回 JSON file path

**保存机制：**
Save 按钮会优先使用 File System Access API 将更新后的 JSON 写回原路径；如果不可用，则生成一个可下载的 JSON 文件，由用户手动覆盖原文件。UI 中应包含清晰说明：

```
After answering, click "Save answers" — or download the JSON and replace the original file.
Then return to Claude and say "refresh" to process your answers.
```

**已回答问题样式：**
- Card border: `2px solid #22c55e`（绿色）
- Card background: `#f0fdf4`（浅绿色背景）

**未回答问题样式：**
- Card border: `1px solid #e2e8f0`（灰色）
- Card background: `white`

**Chat more textarea：**
- Placeholder: "Add context, nuance, or clarification for this question..."
- 正常边框: `1px solid #e2e8f0`
- 激活态（有内容）边框: `2px solid #f97316`（橙色）
</step>

<step name="notify_user">
写完两个文件后，向用户输出这段消息：

```
Questions ready for Phase {N}: {phase_name}

  HTML (open in browser/IDE):   {phase_dir}/{padded_phase}-QUESTIONS.html
  JSON (state file):            {phase_dir}/{padded_phase}-QUESTIONS.json

  {total} questions across {section_count} topics.

Open the HTML file, answer the questions at your own pace, then save.

When ready, tell me:
  "refresh"   — process your answers and update the file
  "finalize"  — generate CONTEXT.md from all answered questions
  "explain Q-05"   — elaborate on a specific question
  "exit power mode" — return to standard one-by-one discussion (answers carry over)
```
</step>

<step name="wait_loop">
进入等待模式。Claude 监听用户命令，并按如下方式处理：

---

**"refresh"**（或 "process answers"、"update"、"re-read"）：

1. 读取 `{phase_dir}/{padded_phase}-QUESTIONS.json`
2. 重新计算 stats：统计 answered、chat_more、remaining
3. 将更新后的 stats 写回 JSON
4. 重新生成带更新状态的 HTML 文件（已回答卡片高亮为绿色，progress bar 更新）
5. 向用户报告：

```
Refreshed. Updated state:
  Answered:  {answered} / {total}
  Remaining: {remaining}
  Chat-more: {chat_more}

  {phase_dir}/{padded_phase}-QUESTIONS.html updated.

Answer more questions, then say "refresh" again, or say "finalize" when done.
```

---

**"finalize"**（或 "done"、"generate context"、"write context"）：

继续到 **finalize** step。

---

**"explain Q-{N}"**（或 "more info on Q-{N}"、"elaborate Q-{N}"）：

1. 在 JSON 中按 ID 找到该问题
2. 提供详细解释：为什么这个决策重要，它如何影响下游计划，以及代码库中还有哪些相关上下文
3. 返回等待模式

---

**"exit power mode"**（或 "switch to interactive"）：

1. 从 JSON 中读取当前所有已回答的问题
2. 将这些答案加载到内部累加器中，就像它们是交互式回答的一样
3. 对所有未回答问题，继续执行 discuss-phase.md 中标准的 `discuss_areas` step
4. 按正常流程生成 CONTEXT.md

---

**任何其他消息：**
友好回复，然后提醒用户可用命令：
```
(Power mode active — say "refresh", "finalize", "explain Q-N", or "exit power mode")
```
</step>

<step name="finalize">
处理 JSON 文件中的所有已回答问题，并生成 CONTEXT.md。

1. 读取 `{phase_dir}/{padded_phase}-QUESTIONS.json`
2. 过滤出 `answer` 不为 null/空的问题
3. 按 section 对决策分组
4. 对每个已回答问题，将其格式化为一个 decision 条目：
   - Decision: 所选 option label（或自由填写的自定义文本）
   - Rationale: option description，如有 `chat_more` 则一并附上
   - Status: 若完整回答则为 "Decided"；若只有 chat_more 但未选 option，则为 "Needs clarification"

5. 使用标准 context template format 写入 CONTEXT.md：
   - `<decisions>` section：按 section 分组写入所有已回答问题
   - `<deferred_ideas>` section：写入未回答问题（保留供后续讨论）
   - `<specifics>` section：写入任何增加细节的 chat_more 内容
   - `<code_context>` section：写入分析阶段发现的可复用资产
   - `<canonical_refs>` section（强制要求 —— 相关 specs/docs 的路径）

6. 如果回答的问题少于 50%，提醒用户：
```
Warning: Only {answered}/{total} questions answered ({pct}%).
CONTEXT.md generated with available decisions. Unanswered questions listed as deferred.
Consider running /gsd-discuss-phase {N} again to refine before planning.
```

7. 输出完成消息：
```
CONTEXT.md written: {phase_dir}/{padded_phase}-CONTEXT.md

  Decisions captured: {answered}
  Deferred:          {remaining}

Next step: /gsd-plan-phase {N}
```
</step>

<success_criteria>
- 已将所有识别出的灰区问题生成为结构良好的 JSON
- HTML 配套文件为自包含形式，无需 server 即可使用
- 每次 refresh 后，Stats bar 都准确反映 answered/remaining 数量
- 已回答问题在 HTML 中以绿色高亮
- 生成的 CONTEXT.md 与标准 discuss-phase 输出格式一致
- 未回答问题会作为 deferred items 保留（不会悄悄丢掉）
- CONTEXT.md 中始终包含 `canonical_refs` section（强制要求）
- 用户清楚如何 refresh、finalize、explain 或退出 power mode
</success_criteria>
