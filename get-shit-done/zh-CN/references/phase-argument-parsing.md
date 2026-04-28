# 阶段参数解析

为操作阶段的命令解析并规范化阶段参数。

## Extraction

从 `$ARGUMENTS` 中：
- 提取阶段编号（第一个数字参数）
- 提取 flags（以 `--` 开头）
- 剩余文本作为描述（供 insert/add commands 使用）

## Using gsd-tools

`find-phase` 命令会一步完成规范化和校验：

```bash
PHASE_INFO=$(gsd-sdk query find-phase "${PHASE}")
```

返回 JSON，包含：
- `found`: true/false
- `directory`: 阶段目录的完整路径
- `phase_number`: 规范化后的编号（例如 `"06"`, `"06.1"`）
- `phase_name`: 名称部分（例如 `"foundation"`）
- `plans`: PLAN.md 文件数组
- `summaries`: SUMMARY.md 文件数组

## Manual Normalization (Legacy)

整数阶段补零到 2 位。保留小数后缀。

```bash
# Normalize phase number
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  # Integer: 8 → 08
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  # Decimal: 2.1 → 02.1
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

## Validation

使用 `roadmap get-phase` 校验阶段是否存在：

```bash
PHASE_CHECK=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick found)
if [ "$PHASE_CHECK" = "false" ]; then
  echo "ERROR: Phase ${PHASE} not found in roadmap"
  exit 1
fi
```

## Directory Lookup

使用 `find-phase` 查找目录：

```bash
PHASE_DIR=$(gsd-sdk query find-phase "${PHASE}" --raw)
```
