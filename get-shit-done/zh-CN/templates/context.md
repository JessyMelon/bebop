# 阶段上下文模板

用于 `.planning/phases/XX-name/{phase_num}-CONTEXT.md` 的模板，用来记录某个阶段的实现决策。

**用途：** 记录下游 agent 需要的决策。Researcher 用它了解要调研什么。Planner 用它判断哪些选择已锁定、哪些仍可灵活处理。

**核心原则：** 分类不是预先定义好的。它们来自这个阶段实际讨论过的内容。CLI 阶段会有 CLI 相关区块，UI 阶段会有 UI 相关区块。

**下游使用方：**
- `gsd-phase-researcher` — 读取决策以聚焦调研（例如，“card layout” → 调研 card component patterns）
- `gsd-planner` — 读取决策以创建具体任务（例如，“infinite scroll” → 任务中包含 virtualization）

---

## 文件模板

```markdown
# Phase [X]: [Name] - 上下文

**收集于：** [date]
**状态：** 准备进入规划

<domain>
## 阶段边界

[清楚说明这个阶段交付什么，也就是范围锚点。它来自 ROADMAP.md，并且是固定的。讨论只是在这个边界内澄清实现方式。]

</domain>

<decisions>
## 实现决策

### [讨论过的领域 1]
- **D-01:** [已做出的具体决策]
- **D-02:** [如适用，另一个决策]

### [讨论过的领域 2]
- **D-03:** [已做出的具体决策]

### [讨论过的领域 3]
- **D-04:** [已做出的具体决策]

### Claude 自主决定
[用户明确说“由你决定”的领域，Claude 在规划/实现时可灵活处理]

</decisions>

<specifics>
## 具体想法

[讨论中提到的任何具体参考、示例，或“我想要像 X 那样”的时刻。产品参考、具体行为、交互模式。]

[如果没有："没有具体要求，可采用标准方案"]

</specifics>

<canonical_refs>
## 规范参考

**下游 agents 在规划或实现前必须先阅读这些内容。**

[列出定义本阶段需求或约束的所有 spec、ADR、feature doc 或 design doc。使用完整相对路径，便于 agent 直接读取。如果阶段涉及多个关注点，可按主题分组。]

### [主题 1]
- `path/to/spec-or-adr.md` — [这个文档做了什么决策/定义了什么与当前阶段相关的内容]
- `path/to/doc.md` §N — [具体章节及其覆盖内容]

### [主题 2]
- `path/to/feature-doc.md` — [这个文档定义了什么能力]

[如果项目没有外部规格："没有外部规格，需求已在上面的决策中完整记录"]

</canonical_refs>

<code_context>
## 现有代码洞察

### 可复用资产
- [Component/hook/utility]: [它在这个阶段可以如何复用]

### 已建立模式
- [Pattern]: [它如何约束或支持这个阶段]

### 集成点
- [新代码与现有系统连接的位置]

</code_context>

<deferred>
## 延后想法

[讨论中出现但属于其他阶段的想法。记录在这里以免丢失，但要明确不属于本阶段范围。]

[如果没有："无，讨论始终在本阶段范围内"]

</deferred>

---

*Phase: XX-name*
*上下文收集于：[date]*
```

<good_examples>

**示例 1：视觉功能（Post Feed）**

```markdown
# Phase 3: Post Feed - 上下文

**收集于：** 2025-01-20
**状态：** 准备进入规划

<domain>
## 阶段边界

显示已关注用户发布的帖子，采用可滚动的信息流。用户可以查看帖子并看到互动计数。发帖和互动属于其他阶段。

</domain>

<decisions>
## 实现决策

### Layout style
- 卡片式布局，不用时间线或列表
- 每张卡片显示：作者头像、姓名、时间戳、完整帖子内容、反应计数
- 卡片带有轻微阴影和圆角，整体感觉现代

### Loading behavior
- 使用无限滚动，不分页
- 移动端支持下拉刷新
- 顶部显示新帖提示（“3 new posts”），而不是自动插入

### Empty state
- 友好的插图 + “Follow people to see posts here”
- 根据兴趣推荐 3-5 个可关注账号

### Claude 自主决定
- Loading skeleton 设计
- 精确的间距和排版
- 错误状态处理

</decisions>

<canonical_refs>
## 规范参考

### Feed display
- `docs/features/social-feed.md` — 信息流需求、帖子卡片字段、互动展示规则
- `docs/decisions/adr-012-infinite-scroll.md` — 滚动策略决策、virtualization 要求

### Empty states
- `docs/design/empty-states.md` — 空状态模式、插图规范

</canonical_refs>

<specifics>
## 具体想法

- “我喜欢 Twitter 那种不打断滚动位置的新帖提示方式”
- 卡片应有点像 Linear 的 issue cards，干净，不要拥挤

</specifics>

<deferred>
## 延后想法

- 帖子评论 — 第 5 阶段
- 帖子收藏 — 加入 backlog

</deferred>

---

*Phase: 03-post-feed*
*上下文收集于：2025-01-20*
```

**示例 2：CLI 工具（Database backup）**

```markdown
# Phase 2: Backup Command - 上下文

**收集于：** 2025-01-20
**状态：** 准备进入规划

<domain>
## 阶段边界

CLI 命令将数据库备份到本地文件或 S3。支持完整备份和增量备份。恢复命令属于另一个阶段。

</domain>

<decisions>
## 实现决策

### Output format
- 程序化使用时输出 JSON，面向人类时输出表格格式
- 默认使用表格，`--json` 标志切换为 JSON
- 详细模式（`-v`）显示进度，默认静默

### Flag design
- 常用选项使用短标志：`-o`（output）、`-v`（verbose）、`-f`（force）
- 为了清晰提供长标志：`--incremental`、`--compress`、`--encrypt`
- 必需项：数据库连接字符串（位置参数或 `--db`）

### Error recovery
- 网络失败时重试 3 次，然后以清晰信息失败
- `--no-retry` 标志用于快速失败
- 失败时删除部分备份（不保留损坏文件）

### Claude 自主决定
- 精确的进度条实现
- 压缩算法选择
- 临时文件处理

</decisions>

<canonical_refs>
## 规范参考

### Backup CLI
- `docs/features/backup-restore.md` — 备份需求、支持的后端、加密规范
- `docs/decisions/adr-007-cli-conventions.md` — 标志命名、退出码、输出格式标准

</canonical_refs>

<specifics>
## 具体想法

- “我希望它像 pg_dump 一样，用起来让数据库从业者觉得熟悉”
- 应能在 CI 流水线中运行（退出码、无交互提示）

</specifics>

<deferred>
## 延后想法

- 定时备份 — 单独阶段
- 备份轮换/保留策略 — 加入 backlog

</deferred>

---

*Phase: 02-backup-command*
*上下文收集于：2025-01-20*
```

**示例 3：整理任务（Photo library）**

```markdown
# Phase 1: Photo Organization - 上下文

**收集于：** 2025-01-20
**状态：** 准备进入规划

<domain>
## 阶段边界

将现有照片库整理到结构化文件夹中。处理重复项并统一命名。打标签和搜索属于其他阶段。

</domain>

<decisions>
## 实现决策

### Grouping criteria
- 先按年份分组，再按月份分组
- 通过时间聚类检测事件（2 小时内的照片 = 同一事件）
- 如有位置信息，事件文件夹按日期 + 地点命名

### Duplicate handling
- 保留分辨率最高的版本
- 将重复项移动到 `_duplicates` 文件夹（不删除）
- 记录所有重复判定，便于复查

### Naming convention
- 格式：`YYYY-MM-DD_HH-MM-SS_originalname.ext`
- 保留原始文件名作为后缀，方便搜索
- 通过递增后缀处理重名冲突

### Claude 自主决定
- 具体聚类算法
- 如何处理没有 EXIF 数据的照片
- 是否使用文件夹 emoji

</decisions>

<canonical_refs>
## 规范参考

### Organization rules
- `docs/features/photo-organization.md` — 分组规则、重复项策略、命名规范
- `docs/decisions/adr-003-exif-handling.md` — EXIF 提取策略、缺失元数据时的回退方案

</canonical_refs>

<specifics>
## 具体想法

- “我希望能按大致拍摄时间找到照片”
- 不要删除任何东西，最坏情况也只是移到待复查文件夹

</specifics>

<deferred>
## 延后想法

- 人脸识别分组 — 后续阶段
- 云同步 — 当前超出范围

</deferred>

---

*Phase: 01-photo-organization*
*上下文收集于：2025-01-20*
```

</good_examples>

<guidelines>
**这个模板记录的是供下游 agent 使用的决策。**

输出应回答：“researcher 需要调研什么？planner 有哪些选择已经锁定？”

**好的内容（具体决策）：**
- “Card-based layout, not timeline”
- “Retry 3 times on network failure, then fail”
- “Group by year, then by month”
- “JSON for programmatic use, table for humans”

**不好的内容（过于模糊）：**
- “Should feel modern and clean”
- “Good user experience”
- “Fast and responsive”
- “Easy to use”

**创建后：**
- 文件位于阶段目录：`.planning/phases/XX-name/{phase_num}-CONTEXT.md`
- `gsd-phase-researcher` 使用决策来聚焦调研，并读取 canonical_refs 了解要研究哪些文档
- `gsd-planner` 使用决策 + research 创建可执行任务，并读取 canonical_refs 以验证对齐
- 下游 agent 不应再就已记录的决策向用户重复提问

**关键要求：Canonical references：**
- `<canonical_refs>` 区块是强制项。每个 CONTEXT.md 都必须有。
- 如果项目有外部 specs、ADRs 或 design docs，请按主题分组列出完整相对路径
- 如果 ROADMAP.md 按阶段列出了 `Canonical refs:`，应提取并展开
- 决策里零散写着“see ADR-019”对下游 agent 没用，它们需要在一个专门区块里看到完整路径和章节引用
- 如果没有外部 specs，要明确写出来，不要悄悄省略该区块
</guidelines>
