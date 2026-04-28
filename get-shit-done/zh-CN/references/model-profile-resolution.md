# 模型配置解析

在编排开始时解析一次模型配置，然后在所有 Task spawn 中复用。

## Resolution Pattern

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

默认值：如果未设置或 config 缺失，则为 `balanced`。

## Lookup Table

@~/.claude/get-shit-done/references/model-profiles.md

在解析出的 profile 表中查找对应 agent。把 model 参数传给 Task 调用：

```
Task(
  prompt="...",
  subagent_type="gsd-planner",
  model="{resolved_model}"  # "inherit", "sonnet", or "haiku"
)
```

**Note:** Opus 级 agent 会解析为 `"inherit"`（不是 `"opus"`）。这样 agent 会沿用父会话模型，避免与组织策略对特定 opus 版本的限制冲突。

如果 `model_profile` 是 `"adaptive"`，agents 会按角色解析到不同分配（根据 agent 类型映射到 opus/sonnet/haiku）。

如果 `model_profile` 是 `"inherit"`，所有 agents 都会解析为 `"inherit"`（对 OpenCode `/model` 很有用）。

## Usage

1. 在编排开始时解析一次
2. 保存 profile 值
3. 每次 spawn agent 时，从表中查对应模型
4. 给每个 Task 调用传 model 参数（取值：`"inherit"`, `"sonnet"`, `"haiku"`）
