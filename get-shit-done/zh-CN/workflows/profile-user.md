<purpose>
编排完整的开发者画像流程：同意授权、会话分析（或问卷回退）、画像生成、结果展示，以及产物创建。

此工作流将 Phase 1（session pipeline）和 Phase 2（profiling engine）串联成一个连贯、面向用户的体验。所有核心处理都由现有的 `gsd-sdk query` handlers 完成（必要时保持与旧版 `gsd-tools.cjs` 一致），以及 `gsd-user-profiler` agent 负责分析；本工作流负责协调顺序、处理分支，并提供 UX。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。

关键参考：
- @$HOME/.claude/get-shit-done/references/ui-brand.md (展示模式)
- @$HOME/.claude/agents/gsd-user-profiler.md (profiler agent 定义)
- @$HOME/.claude/get-shit-done/references/user-profiling.md (画像参考文档)
</required_reading>

<process>

## 1. 初始化

从 $ARGUMENTS 解析 flags：
- 检测 `--questionnaire` flag（跳过会话分析，仅使用问卷）
- 检测 `--refresh` flag（即使已有画像也重新构建）

检查是否存在现有画像：

```bash
PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
[ -f "$PROFILE_PATH" ] && echo "EXISTS" || echo "NOT_FOUND"
```

**如果画像已存在，且未设置 --refresh，也未设置 --questionnaire：**


**文本模式（配置中 `workflow.text_mode: true` 或使用 `--text` flag）：** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 启用时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。对于不支持 `AskUserQuestion` 的非 Claude 运行时（OpenAI Codex、Gemini CLI 等），这是必需的。
使用 AskUserQuestion：
- header: "Existing Profile"
- question: "You already have a profile. What would you like to do?"
- options:
  - "View it" -- 显示现有画像数据的摘要卡片，然后退出
  - "Refresh it" -- 继续执行 --refresh 行为
  - "Cancel" -- 退出工作流

如果选择 "View it"：读取 USER-PROFILE.md，将其内容格式化为摘要卡片并展示，然后退出。
如果选择 "Refresh it"：设置 --refresh 行为并继续。
如果选择 "Cancel"：显示 "No changes made." 并退出。

**如果画像已存在，且设置了 --refresh：**

备份现有画像：
```bash
cp "$HOME/.claude/get-shit-done/USER-PROFILE.md" "$HOME/.claude/USER-PROFILE.backup.md"
```

显示："Re-analyzing your sessions to update your profile."
继续到步骤 2。

**如果不存在画像：** 继续到步骤 2。

---

## 2. 同意授权门槛 (ACTV-06)

**如果** 设置了 `--questionnaire` flag，则跳过（不会读取 JSONL，直接跳到步骤 4b）。

显示同意界面：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > PROFILE YOUR CODING STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude 默认在每次对话开始时都是通用状态。画像会让 Claude 学会
你真实的工作方式，而不是你以为自己的工作方式。

## 我们将分析什么

你的近期 Claude Code 会话，查找以下
8 个行为维度中的模式：

| 维度                 | 衡量内容                                   |
|----------------------|--------------------------------------------|
| Communication Style  | 你如何表达请求（简洁 vs. 详细）             |
| Decision Speed       | 你如何在选项之间做选择                      |
| Explanation Depth    | 你希望代码附带多少解释                      |
| Debugging Approach   | 你如何处理错误和 bug                        |
| UX Philosophy        | 你对设计与功能的重视程度                    |
| Vendor Philosophy    | 你如何评估库和工具                          |
| Frustration Triggers | 什么情况会让你纠正 Claude                   |
| Learning Style       | 你偏好如何学习新东西                        |

## 数据处理

✓ 在本地读取 session files（只读，不修改任何内容）
✓ 分析消息模式（不是内容含义）
✓ 将画像存储到 $HOME/.claude/get-shit-done/USER-PROFILE.md
✗ 不会发送到外部服务
✗ 敏感内容（API keys、passwords）会被自动排除
```

**如果是 --refresh 路径：**
改为显示简化版同意说明：

```
Re-analyzing your sessions to update your profile.
Your existing profile has been backed up to USER-PROFILE.backup.md.
```

使用 AskUserQuestion：
- header: "Refresh"
- question: "Continue with profile refresh?"
- options:
  - "Continue" -- 继续到步骤 3
  - "Cancel" -- 退出工作流

**如果是默认路径（未使用 --refresh）：**

使用 AskUserQuestion：
- header: "Ready?"
- question: "Ready to analyze your sessions?"
- options:
  - "Let's go" -- 继续到步骤 3（会话分析）
  - "Use questionnaire instead" -- 跳到步骤 4b（问卷路径）
  - "Not now" -- 显示 "No worries. Run /gsd-profile-user when ready." 并退出

---

## 3. 会话扫描

显示："◆ Scanning sessions..."

运行会话扫描：
```bash
SCAN_RESULT=$(gsd-sdk query scan-sessions --json 2>/dev/null)
```

解析 JSON 输出，获取 session 数量和 project 数量。

显示："✓ Found N sessions across M projects"

**判断数据是否充足：**
- 统计扫描结果中的总消息数（汇总所有项目中的 sessions）
- 如果找到 0 个 sessions：显示 "No sessions found. Switching to questionnaire." 并跳到步骤 4b
- 如果找到 sessions：继续到步骤 4a

---

## 4a. 会话分析路径

显示："◆ Sampling messages..."

运行画像采样：
```bash
SAMPLE_RESULT=$(gsd-sdk query profile-sample --json 2>/dev/null)
```

解析 JSON 输出，获取临时目录路径和消息数量。

显示："✓ Sampled N messages from M projects"

显示："◆ Analyzing patterns..."

**使用 Task tool 启动 gsd-user-profiler agent：**

使用 Task tool 启动 `gsd-user-profiler` agent。向它提供：
- `profile-sample` 输出中的采样 JSONL 文件路径
- 位于 `$HOME/.claude/get-shit-done/references/user-profiling.md` 的用户画像参考文档

agent prompt 应遵循以下结构：
```
Read the profiling reference document and the sampled session messages, then analyze the developer's behavioral patterns across all 8 dimensions.

Reference: @$HOME/.claude/get-shit-done/references/user-profiling.md
Session data: @{temp_dir}/profile-sample.jsonl

Analyze these messages and return your analysis in the <analysis> JSON format specified in the reference document.
```

**解析 agent 输出：**
- 从 agent 响应中提取 `<analysis>` JSON block
- 将 analysis JSON 保存到临时文件（与 `profile-sample` 创建的临时目录相同）

```bash
ANALYSIS_PATH="{temp_dir}/analysis.json"
```

将 analysis JSON 写入 `$ANALYSIS_PATH`。

显示："✓ Analysis complete (N dimensions scored)"

**检查数据是否偏薄：**
- 读取 analysis JSON 并检查总消息数
- 如果分析的消息数 < 50：提示问卷补充可以提高准确性。显示："Note: Limited session data (N messages). Results may have lower confidence."

继续到步骤 5。

---

## 4b. 问卷路径

显示："Using questionnaire to build your profile."

**获取问题：**
```bash
QUESTIONS=$(gsd-sdk query profile-questionnaire --json 2>/dev/null)
```

解析问题 JSON。它包含 8 个问题，每个维度一个。

**通过 AskUserQuestion 向用户展示每个问题：**

对于 questions 数组中的每个问题：
- header: 维度名称（例如 "Communication Style"）
- question: 问题文本
- options: 问题定义中的答案选项

收集所有答案，组成一个 answers JSON object，将维度 key 映射到所选答案值。

**将答案保存到临时文件：**
```bash
ANSWERS_PATH=$(mktemp /tmp/gsd-profile-answers-XXXXXX.json)
```

将 answers JSON 写入 `$ANSWERS_PATH`。

**将答案转换为 analysis：**
```bash
ANALYSIS_RESULT=$(gsd-sdk query profile-questionnaire --answers "$ANSWERS_PATH" --json 2>/dev/null)
```

从结果中解析 analysis JSON。

将 analysis JSON 保存到临时文件：
```bash
ANALYSIS_PATH=$(mktemp /tmp/gsd-profile-analysis-XXXXXX.json)
```

将 analysis JSON 写入 `$ANALYSIS_PATH`。

继续到步骤 5（跳过 split resolution，因为问卷会在内部处理歧义）。

---

## 5. 分歧解析

**如果** 是仅问卷路径，则跳过（splits 已在内部处理）。

从 `$ANALYSIS_PATH` 读取 analysis JSON。

检查每个维度的 `cross_project_consistent: false`。

**对于检测到的每个 split：**

使用 AskUserQuestion：
- header: 维度名称（例如 "Communication Style"）
- question: "Your sessions show different patterns:"，后接 split 上下文（例如 "CLI/backend projects -> terse-direct, Frontend/UI projects -> detailed-structured"）
- options:
  - 评分选项 A（例如 "terse-direct"）
  - 评分选项 B（例如 "detailed-structured"）
  - "Context-dependent (keep both)"

**如果用户选择了具体评分：** 将 analysis JSON 中该维度的 `rating` 字段更新为所选值。

**如果用户选择 "Context-dependent"：** 在 `rating` 字段中保留主导评分。向该维度的 summary 添加 `context_note`，描述该 split（例如 "Context-dependent: terse in CLI projects, detailed in frontend projects"）。

将更新后的 analysis JSON 回写到 `$ANALYSIS_PATH`。

---

## 6. 写入画像

显示："◆ Writing profile..."

```bash
gsd-sdk query write-profile --input "$ANALYSIS_PATH" --json 2>/dev/null
```

显示："✓ Profile written to $HOME/.claude/get-shit-done/USER-PROFILE.md"

---

## 7. 结果展示

从 `$ANALYSIS_PATH` 读取 analysis JSON 以构建展示内容。

**显示评分表：**

```
## Your Profile

| Dimension            | Rating               | Confidence |
|----------------------|----------------------|------------|
| Communication Style  | detailed-structured  | HIGH       |
| Decision Speed       | deliberate-informed  | MEDIUM     |
| Explanation Depth    | concise              | HIGH       |
| Debugging Approach   | hypothesis-driven    | MEDIUM     |
| UX Philosophy        | pragmatic            | LOW        |
| Vendor Philosophy    | thorough-evaluator   | HIGH       |
| Frustration Triggers | scope-creep          | MEDIUM     |
| Learning Style       | self-directed        | HIGH       |
```

（使用 analysis JSON 中的实际值填充。）

**显示亮点摘要：**

选择置信度最高且证据信号最强的 3-4 个维度。格式如下：

```
## Highlights

- **Communication (HIGH):** 你通常会先提供结构化背景，
  包括标题和问题说明，然后再提出请求
- **Vendor Choices (HIGH):** 你会充分研究备选方案，
  在做决定前比较 docs、GitHub activity 和 bundle sizes
- **Frustrations (MEDIUM):** 你最常纠正 Claude 的情况，是它做了
  你没有要求的事，scope creep 是你的主要触发点
```

根据 analysis JSON 中的 `evidence` 数组和 `summary` 字段构建亮点。使用最有说服力的证据引文。每条格式为 "You tend to..." 或 "You consistently..."，并附上证据归因。

**提供完整画像查看选项：**

使用 AskUserQuestion：
- header: "Profile"
- question: "Want to see the full profile?"
- options:
  - "Yes" -- 读取并显示完整的 USER-PROFILE.md 内容，然后继续到步骤 8
  - "Continue to artifacts" -- 直接继续到步骤 8

---

## 8. 产物选择 (ACTV-05)

使用带 multiSelect 的 AskUserQuestion：
- header: "Artifacts"
- question: "Which artifacts should I generate?"
- options（默认全部预选）：
  - "/gsd-dev-preferences command file" -- "Load your preferences in any session"
  - "CLAUDE.md profile section" -- "Add profile to this project's CLAUDE.md"
  - "Global CLAUDE.md" -- "Add profile to $HOME/.claude/CLAUDE.md for all projects"

**如果未选择任何产物：** 显示 "No artifacts generated. Your profile is saved at $HOME/.claude/get-shit-done/USER-PROFILE.md" 并跳到步骤 10。

---

## 9. 产物生成

按顺序生成所选产物（文件 I/O 很快，使用并行 agents 没有收益）：

**对于 /gsd-dev-preferences（如果已选择）：**

```bash
gsd-sdk query generate-dev-preferences --analysis "$ANALYSIS_PATH" --json 2>/dev/null
```

显示："✓ Generated /gsd-dev-preferences at $HOME/.claude/commands/gsd/dev-preferences.md"

**对于 CLAUDE.md profile section（如果已选择）：**

```bash
gsd-sdk query generate-claude-profile --analysis "$ANALYSIS_PATH" --json 2>/dev/null
```

显示："✓ Added profile section to CLAUDE.md"

**对于 Global CLAUDE.md（如果已选择）：**

```bash
gsd-sdk query generate-claude-profile --analysis "$ANALYSIS_PATH" --global --json 2>/dev/null
```

显示："✓ Added profile section to $HOME/.claude/CLAUDE.md"

**错误处理：** 如果任意 `gsd-sdk query` 或 `gsd-tools.cjs` 调用失败，显示错误信息，并使用 AskUserQuestion 提供 "Retry" 或 "Skip this artifact"。如果重试，则重新运行命令；如果跳过，则继续下一个产物。

---

## 10. 摘要与刷新差异

**如果是 --refresh 路径：**

读取旧备份和新 analysis，比较各维度的 rating/confidence。

读取已备份的画像：
```bash
BACKUP_PATH="$HOME/.claude/USER-PROFILE.backup.md"
```

比较新旧之间每个维度的 rating 和 confidence。显示仅包含变化维度的 diff 表：

```
## Changes

| Dimension       | Before                      | After                        |
|-----------------|-----------------------------|-----------------------------|
| Communication   | terse-direct (LOW)          | detailed-structured (HIGH)  |
| Debugging       | fix-first (MEDIUM)          | hypothesis-driven (MEDIUM)  |
```

如果没有变化：显示 "No changes detected -- your profile is already up to date."

**显示最终摘要：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > PROFILE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your profile:    $HOME/.claude/get-shit-done/USER-PROFILE.md
```

然后列出每个已生成产物的路径：
```
Artifacts:
  ✓ /gsd-dev-preferences   $HOME/.claude/commands/gsd/dev-preferences.md
  ✓ CLAUDE.md section       ./CLAUDE.md
  ✓ Global CLAUDE.md        $HOME/.claude/CLAUDE.md
```

（只显示实际生成的产物。）

**清理临时文件：**

删除 `profile-sample` 创建的临时目录（包含 sample JSONL 和 analysis JSON）：
```bash
rm -rf "$TEMP_DIR"
```

同时删除为问卷答案创建的独立临时文件：
```bash
rm -f "$ANSWERS_PATH" 2>/dev/null
rm -f "$ANALYSIS_PATH" 2>/dev/null
```

（只清理本次工作流运行期间实际创建的临时路径。）

</process>

<success_criteria>
- [ ] 初始化能检测现有画像，并处理全部三种响应（view/refresh/cancel）
- [ ] 会话分析路径显示同意授权门槛，问卷路径跳过
- [ ] 会话扫描能发现 sessions 并报告统计信息
- [ ] 会话分析路径：采样消息、启动 profiler agent、提取 analysis JSON
- [ ] 问卷路径：展示 8 个问题、收集答案、转换为 analysis JSON
- [ ] Split resolution 能展示上下文相关的分歧，并提供用户处理选项
- [ ] 通过 `write-profile` subcommand 将画像写入 USER-PROFILE.md
- [ ] 结果展示包含评分表和带证据的亮点摘要
- [ ] 产物选择使用 multiSelect，且所有选项默认预选
- [ ] 产物通过 `gsd-sdk query`（或 `gsd-tools.cjs`）subcommands 按顺序生成
- [ ] 使用 --refresh 时，刷新 diff 会显示发生变化的维度
- [ ] 完成后清理临时文件
</success_criteria>
