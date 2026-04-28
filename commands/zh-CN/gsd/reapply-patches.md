---
name: gsd:reapply-patches
description: 在 GSD 更新后重新应用本地修改
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
当 GSD 更新清空并重新安装文件后，此命令会将用户先前保存的本地修改合并回新版本中。使用三方比较（纯净基线、用户修改后的备份、新安装的版本），以可靠地区分用户定制与版本漂移。

**Critical invariant:** `gsd-local-patches/` 中的每个文件之所以被备份，都是因为安装器的哈希比较检测到它已被修改。workflow 绝不能对任何已备份文件得出“no custom content”的结论，这在逻辑上自相矛盾。如有疑问，应归类为需要用户审查的 CONFLICT，而不是 SKIP。
</purpose>

<process>

## Step 1: 检测已备份的 patch

检查本地 patch 目录：

```bash
expand_home() {
  case "$1" in
    "~/"*) printf '%s/%s\n' "$HOME" "${1#~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

PATCHES_DIR=""

# Env overrides first — covers custom config directories used with --config-dir
if [ -n "$KILO_CONFIG_DIR" ]; then
  candidate="$(expand_home "$KILO_CONFIG_DIR")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
elif [ -n "$KILO_CONFIG" ]; then
  candidate="$(dirname "$(expand_home "$KILO_CONFIG")")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
elif [ -n "$XDG_CONFIG_HOME" ]; then
  candidate="$(expand_home "$XDG_CONFIG_HOME")/kilo/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
fi

if [ -z "$PATCHES_DIR" ] && [ -n "$OPENCODE_CONFIG_DIR" ]; then
  candidate="$(expand_home "$OPENCODE_CONFIG_DIR")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
elif [ -z "$PATCHES_DIR" ] && [ -n "$OPENCODE_CONFIG" ]; then
  candidate="$(dirname "$(expand_home "$OPENCODE_CONFIG")")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
elif [ -z "$PATCHES_DIR" ] && [ -n "$XDG_CONFIG_HOME" ]; then
  candidate="$(expand_home "$XDG_CONFIG_HOME")/opencode/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
fi

if [ -z "$PATCHES_DIR" ] && [ -n "$GEMINI_CONFIG_DIR" ]; then
  candidate="$(expand_home "$GEMINI_CONFIG_DIR")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
fi

if [ -z "$PATCHES_DIR" ] && [ -n "$CODEX_HOME" ]; then
  candidate="$(expand_home "$CODEX_HOME")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
fi

if [ -z "$PATCHES_DIR" ] && [ -n "$CLAUDE_CONFIG_DIR" ]; then
  candidate="$(expand_home "$CLAUDE_CONFIG_DIR")/gsd-local-patches"
  if [ -d "$candidate" ]; then
    PATCHES_DIR="$candidate"
  fi
fi

# Global install — detect runtime config directory defaults
if [ -z "$PATCHES_DIR" ]; then
  if [ -d "$HOME/.config/kilo/gsd-local-patches" ]; then
    PATCHES_DIR="$HOME/.config/kilo/gsd-local-patches"
  elif [ -d "$HOME/.config/opencode/gsd-local-patches" ]; then
    PATCHES_DIR="$HOME/.config/opencode/gsd-local-patches"
  elif [ -d "$HOME/.opencode/gsd-local-patches" ]; then
    PATCHES_DIR="$HOME/.opencode/gsd-local-patches"
  elif [ -d "$HOME/.gemini/gsd-local-patches" ]; then
    PATCHES_DIR="$HOME/.gemini/gsd-local-patches"
  elif [ -d "$HOME/.codex/gsd-local-patches" ]; then
    PATCHES_DIR="$HOME/.codex/gsd-local-patches"
  else
    PATCHES_DIR="$HOME/.claude/gsd-local-patches"
  fi
fi
# Local install fallback — check all runtime directories
if [ ! -d "$PATCHES_DIR" ]; then
  for dir in .config/kilo .kilo .config/opencode .opencode .gemini .codex .claude; do
    if [ -d "./$dir/gsd-local-patches" ]; then
      PATCHES_DIR="./$dir/gsd-local-patches"
      break
    fi
  done
fi
```

读取 patch 目录中的 `backup-meta.json`。

**If no patches found:**
```
No local patches found. Nothing to reapply.

Local patches are automatically saved when you run /gsd-update
after modifying any GSD workflow, command, or agent files.
```
退出。

## Step 2: 确定三方比较所用的基线

合并质量依赖于**纯净基线**，即更新前 GSD 发行版中每个文件的原始未修改版本。这样才能进行三方比较：
- **纯净基线**（用户编辑前的原始 GSD 文件）
- **用户版本**（备份在 `gsd-local-patches/` 中）
- **新版本**（更新后重新安装的版本）

按优先级检查基线来源：

### Option A: 使用 backup-meta.json 中的 pristine hash + git 历史（最可靠）
如果配置目录是 git 仓库：
```bash
CONFIG_DIR=$(dirname "$PATCHES_DIR")
if git -C "$CONFIG_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  HAS_GIT=true
fi
```
当 `HAS_GIT=true` 时，使用 `backup-meta.json` 中记录的 `pristine_hashes` 定位正确的基线提交。对每个文件，遍历曾修改它的提交，找到 blob SHA-256 与记录的 pristine hash 匹配的那一次：
```bash
# Get the expected pristine SHA-256 from backup-meta.json
PRISTINE_HASH=$(jq -r ".pristine_hashes[\"${file_path}\"] // empty" "$PATCHES_DIR/backup-meta.json")

BASELINE_COMMIT=""
if [ -n "$PRISTINE_HASH" ]; then
  # Walk commits that touched this file, pick the one matching the pristine hash
  while IFS= read -r commit_hash; do
    blob_hash=$(git -C "$CONFIG_DIR" show "${commit_hash}:${file_path}" 2>/dev/null | sha256sum | cut -d' ' -f1)
    if [ "$blob_hash" = "$PRISTINE_HASH" ]; then
      BASELINE_COMMIT="$commit_hash"
      break
    fi
  done < <(git -C "$CONFIG_DIR" log --format="%H" -- "${file_path}")
fi

# Fallback: if no pristine hash in backup-meta (older installer), use first-add commit
if [ -z "$BASELINE_COMMIT" ]; then
  BASELINE_COMMIT=$(git -C "$CONFIG_DIR" log --diff-filter=A --format="%H" -- "${file_path}" | tail -1)
fi
```
从匹配的提交中提取纯净版本：
```bash
git -C "$CONFIG_DIR" show "${BASELINE_COMMIT}:${file_path}"
```

**Why this matters:** `git log --diff-filter=A` 返回的是文件**首次被添加**的提交，这在经历过多次 GSD 更新周期的仓库里会得到错误基线。`backup-meta.json` 中的 `pristine_hashes` 字段记录的是该文件在更新前 GSD 发行版中的 SHA-256，通过与之匹配，可以无视更新次数准确找到正确基线。

### Option B: 纯净快照目录
检查 `gsd-local-patches/` 旁边是否存在 `gsd-pristine/` 目录：
```bash
PRISTINE_DIR="$CONFIG_DIR/gsd-pristine"
```
如果存在，说明安装器在安装时保存了纯净副本。将这些副本作为基线。

### Option C: 没有可用基线（退回双向比较）
如果既没有 git 历史，也没有纯净快照，则退回到双向比较，但要使用**增强启发式规则**（见第 3 步）。

## Step 3: 显示 patch 摘要

```
## Local Patches to Reapply

**Backed up from:** v{from_version}
**Current version:** {read VERSION file}
**Files modified:** {count}
**Merge strategy:** {three-way (git) | three-way (pristine) | two-way (enhanced)}

| # | File | Status |
|---|------|--------|
| 1 | {file_path} | Pending |
| 2 | {file_path} | Pending |
```

## Step 4: 合并每个文件

对于 `backup-meta.json` 中的每个文件：

1. **读取备份版本**（来自 `gsd-local-patches/` 的用户修改副本）
2. **读取新安装版本**（更新后当前文件）
3. **如果可用，读取纯净基线**（来自 git 历史或 `gsd-pristine/`）

### 三方合并（基线可用时）

比较这三个版本以隔离变更：
- **用户变更** = diff(pristine → 用户版本) —— 这些是需要保留的定制
- **上游变更** = diff(pristine → 新版本) —— 这些是应接受的版本更新

**合并规则：**
- 仅用户修改的部分 → 应用用户版本
- 仅上游修改的部分 → 接受上游版本
- 双方都修改的部分 → 标记为 CONFLICT，展示两边内容并询问用户
- 双方都未修改的部分 → 使用新版本（与三个版本一致）

### 双向合并（无基线时的兜底）

当没有纯净基线可用时，使用以下**增强启发式规则**：

**CRITICAL RULE: 此备份目录中的每个文件都已被安装器的 SHA-256 哈希比较明确识别为已修改。“No custom content” 绝不是有效结论。**

对每个文件：
a. 完整读取两个版本
b. 识别**所有**差异，并将每一项归类为：
   - **Mechanical drift** —— 路径替换（例如 `/Users/xxx/.claude/` → `$HOME/.claude/`）、变量新增（`${GSD_WS}`、`${AGENT_SKILLS_*}`）、错误处理补充（`|| true`）
   - **User customization** —— 新增步骤/章节、删除章节、重排内容、改变行为、新增 frontmatter 字段、修改指令

c. **如果过滤掉 mechanical drift 后仍有任何差异，则这些就是用户定制。将它们合并。**
d. **如果所有差异看起来都只是 mechanical drift，仍然要标记为 CONFLICT。** 安装器的哈希检查已经证明此文件被修改过。询问用户：“This file appears to only have path/variable differences. Were there intentional customizations?” 不要静默跳过。

### Git 增强型双向合并

当配置目录是 git 仓库，但找不到纯净安装提交时，可使用提交历史识别用户修改：
```bash
# Find non-update commits that touched this file
git -C "$CONFIG_DIR" log --oneline --no-merges -- "{file_path}" | grep -v "gsd:update\|GSD update\|gsd-install"
```
每个匹配的提交都代表一次有意的用户修改。利用提交信息和 diff 理解修改内容及其原因。

4. **将合并结果写入**已安装位置

### 合并后验证

写入每个合并结果后，验证用户修改确实保留了下来：

1. **行数检查：** 统计备份和合并结果的行数。如果合并结果少于“备份行数减去预期上游删除量”，则标记为需要审查。
2. **Hunk 存在性检查：** 对 diff 分析中识别出的每个用户新增片段，在合并输出中至少搜索该片段第一条有意义的行（非空白、非注释）。若缺少这些标识行，说明可能丢失了 hunk。
3. **内联报告警告**（不阻塞）：
   ```
   ⚠ Potential dropped content in {file_path}:
     - Missing hunk near line {N}: "{first_line_preview}..." ({line_count} lines)
     - Backup available: {patches_dir}/{file_path}
   ```
4. **生成 Hunk Verification Table** —— 每个文件的每个 hunk 一行。这张表是**强制输出**，在第 5 步继续前必须生成。格式：

   | file | hunk_id | signature_line | line_count | verified |
   |------|---------|----------------|------------|----------|
   | {file_path} | {N} | {first_significant_line} | {count} | yes |
   | {file_path} | {N} | {first_significant_line} | {count} | no |

   - `hunk_id` — 每个文件内的顺序整数（1、2、3…）
   - `signature_line` — 用户新增片段中的第一条非空白、非注释行
   - `line_count` — 该 hunk 的总行数
   - `verified` — 若 `signature_line` 出现在合并输出中则为 `yes`，否则为 `no`

5. **跟踪验证状态** —— 在每文件报告中加入：`Merged (verified)` 或 `Merged (⚠ {N} hunks may be missing)`

6. **按文件报告状态：**
   - `Merged` — 用户修改已干净应用（显示保留内容摘要）
   - `Conflict` — 用户已审查并选择了解决方案
   - `Incorporated` — 用户修改已被上游采纳（仅当纯净基线确认时有效）

**绝不要报告 `Skipped — no custom content`。** 只要文件在备份中，就说明它有定制内容。

## Step 5: Hunk Verification Gate

在进入清理之前，评估第 4 步生成的 Hunk Verification Table。

**If the Hunk Verification Table is absent**（第 4 步未生成），立即停止，并向用户报告：
```
ERROR: Hunk Verification Table is missing. Post-merge verification was not completed.
Rerun /gsd-reapply-patches to retry with full verification.
```

**If any row in the Hunk Verification Table shows `verified: no`**，立即停止，并向用户报告：
```
ERROR: {N} hunk(s) failed verification — content may have been dropped during merge.

Unverified hunks:
  {file} hunk {hunk_id}: signature line "{signature_line}" not found in merged output

The backup is preserved at: {patches_dir}/{file}
Review the merged file manually, then either:
  (a) Re-merge the missing content by hand, or
  (b) Restore from backup: cp {patches_dir}/{file} {installed_path}
```

在用户确认所有未验证 hunk 都已解决之前，不要继续执行清理。

**只有当所有行都为 `verified: yes`**（或所有文件都没有用户新增 hunk）时，才能继续第 6 步。

## Step 6: 清理选项

询问用户：
- “Keep patch backups for reference?” → 保留 `gsd-local-patches/`
- “Clean up patch backups?” → 删除 `gsd-local-patches/` 目录

## Step 7: 报告

```
## Patches Reapplied

| # | File | Result | User Changes Preserved |
|---|------|--------|----------------------|
| 1 | {file_path} | Merged | Added step X, modified section Y |
| 2 | {file_path} | Incorporated | Already in upstream v{version} |
| 3 | {file_path} | Conflict resolved | User chose: keep custom section |

{count} file(s) updated. Your local modifications are active again.
```

</process>

<success_criteria>
- [ ] 所有已备份 patch 都已处理，没有遗漏文件
- [ ] 没有任何文件被归类为 "no custom content" 或 "SKIP"，每个备份文件都按定义已被修改
- [ ] 当纯净基线可用时，使用三方合并（git 历史或 gsd-pristine/）
- [ ] 已识别用户修改并将其合并进新版本
- [ ] 冲突已向用户展示，并同时给出两个版本
- [ ] 已对每个文件报告状态及保留内容摘要
- [ ] 合并后验证会检查每个文件是否丢失 hunk，并在内容疑似缺失时给出警告
</success_criteria>
