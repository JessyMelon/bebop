<purpose>
通过 npm 检查 GSD 更新，显示已安装版本与最新版本之间的 changelog，获取用户确认，并在清理缓存后执行全新安装。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

<step name="get_installed_version">
通过检查本地和全局两个位置并验证安装完整性，判断 GSD 是本地安装还是全局安装。

首先，从 invoking prompt 的 `execution_context` 路径推导 `PREFERRED_CONFIG_DIR` 和 `PREFERRED_RUNTIME`：
- 如果路径包含 `/get-shit-done/workflows/update.md`，去掉该后缀，并将剩余部分保存为 `PREFERRED_CONFIG_DIR`
- 路径包含 `/.codex/` -> `codex`
- 路径包含 `/.gemini/` -> `gemini`
- 路径包含 `/.config/kilo/` 或 `/.kilo/`，或 `PREFERRED_CONFIG_DIR` 包含 `kilo.json` / `kilo.jsonc` -> `kilo`
- 路径包含 `/.config/opencode/` 或 `/.opencode/`，或 `PREFERRED_CONFIG_DIR` 包含 `opencode.json` / `opencode.jsonc` -> `opencode`
- 否则 -> `claude`

可用时优先使用 `PREFERRED_CONFIG_DIR`，这样会先检查自定义 `--config-dir` 安装，再检查默认位置。
将 `PREFERRED_RUNTIME` 作为首个检查的 runtime，这样 `/gsd-update` 会更新调用它的 runtime。

Kilo 配置优先级必须与 installer 保持一致：`KILO_CONFIG_DIR` -> `dirname(KILO_CONFIG)` -> `XDG_CONFIG_HOME/kilo` -> `~/.config/kilo`。

```bash
expand_home() {
  case "$1" in
    "~/"*) printf '%s/%s\n' "$HOME" "${1#~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# Runtime candidates: "<runtime>:<config-dir>" stored as an array.
# Using an array instead of a space-separated string ensures correct
# iteration in both bash and zsh (zsh does not word-split unquoted
# variables by default). Fixes #1173.
RUNTIME_DIRS=( "claude:.claude" "opencode:.config/opencode" "opencode:.opencode" "gemini:.gemini" "kilo:.config/kilo" "kilo:.kilo" "codex:.codex" )
ENV_RUNTIME_DIRS=()

# PREFERRED_CONFIG_DIR / PREFERRED_RUNTIME should be set from execution_context
# before running this block.
if [ -n "$PREFERRED_CONFIG_DIR" ]; then
  PREFERRED_CONFIG_DIR="$(expand_home "$PREFERRED_CONFIG_DIR")"
  if [ -z "$PREFERRED_RUNTIME" ]; then
    if [ -f "$PREFERRED_CONFIG_DIR/kilo.json" ] || [ -f "$PREFERRED_CONFIG_DIR/kilo.jsonc" ]; then
      PREFERRED_RUNTIME="kilo"
    elif [ -f "$PREFERRED_CONFIG_DIR/opencode.json" ] || [ -f "$PREFERRED_CONFIG_DIR/opencode.jsonc" ]; then
      PREFERRED_RUNTIME="opencode"
    elif [ -f "$PREFERRED_CONFIG_DIR/config.toml" ]; then
      PREFERRED_RUNTIME="codex"
    fi
  fi
fi

# If runtime is still unknown, infer from runtime env vars; fallback to claude.
if [ -z "$PREFERRED_RUNTIME" ]; then
  if [ -n "$CODEX_HOME" ]; then
    PREFERRED_RUNTIME="codex"
  elif [ -n "$GEMINI_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="gemini"
  elif [ -n "$KILO_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="kilo"
  elif [ -n "$KILO_CONFIG" ]; then
    PREFERRED_RUNTIME="kilo"
  elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then
    PREFERRED_RUNTIME="opencode"
  elif [ -n "$CLAUDE_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="claude"
  else
    PREFERRED_RUNTIME="claude"
  fi
fi

# If execution_context already points at an installed config dir, trust it first.
# This covers custom --config-dir installs that do not live under the default
# runtime directories.
if [ -n "$PREFERRED_CONFIG_DIR" ] && { [ -f "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION" ] || [ -f "$PREFERRED_CONFIG_DIR/get-shit-done/workflows/update.md" ]; }; then
  INSTALL_SCOPE="GLOBAL"
  # Normalize a path for comparison: on Windows with Git Bash, pwd returns
  # POSIX-style /c/Users/... but PREFERRED_CONFIG_DIR may carry C:/Users/...
  # Convert Windows drive-letter paths to POSIX form so the comparison works
  # on both Windows (Git Bash) and POSIX systems.
  normalize_path() {
    local p="$1"
    case "$p" in
      [A-Za-z]:/*)
        local drive rest
        drive="${p%%:*}"
        rest="${p#?:}"
        p="/$(printf '%s' "$drive" | tr '[:upper:]' '[:lower:]')$rest"
        ;;
    esac
    printf '%s' "$p"
  }
  normalized_preferred="$(normalize_path "$PREFERRED_CONFIG_DIR")"
  for dir in .claude .config/opencode .opencode .gemini .config/kilo .kilo .codex; do
    resolved_local="$(cd "./$dir" 2>/dev/null && pwd)"
    normalized_local="$(normalize_path "$resolved_local")"
    if [ -n "$normalized_local" ] && [ "$normalized_local" = "$normalized_preferred" ]; then
      INSTALL_SCOPE="LOCAL"
      break
    fi
  done

  if [ -f "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION"; then
    INSTALLED_VERSION="$(cat "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION")"
  else
    INSTALLED_VERSION="0.0.0"
  fi

  echo "$INSTALLED_VERSION"
  echo "$INSTALL_SCOPE"
  echo "${PREFERRED_RUNTIME:-claude}"
  exit 0
fi

# Absolute global candidates from env overrides (covers custom config dirs).
if [ -n "$CLAUDE_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "claude:$(expand_home "$CLAUDE_CONFIG_DIR")" )
fi
if [ -n "$GEMINI_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "gemini:$(expand_home "$GEMINI_CONFIG_DIR")" )
fi
if [ -n "$KILO_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "kilo:$(expand_home "$KILO_CONFIG_DIR")" )
elif [ -n "$KILO_CONFIG" ]; then
  ENV_RUNTIME_DIRS+=( "kilo:$(dirname "$(expand_home "$KILO_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  ENV_RUNTIME_DIRS+=( "kilo:$(expand_home "$XDG_CONFIG_HOME")/kilo" )
fi
if [ -n "$OPENCODE_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "opencode:$(expand_home "$OPENCODE_CONFIG_DIR")" )
elif [ -n "$OPENCODE_CONFIG" ]; then
  ENV_RUNTIME_DIRS+=( "opencode:$(dirname "$(expand_home "$OPENCODE_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  ENV_RUNTIME_DIRS+=( "opencode:$(expand_home "$XDG_CONFIG_HOME")/opencode" )
fi
if [ -n "$CODEX_HOME" ]; then
  ENV_RUNTIME_DIRS+=( "codex:$(expand_home "$CODEX_HOME")" )
fi

# Reorder entries so preferred runtime is checked first.
ORDERED_RUNTIME_DIRS=()
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done
ORDERED_ENV_RUNTIME_DIRS=()
for entry in "${ENV_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_ENV_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${ENV_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_ENV_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done

# Check local first (takes priority only if valid and distinct from global)
LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR="" LOCAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "./$dir/get-shit-done/VERSION" ] || [ -f "./$dir/get-shit-done/workflows/update.md" ]; then
    LOCAL_RUNTIME="$runtime"
    LOCAL_VERSION_FILE="./$dir/get-shit-done/VERSION"
    LOCAL_MARKER_FILE="./$dir/get-shit-done/workflows/update.md"
    LOCAL_DIR="$(cd "./$dir" 2>/dev/null && pwd)"
    break
  fi
done

GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR="" GLOBAL_RUNTIME=""
for entry in "${ORDERED_ENV_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "$dir/get-shit-done/VERSION" ] || [ -f "$dir/get-shit-done/workflows/update.md" ]; then
    GLOBAL_RUNTIME="$runtime"
    GLOBAL_VERSION_FILE="$dir/get-shit-done/VERSION"
    GLOBAL_MARKER_FILE="$dir/get-shit-done/workflows/update.md"
    GLOBAL_DIR="$(cd "$dir" 2>/dev/null && pwd)"
    break
  fi
done

if [ -z "$GLOBAL_RUNTIME" ]; then
  for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
    runtime="${entry%%:*}"
    dir="${entry#*:}"
    if [ -f "$HOME/$dir/get-shit-done/VERSION" ] || [ -f "$HOME/$dir/get-shit-done/workflows/update.md" ]; then
      GLOBAL_RUNTIME="$runtime"
      GLOBAL_VERSION_FILE="$HOME/$dir/get-shit-done/VERSION"
      GLOBAL_MARKER_FILE="$HOME/$dir/get-shit-done/workflows/update.md"
      GLOBAL_DIR="$(cd "$HOME/$dir" 2>/dev/null && pwd)"
      break
    fi
  done
fi

# Only treat as LOCAL if the resolved paths differ (prevents misdetection when CWD=$HOME)
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  if [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ]; then
    IS_LOCAL=true
  fi
fi

if [ "$IS_LOCAL" = true ]; then
  INSTALLED_VERSION="$(cat "$LOCAL_VERSION_FILE")"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED_VERSION="$(cat "$GLOBAL_VERSION_FILE")"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
elif [ -n "$LOCAL_RUNTIME" ] && [ -f "$LOCAL_MARKER_FILE" ]; then
  # Runtime detected but VERSION missing/corrupt: treat as unknown version, keep runtime target
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_RUNTIME" ] && [ -f "$GLOBAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
else
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="UNKNOWN"
  TARGET_RUNTIME="claude"
fi

echo "$INSTALLED_VERSION"
echo "$INSTALL_SCOPE"
echo "$TARGET_RUNTIME"
```

解析输出：
- 第 1 行 = 已安装版本（`0.0.0` 表示版本未知）
- 第 2 行 = 安装范围（`LOCAL`、`GLOBAL` 或 `UNKNOWN`）
- 第 3 行 = 目标 runtime（`claude`、`opencode`、`gemini`、`kilo` 或 `codex`）
- 如果 scope 为 `UNKNOWN`，则在安装步骤使用 `--claude --global` 回退继续。

如果检测到多个 runtime 安装，且无法从 execution_context 确定调用方 runtime，则在运行安装前询问用户要更新哪个 runtime。

**如果 VERSION 文件缺失：**
```
## GSD Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

继续执行安装步骤（比较时按版本 0.0.0 处理）。
</step>

<step name="check_latest_version">
通过 npm 检查最新版本：

```bash
npm view get-shit-done-cc version 2>/dev/null
```

**如果 npm 检查失败：**
```
Couldn't check for updates (offline or npm unavailable).

To update manually: `npx get-shit-done-cc --global`
```

退出。
</step>

<step name="compare_versions">
比较已安装版本与最新版本：

**如果 installed == latest：**
```
## GSD Update

**Installed:** X.Y.Z
**Latest:** X.Y.Z

You're already on the latest version.
```

退出。

**如果 installed > latest：**
```
## GSD Update

**Installed:** X.Y.Z
**Latest:** A.B.C

You're ahead of the latest release — this looks like a dev install.

If you see a "⚠ dev install — re-run installer to sync hooks" warning in
your statusline, your hook files are older than your VERSION file. Fix it
by re-running the local installer from your dev branch:

    node bin/install.js --global --claude

Running /gsd-update would install the npm release (A.B.C) and downgrade
your dev version — do NOT use it to resolve this warning.
```

退出。
</step>

<step name="show_changes_and_confirm">
**如果有可用更新**，在更新前先获取并展示更新内容：

1. 从 GitHub raw URL 获取 changelog
2. 提取已安装版本与最新版本之间的条目
3. 显示预览并请求确认：

```
## GSD Update Available

**Installed:** 1.5.10
**Latest:** 1.5.15

### What's New
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### Added
- Feature X

## [1.5.14] - 2026-01-18

### Fixed
- Bug fix Y

────────────────────────────────────────────────────────────

⚠️  **Note:** The installer performs a clean install of GSD folders:
- `commands/gsd/` will be wiped and replaced
- `get-shit-done/` will be wiped and replaced
- `agents/gsd-*` files will be replaced

(Paths are relative to detected runtime install location:
global: `~/.claude/`, `~/.config/opencode/`, `~/.opencode/`, `~/.gemini/`, `~/.config/kilo/`, or `~/.codex/`
local: `./.claude/`, `./.config/opencode/`, `./.opencode/`, `./.gemini/`, `./.kilo/`, or `./.codex/`)

Your custom files in other locations are preserved:
- Custom commands not in `commands/gsd/` ✓
- Custom agents not prefixed with `gsd-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GSD files directly, they'll be automatically backed up to `gsd-local-patches/` and can be reapplied with `/gsd-reapply-patches` after the update.
```


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 若 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
使用 AskUserQuestion：
- 问题："Proceed with update?"
- 选项：
  - "Yes, update now"
  - "No, cancel"

**如果用户取消：** 退出。
</step>

<step name="backup_custom_files">
运行 installer 之前，检测并备份所有位于 GSD 管理目录内、由用户添加的文件。这些文件存在于磁盘中，但**不**在 `gsd-file-manifest.json` 里，也就是用户自行添加、installer 不认识、并会在清理时删除的文件。

**不要使用 bash 路径裁剪（`${filepath#$RUNTIME_DIR/}`）或内联 `node -e require()`**，这些模式在 `$RUNTIME_DIR` 未设置时会失败，而且裁剪后的相对路径可能与 manifest key 格式不匹配，导致即使存在自定义文件也会出现 CUSTOM_COUNT=0（bug #1997）。当 `gsd-sdk` 在 `PATH` 上时使用 `gsd-sdk query detect-custom-files`，否则使用打包的 `gsd-tools.cjs detect-custom-files`，两者都会用 Node.js `path.relative()` 可靠地解析路径。

首先，根据 `get_installed_version` 中检测到的安装范围解析 config 目录（`RUNTIME_DIR`）：

```bash
# RUNTIME_DIR is the resolved config directory (e.g. ~/.config/opencode, ~/.gemini)
# It should already be set from get_installed_version as GLOBAL_DIR or LOCAL_DIR.
# Use the appropriate variable based on INSTALL_SCOPE.
if [ "$INSTALL_SCOPE" = "LOCAL" ]; then
  RUNTIME_DIR="$LOCAL_DIR"
elif [ "$INSTALL_SCOPE" = "GLOBAL" ]; then
  RUNTIME_DIR="$GLOBAL_DIR"
else
  RUNTIME_DIR=""
fi
```

如果 `RUNTIME_DIR` 为空或不存在，则跳过此步骤（没有可检查的 config dir）。

否则运行 `detect-custom-files`（可用时优先使用 SDK）：

```bash
GSD_TOOLS="$RUNTIME_DIR/get-shit-done/bin/gsd-tools.cjs"
CUSTOM_JSON=''
if [ -n "$RUNTIME_DIR" ] && command -v gsd-sdk >/dev/null 2>&1; then
  CUSTOM_JSON=$(gsd-sdk query detect-custom-files --config-dir "$RUNTIME_DIR" 2>/dev/null)
elif [ -f "$GSD_TOOLS" ] && [ -n "$RUNTIME_DIR" ]; then
  CUSTOM_JSON=$(node "$GSD_TOOLS" detect-custom-files --config-dir "$RUNTIME_DIR" 2>/dev/null)
fi
if [ -z "$CUSTOM_JSON" ]; then
  CUSTOM_JSON='{"custom_files":[],"custom_count":0}'
fi
CUSTOM_COUNT=$(echo "$CUSTOM_JSON" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).custom_count);}catch{console.log(0);}})" 2>/dev/null || echo "0")
```

**如果 `CUSTOM_COUNT` > 0：**

在 installer 清理目录之前，将每个自定义文件备份到 `$RUNTIME_DIR/gsd-user-files-backup/`：

```bash
BACKUP_DIR="$RUNTIME_DIR/gsd-user-files-backup"
mkdir -p "$BACKUP_DIR"

# Parse custom_files array from CUSTOM_JSON and copy each file
node - "$RUNTIME_DIR" "$BACKUP_DIR" "$CUSTOM_JSON" <<'JSEOF'
const [,, runtimeDir, backupDir, customJson] = process.argv;
const { custom_files } = JSON.parse(customJson);
const fs = require('fs');
const path = require('path');
for (const relPath of custom_files) {
  const src = path.join(runtimeDir, relPath);
  const dst = path.join(backupDir, relPath);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log('  Backed up: ' + relPath);
  }
}
JSEOF
```

然后告知用户：

```
⚠️  Found N custom file(s) inside GSD-managed directories.
    These have been backed up to gsd-user-files-backup/ before the update.
    Restore them after the update if needed.
```

**如果 `CUSTOM_COUNT` == 0：** 未检测到用户新增文件。继续安装。
</step>

<step name="run_update">
按 step 1 中检测到的安装类型执行更新：

从 step 1 构建 runtime flag：
```bash
RUNTIME_FLAG="--$TARGET_RUNTIME"
```

**如果是 LOCAL 安装：**
```bash
npx -y get-shit-done-cc@latest "$RUNTIME_FLAG" --local
```

**如果是 GLOBAL 安装：**
```bash
npx -y get-shit-done-cc@latest "$RUNTIME_FLAG" --global
```

**如果是 UNKNOWN 安装：**
```bash
npx -y get-shit-done-cc@latest --claude --global
```

捕获输出。如果安装失败，显示错误并退出。

清除更新缓存，让状态栏指示器消失：

```bash
expand_home() {
  case "$1" in
    "~/"*) printf '%s/%s\n' "$HOME" "${1#~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# Clear update cache across preferred, env-derived, and default runtime directories
CACHE_DIRS=()
if [ -n "$PREFERRED_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$PREFERRED_CONFIG_DIR")" )
fi
if [ -n "$CLAUDE_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$CLAUDE_CONFIG_DIR")" )
fi
if [ -n "$GEMINI_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$GEMINI_CONFIG_DIR")" )
fi
if [ -n "$KILO_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$KILO_CONFIG_DIR")" )
elif [ -n "$KILO_CONFIG" ]; then
  CACHE_DIRS+=( "$(dirname "$(expand_home "$KILO_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  CACHE_DIRS+=( "$(expand_home "$XDG_CONFIG_HOME")/kilo" )
fi
if [ -n "$OPENCODE_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$OPENCODE_CONFIG_DIR")" )
elif [ -n "$OPENCODE_CONFIG" ]; then
  CACHE_DIRS+=( "$(dirname "$(expand_home "$OPENCODE_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  CACHE_DIRS+=( "$(expand_home "$XDG_CONFIG_HOME")/opencode" )
fi
if [ -n "$CODEX_HOME" ]; then
  CACHE_DIRS+=( "$(expand_home "$CODEX_HOME")" )
fi

for dir in "${CACHE_DIRS[@]}"; do
  if [ -n "$dir" ]; then
    rm -f "$dir/cache/gsd-update-check.json"
  fi
done

for dir in .claude .config/opencode .opencode .gemini .config/kilo .kilo .codex; do
  rm -f "./$dir/cache/gsd-update-check.json"
  rm -f "$HOME/$dir/cache/gsd-update-check.json"
done
```

SessionStart hook（`gsd-check-update.js`）会写入检测到的 runtime 的缓存目录，因此必须同时清除 preferred/env-derived 路径和默认路径，避免遗留的更新提示。
</step>

<step name="display_result">
格式化完成消息（changelog 已在确认步骤中显示）：

```
╔═══════════════════════════════════════════════════════════╗
║  GSD Updated: v1.5.10 → v1.5.15                           ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Restart your runtime to pick up the new commands.

[View full changelog](https://github.com/gsd-build/get-shit-done/blob/main/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
更新完成后，检查 installer 是否检测并备份了本地修改过的文件：

检查 config 目录中是否存在 `gsd-local-patches/backup-meta.json`。

**如果发现 patches：**

```
Local patches were backed up before the update.
Run /gsd-reapply-patches to merge your modifications into the new version.
```

**如果没有 patches：** 正常继续。
</step>
</process>

<success_criteria>
- [ ] 已正确读取已安装版本
- [ ] 已通过 npm 检查最新版本
- [ ] 如已是最新则跳过更新
- [ ] 已在更新前获取并显示 changelog
- [ ] 已显示全新安装警告
- [ ] 已获得用户确认
- [ ] 已成功执行更新
- [ ] 已显示重启提醒
</success_criteria>
