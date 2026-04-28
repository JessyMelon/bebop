# graduation.md — LEARNINGS.md 跨阶段提升助手

**由以下流程调用：** `transition.md` 的 `graduation_scan` 步骤。用户绝不会直接调用。

此工作流会对最近 N 个阶段的 LEARNINGS.md 文件中的重复项进行聚类，并通过 HITL 向开发者展示可提升候选项。未经开发者明确批准，任何条目都不会被提升。

---

## Configuration

从项目配置（`config.json`）中读取：

| Key | Default | Description |
|-----|---------|-------------|
| `features.graduation` | `true` | 总开关。为 `false` 时静默跳过。 |
| `features.graduation_window` | `5` | 向前扫描多少个已完成阶段 |
| `features.graduation_threshold` | `3` | 需要展示的最小聚类大小 |

---

## Step 1: Guard Checks

```bash
GRADUATION_ENABLED=$(gsd-sdk query config-get features.graduation 2>/dev/null || echo "true")
GRADUATION_WINDOW=$(gsd-sdk query config-get features.graduation_window 2>/dev/null || echo "5")
GRADUATION_THRESHOLD=$(gsd-sdk query config-get features.graduation_threshold 2>/dev/null || echo "3")
```

**在以下情况下静默跳过（不输出任何内容）：**
- `features.graduation` 为 `false`
- 已完成的前置阶段少于 `graduation_threshold` 个（数据不足）

**如果窗口内所有 LEARNINGS.md 文件中的条目总数少于 5，也静默跳过（不输出任何内容）。**

---

## Step 2: Collect LEARNINGS.md Files

找到最近 N 个已完成阶段（不包括当前正在完成的阶段）中的 LEARNINGS.md 文件：

```bash
find .planning/phases -name "*-LEARNINGS.md" | sort | tail -n "$GRADUATION_WINDOW"
```

对于找到的每个文件：
1. 解析四个分类部分：`## Decisions`、`## Lessons`、`## Patterns`、`## Surprises`
2. 将每个 `### Item Title` 及其正文提取为单个条目记录：`{ category, title, body, source_phase, source_file }`
3. **跳过已包含 `**Graduated:**` 的条目** —— 它们已经被提升，不应再次出现

---

## Step 3: Cluster by Lexical Similarity

对每个 category 独立处理，使用 title+body 分词后的 Jaccard 相似度进行聚类：

**分词规则：** 全部转小写、去除标点、按空白分割、去掉停用词（a, an, the, is, was, in, on, at, to, for, of, and, or, but, with, from, that, this, by, as）。

**Jaccard similarity：** `|A ∩ B| / |A ∪ B|`，其中 A 和 B 是 token 集合。若两条目相似度 ≥ 0.25，则归入同一聚类。

**聚类算法：** 单次遍历贪心法 —— 按阶段顺序处理条目；将条目加入第一个其 centroid（该聚类所有 token 的并集）与新条目的相似度 ≥ 0.25 的聚类；否则新建聚类。

**聚类大小过滤：** 仅展示 distinct source phases ≥ `graduation_threshold` 的聚类（不只是总条目数 —— 同一阶段中重复出现的同一项仍只算 1 个 distinct phase）。

---

## Step 4: Check graduation_backlog in STATE.md

读取 `.planning/STATE.md` 中的 `graduation_backlog` 部分（如果存在）。格式：

```yaml
graduation_backlog:
  - cluster_id: "{sha256-of-cluster-title}"
    status: "dismissed"   # or "deferred"
    deferred_until: "phase-N"  # only for deferred entries
    cluster_title: "{representative title}"
```

**跳过任何 `cluster_id` 与 `dismissed` 条目匹配的聚类。**

**跳过任何 `cluster_id` 与 `deferred` 条目匹配且其 `deferred_until` 对应阶段尚未完成的聚类。**

---

## Step 5: Surface Promotion Candidates

对每个符合条件的聚类，确定建议目标文件：

| Category | Suggested Target |
|----------|-----------------|
| `decisions` | `PROJECT.md` — 追加到 `## Validated Decisions` 下（如无则创建该 section） |
| `patterns` | `PATTERNS.md` — 追加到合适的分类 section 下（如无则创建文件） |
| `lessons` | `PROJECT.md` — 追加到 `## Invariants` 下（如无则创建该 section） |
| `surprises` | 标记为人工审查 —— 如果同样令人意外的事出现 3+ 次，说明结构上存在问题 |

打印 graduation 报告：

```text
📚 Graduation scan across phases {M}–{N}:

  HIGH RECURRENCE ({K}/{WINDOW} phases)
  ├─ Cluster: "{representative title}"
  ├─ Category: {category}
  ├─ Sources: {list of NN-LEARNINGS filenames}
  └─ Suggested target: {target file} § {section}

  [repeat for each qualifying cluster, ordered HIGH→LOW recurrence]

For each cluster above, choose an action:
  P = Promote now   D = Defer (re-surface next transition)   X = Dismiss (never re-surface)   A = Defer all remaining
```

---

## Step 6: HITL — Process Each Cluster

对于每个聚类（按 Step 5 的顺序），向开发者提问：

```text
Cluster: "{title}" [{category}, {K} phases] → {target}
Action [P/D/X/A]:
```

使用 `AskUserQuestion`（或当前运行时的等效 HITL primitive）。如果 `TEXT_MODE` 为 true，则以纯文本显示该聚类问题，并接受用户键入输入。接受单字符输入：`P`、`D`、`X`、`A`（不区分大小写）。

**当用户选择 `P`（Promote now）：**

1. 读取目标文件（如果不存在，则用标准 header 创建）
2. 将聚类条目追加到建议的 section 下：
   ```markdown
   ### {Cluster representative title}
   {Merged body — combine unique sentences across cluster items}

   **Sources:** Phase {A}, Phase {B}, Phase {C}
   **Promoted:** {ISO_DATE}
   ```
3. 对聚类中的每个源 LEARNINGS.md 条目，在其最后一个现有字段之后追加 `**Graduated:** {target-file}:{ISO_DATE}`
4. 将目标文件和所有已标注的 LEARNINGS.md 文件在一次原子 commit 中一并提交：
   `docs(learnings): graduate "{cluster title}" to {target-file}`

**当用户选择 `D`（Defer）：**

写入 `.planning/STATE.md` 的 `graduation_backlog` 下：
```yaml
- cluster_id: "{sha256}"
  status: "deferred"
  deferred_until: "phase-{NEXT_PHASE_NUMBER}"
  cluster_title: "{title}"
```

**当用户选择 `X`（Dismiss）：**

写入 `.planning/STATE.md` 的 `graduation_backlog` 下：
```yaml
- cluster_id: "{sha256}"
  status: "dismissed"
  cluster_title: "{title}"
```

**当用户选择 `A`（Defer all）：**

将当前聚类延后（与 `D` 相同），并在本次运行中跳过其余所有聚类，将它们全部延后到下一次 transition。打印：
```text
[graduation: deferred all remaining clusters to next transition]
```
然后直接进入 Step 7。

---

## Step 7: Completion Report

处理完所有聚类后，打印：

```text
Graduation complete: {promoted} promoted, {deferred} deferred, {dismissed} dismissed.
```

如果没有符合条件的聚类（全部被 backlog 或 threshold 过滤掉），打印：
```text
[graduation: no qualifying clusters in phases {M}–{N}]
```

---

## First-Run Behaviour

升级到包含此工作流的版本后，第一次 transition 可能会让所有现存 LEARNINGS.md 文件一次性产生大量候选项。提供 `[Defer all]` 简写：如果开发者在任一聚类提示中输入 `A`，则本次运行剩余的所有聚类都会被延后到下一次 transition。

---

## No-Op Conditions (silent skip)

- `features.graduation = false`
- 带有 LEARNINGS.md 的前置阶段少于 `graduation_threshold` 个
- 窗口内总条目数 < 5
- 所有符合条件的聚类都在 `graduation_backlog` 中被标记为 dismissed
