# sync-skills — 跨 Runtime 的 GSD Skill 同步

**Command:** `/gsd-sync-skills`

将受管理的 `gsd-*` skill 目录从一个 canonical runtime 的 skills root 同步到一个或多个目标 runtime skills roots。在某个 runtime 上执行 `gsd-update` 后，用它保持多 runtime 安装的一致性。

---

## Arguments

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--from <runtime>` | Yes | *(none)* | 源 runtime，即作为复制来源的 canonical runtime |
| `--to <runtime\|all>` | Yes | *(none)* | 目标 runtime，或 `all` 表示所有受支持 runtimes |
| `--dry-run` | No | *on by default* | 只预览变更，不写入任何内容 |
| `--apply` | No | *off* | 执行 diff（覆盖 dry-run） |

如果既未指定 `--dry-run` 也未指定 `--apply`，默认是 dry-run。

**Supported runtime names:** `claude`, `codex`, `copilot`, `cursor`, `windsurf`, `opencode`, `gemini`, `kilo`, `augment`, `trae`, `qwen`, `codebuddy`, `cline`, `antigravity`

---

## Step 1: 解析参数

```bash
FROM_RUNTIME=""
TO_RUNTIMES=()
IS_APPLY=false

# Parse --from
if [[ "$@" == *"--from"* ]]; then
  FROM_RUNTIME=$(echo "$@" | grep -oP '(?<=--from )\S+')
fi

# Parse --to
if [[ "$@" == *"--to all"* ]]; then
  TO_RUNTIMES=(claude codex copilot cursor windsurf opencode gemini kilo augment trae qwen codebuddy cline antigravity)
elif [[ "$@" == *"--to"* ]]; then
  TO_RUNTIMES=( $(echo "$@" | grep -oP '(?<=--to )\S+') )
fi

# Parse --apply
if [[ "$@" == *"--apply"* ]]; then
  IS_APPLY=true
fi
```

**Validation:**
- 如果 `--from` 缺失或无法识别：打印错误并退出
- 如果 `--to` 缺失或无法识别：打印错误并退出
- 如果 `--from` == `--to`（单个目标）：打印 `[no-op: source and destination are the same runtime]` 并退出

---

## Step 2: 解析 Skills Roots

使用 `install.js --skills-root` 解析路径，这样可以复用唯一权威的路径表，而不是重复维护一份：

```bash
INSTALL_JS="$(dirname "$0")/../get-shit-done/bin/install.js"
# If running from a global install, resolve relative to the GSD package
INSTALL_JS_GLOBAL="$HOME/.claude/get-shit-done/bin/install.js"
[[ ! -f "$INSTALL_JS" ]] && INSTALL_JS="$INSTALL_JS_GLOBAL"

SRC_SKILLS_ROOT=$(node "$INSTALL_JS" --skills-root "$FROM_RUNTIME")

for DEST_RUNTIME in "${TO_RUNTIMES[@]}"; do
  DEST_SKILLS_ROOTS["$DEST_RUNTIME"]=$(node "$INSTALL_JS" --skills-root "$DEST_RUNTIME")
done
```

**Guard:** 如果源 skills root 不存在，打印：
```
error: source skills root not found: <path>
       当前是否已为 '<runtime>' runtime 全局安装 GSD？
       Run: node ~/.claude/get-shit-done/bin/install.js --global --<runtime>
```
然后退出。

**Guard:** 如果 `--to` 中包含与 `--from` 相同的 runtime，静默跳过该目标。

---

## Step 3: 为每个目标计算 Diff

对每个目标 runtime：

```bash
# List gsd-* subdirectories in source
SRC_SKILLS=$(ls -1 "$SRC_SKILLS_ROOT" 2>/dev/null | grep '^gsd-')

# List gsd-* subdirectories in destination (may not exist yet)
DST_SKILLS=$(ls -1 "$DEST_ROOT" 2>/dev/null | grep '^gsd-')

# Diff:
# CREATE  — in SRC but not in DST
# UPDATE  — in both; content differs (compare recursively via checksums)
# REMOVE  — in DST but not in SRC (stale GSD skill no longer in source)
# SKIP    — in both; content identical (already up to date)
```

**Non-GSD preservation:** 只会创建、更新或删除 `gsd-*` 条目。目标中任何不以 `gsd-` 开头的条目都绝不触碰。

---

## Step 4: 打印 Diff 报告

无论 `--apply` 还是 `--dry-run`，都始终打印报告：

```
sync source: <runtime> (<src_skills_root>)
sync targets: <dest1>, <dest2>

== <dest1> (<dest1_skills_root>) ==
CREATE: gsd-help
UPDATE: gsd-update
REMOVE: gsd-old-command
SKIP:   gsd-plan-phase (up to date)
(N changes)

== <dest2> (<dest2_skills_root>) ==
CREATE: gsd-help
(N changes)

dry-run only. use --apply to execute.    ← 如果是 --apply，则省略这一行
```

如果目标 root 不存在且 `--apply` 为 true，则在其条目前先打印 `CREATE DIR: <path>`。

如果所有目标都已经是最新：
```
All destinations are up to date. No changes needed.
```

---

## Step 5: 执行（仅当 --apply）

如果是 `--dry-run`（或未传 flag），完全跳过此步骤，并在打印报告后退出。

对每个有变更的目标：

```bash
mkdir -p "$DEST_ROOT"

for SKILL in $CREATE_LIST $UPDATE_LIST; do
  rm -rf "$DEST_ROOT/$SKILL"
  cp -r "$SRC_SKILLS_ROOT/$SKILL" "$DEST_ROOT/$SKILL"
done

for SKILL in $REMOVE_LIST; do
  rm -rf "$DEST_ROOT/$SKILL"
done
```

**Idempotency:** 如果中间没有任何变更，第二次运行 `--apply` 必须报告 0 个变更（所有条目都是 SKIP）。

**Atomicity:** 每个 skill 目录作为一个整体被替换（先删除再复制）。不会对 skill 内部的单个文件做局部更新，始终替换整个目录。

所有目标执行完成后：

```
Sync complete: <N> skills synced to <M> runtime(s).
```

---

## Safety Rules

1. **Only `gsd-*` directories** 会被创建、更新或删除。目标 root 中任何不以 `gsd-` 开头的目录都不会被触碰。
2. **Dry-run is the default.** 只有显式传入 `--apply` 才会写入。
3. **Source root must exist.** 绝不要创建 source root；它必须已由之前的 `gsd-update` 或 installer run 创建。
4. **No cross-runtime content transformation.** sync 逐字复制文件，不做 runtime-specific content transformations（这些应在 install time 处理）。如果某个 runtime 需要转换后的内容（例如 Augment 的格式不同），开发者应为该 runtime 运行 installer，而不是使用 sync。

---

## Limitations

- Sync 逐字复制文件，不做 runtime-specific content transformations。对于需要格式转换的 runtimes，请直接使用 GSD installer。
- 跨项目 skills（`.agents/skills/`）不在范围内，本命令只处理全局 runtime skills roots。
- 不支持双向同步。请通过 `--from` 选择一个 canonical source。
