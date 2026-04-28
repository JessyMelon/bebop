# 小数阶段计算

为紧急插入计算下一个小数阶段编号。

## Using gsd-tools

```bash
# 获取阶段 6 之后的下一个小数阶段
gsd-sdk query phase.next-decimal 6
```

输出：
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.1",
  "existing": []
}
```

当已有小数阶段时：
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.3",
  "existing": ["06.1", "06.2"]
}
```

## Extract Values

```bash
DECIMAL_PHASE=$(gsd-sdk query phase.next-decimal "${AFTER_PHASE}" --pick next)
BASE_PHASE=$(gsd-sdk query phase.next-decimal "${AFTER_PHASE}" --pick base_phase)
```

或使用 `--raw` flag：
```bash
DECIMAL_PHASE=$(gsd-sdk query phase.next-decimal "${AFTER_PHASE}" --raw)
# 仅返回: 06.1
```

## Examples

| Existing Phases | Next Phase |
|-----------------|------------|
| 仅有 06 | 06.1 |
| 06, 06.1 | 06.2 |
| 06, 06.1, 06.2 | 06.3 |
| 06, 06.1, 06.3（存在缺口） | 06.4 |

## Directory Naming

小数阶段目录使用完整的小数编号：

```bash
SLUG=$(gsd-sdk query generate-slug "$DESCRIPTION" --raw)
PHASE_DIR=".planning/phases/${DECIMAL_PHASE}-${SLUG}"
mkdir -p "$PHASE_DIR"
```

示例：`.planning/phases/06.1-fix-critical-auth-bug/`
