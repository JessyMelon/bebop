# 模型配置

模型配置决定每个 GSD agent 使用哪个 Claude 模型。这允许你在质量与 token 成本之间做平衡，或者继承当前会话中已选的模型。

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `adaptive` | `inherit` |
|-------|-----------|------------|----------|------------|-----------|
| gsd-planner | opus | opus | sonnet | opus | inherit |
| gsd-roadmapper | opus | sonnet | sonnet | sonnet | inherit |
| gsd-executor | opus | sonnet | sonnet | sonnet | inherit |
| gsd-phase-researcher | opus | sonnet | haiku | sonnet | inherit |
| gsd-project-researcher | opus | sonnet | haiku | sonnet | inherit |
| gsd-research-synthesizer | sonnet | sonnet | haiku | haiku | inherit |
| gsd-debugger | opus | sonnet | sonnet | opus | inherit |
| gsd-codebase-mapper | sonnet | haiku | haiku | haiku | inherit |
| gsd-verifier | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-plan-checker | sonnet | sonnet | haiku | haiku | inherit |
| gsd-integration-checker | sonnet | sonnet | haiku | haiku | inherit |
| gsd-nyquist-auditor | sonnet | sonnet | haiku | haiku | inherit |

## Profile Philosophy

**quality** - 最大推理能力
- 所有决策型 agents 用 Opus
- 只读验证用 Sonnet
- 使用场景：配额充足、关键架构工作

**balanced** (default) - 智能分配
- 仅 planning 使用 Opus（架构决策发生在这里）
- execution 和 research 用 Sonnet（遵循显式指令）
- verification 用 Sonnet（需要推理，不只是模式匹配）
- 使用场景：日常开发、质量和成本的良好平衡

**budget** - 最小化 Opus 使用
- 任何写代码的 agent 都用 Sonnet
- research 和 verification 用 Haiku
- 使用场景：节省配额、大规模工作、没那么关键的 phases

**adaptive** — 基于角色的成本优化
- planning 和 debugging 用 Opus（这里推理质量影响最大）
- execution、research 和 verification 用 Sonnet（遵循显式指令）
- mapping、checking 和 auditing 用 Haiku（高吞吐、结构化输出）
- 使用场景：在不牺牲 plan 质量的前提下优化成本，适合付费 API 层级下的独立开发

**inherit** - 跟随当前会话模型
- 所有 agents 都解析为 `inherit`
- 最适合你会交互式切换模型的时候（例如 OpenCode 或 Kilo 的 `/model`）
- **在使用非 Anthropic providers 时必须使用**（OpenRouter、本地模型等）—— 否则 GSD 可能会直接调用 Anthropic 模型，产生意外成本
- 使用场景：你希望 GSD 始终跟随当前运行时会话所选模型

## Using Non-Claude Runtimes (Codex, OpenCode, Gemini CLI, Kilo)

当安装在非 Claude runtime 上时，GSD installer 会在 `~/.gsd/defaults.json` 中设置 `resolve_model_ids: "omit"`。这会让所有 agents 的 model 参数为空，于是每个 agent 都使用该 runtime 的默认模型。无需额外手动设置。

如果你想给不同 agents 指定不同模型，可以添加 `model_overrides`，填写你的 runtime 能识别的 model IDs：

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
```

同样适用相同的分层逻辑：更强的模型给 planning 与 debugging，更便宜的模型给 execution 与 mapping。

## Using Claude Code with Non-Anthropic Providers (OpenRouter, Local)

如果你在 Claude Code 中使用 OpenRouter、本地模型或任何非 Anthropic provider，请设置 `inherit` profile，避免 GSD 为 subagents 直接调用 Anthropic 模型：

```bash
# Via settings command
/gsd-settings
# → Select "Inherit" for model profile

# Or manually in .planning/config.json
{
  "model_profile": "inherit"
}
```

如果不使用 `inherit`，GSD 默认的 `balanced` profile 会为不同 agent 类型分别启动指定的 Anthropic 模型（`opus`, `sonnet`, `haiku`），这可能会通过你的非 Anthropic provider 带来额外 API 成本。

## Resolution Logic

orchestrators 在 spawn 之前解析模型：

```
1. Read .planning/config.json
2. Check model_overrides for agent-specific override
3. If no override, look up agent in profile table
4. Pass model parameter to Task call
```

## Per-Agent Overrides

无需更改整个 profile，也可以只覆盖特定 agents：

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

overrides 的优先级高于 profile。有效值包括：`opus`, `sonnet`, `haiku`, `inherit`，或任意完整 model ID（例如 `"o3"`, `"openai/o3"`, `"google/gemini-2.5-pro"`）。

## Switching Profiles

运行时：`/gsd-set-profile <profile>`

项目默认值：在 `.planning/config.json` 中设置：
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why Opus for gsd-planner?**
planning 涉及架构决策、目标拆解和任务设计。这里是模型质量影响最大的地方。

**Why Sonnet for gsd-executor?**
executor 是在遵循明确的 PLAN.md 指令。推理已经写进 plan 了；execution 负责实现。

**Why Sonnet (not Haiku) for verifiers in balanced?**
verification 需要从目标反推的推理 —— 它要检查代码是否真正**交付**了 phase 承诺的结果，而不是只做模式匹配。Sonnet 适合这种任务；Haiku 可能会漏掉细微缺口。

**Why Haiku for gsd-codebase-mapper?**
只读探索与模式提取。不需要强推理，只需从文件内容中输出结构化结果。

**Why `inherit` instead of passing `opus` directly?**
Claude Code 中的 `"opus"` 别名会映射到某个具体模型版本。组织可能封锁旧版 opus，但允许新版。GSD 对 opus 级 agent 返回 `"inherit"`，让它们使用用户当前会话中已配置的 opus 版本。这样能避免版本冲突以及静默回退到 Sonnet。

**Why `inherit` profile?**
某些 runtimes（包括 OpenCode）允许用户在运行时切换模型（`/model`）。`inherit` profile 可以让所有 GSD subagents 与这个实时选择保持一致。
