# GSD Beta 功能

> **Beta 功能为可选启用，可能会在未提前通知的情况下变更或移除。** 它们不受适用于 GSD 其余部分的稳定 API 保证约束。如果某个 Beta 功能升级为稳定功能，会在 [COMMANDS.md](COMMANDS.md) 和 [FEATURES.md](FEATURES.md) 中记录，并附带更新日志条目。

---

## `/gsd-ultraplan-phase` - Ultraplan 集成 [BETA]

> **仅支持 Claude Code · 需要 Claude Code v2.1.91+**
> Ultraplan 本身也是 Claude Code 的研究预览版，因此此命令和其底层功能都可能发生变化。

### 它做什么

`/gsd-ultraplan-phase` 会把 GSD 的 plan-phase 草拟工作卸载到 [Claude Code 的 ultraplan](https://code.claude.ai) 云基础设施中。它不是在终端本地规划，而是在浏览器会话中完成草拟，并提供：

- 用于浏览计划结构的**大纲侧边栏**
- 用于标注和优化任务的**内联评论**
- 一个持续存在的浏览器标签页，让你的终端在草拟期间保持可用

当你对草稿满意后，保存并将其导回 GSD。冲突检测、格式校验和 plan-checker 验证都会自动运行。

### 适用场景

| 场景 | 建议 |
|-----------|---------------|
| 复杂且较长的阶段，希望在执行前阅读并评论计划 | 使用 `/gsd-ultraplan-phase` |
| 快速阶段、熟悉领域，或非 Claude Code 运行时 | 使用 `/gsd-plan-phase`（稳定版） |
| 你已经有来自其他来源的计划（队友、外部 AI） | 使用 `/gsd-import` |

### 要求

- **运行时：** 仅支持 Claude Code。该命令在 Gemini CLI、Copilot CLI 和其他运行时中会报错退出。
- **版本：** Claude Code v2.1.91 或更高版本（必须设置 `$CLAUDE_CODE_VERSION` 环境变量）。
- **成本：** Pro 和 Max 订阅不收取额外费用。Ultraplan 已包含在内。

### 用法

```bash
/gsd-ultraplan-phase         # 为下一个未规划阶段使用 Ultraplan
/gsd-ultraplan-phase 2       # 为指定阶段编号使用 Ultraplan
```

| 参数 | 必需 | 说明 |
|----------|----------|-------------|
| `N` | 否 | 阶段编号（默认使用下一个未规划阶段） |

### 工作方式

1. **初始化** - GSD 运行标准的 plan-phase 初始化，确定要规划的阶段并确认前置条件。
2. **上下文组装** - GSD 读取该阶段的 `ROADMAP.md`、`REQUIREMENTS.md`，以及已有的 `RESEARCH.md`。这些上下文会被打包进结构化提示词中，这样 ultraplan 就能直接获得所需信息，而不需要你手动复制。
3. **返回路径指令** - 在启动 ultraplan 之前，GSD 会把导入命令打印到终端，这样在浏览器会话结束后仍能在滚动缓冲区里看到：

   ```
   完成后：/gsd-import --from <saved-plan 的路径>
   ```

4. **启动 Ultraplan** - `/ultraplan` 命令会把你带到浏览器。你可以使用大纲侧边栏和内联评论来审阅并优化草稿。
5. **保存计划** - 满意后点击 Claude Code 中的 **Cancel**。Claude Code 会把计划保存到本地文件并返回终端。
6. **导回 GSD** - 运行第 3 步中打印的导入命令：

   ```bash
   /gsd-import --from /path/to/saved-plan.md
   ```

   这会针对 `PROJECT.md` 执行冲突检测，将计划转换为 GSD 格式，用 `gsd-plan-checker` 验证，更新 `ROADMAP.md`，并提交；路径与任何外部计划导入一致。

### 产出物

| 步骤 | 输出 |
|------|--------|
| Ultraplan 之后 | 外部计划文件（由 Claude Code 保存） |
| `/gsd-import` 之后 | `.planning/phases/` 下的 `{phase}-{N}-PLAN.md` |

### 该命令不会做什么

- 直接写入 `PLAN.md` 文件 - 所有写入都通过 `/gsd-import` 完成
- 替代 `/gsd-plan-phase` - 本地规划不受影响，仍然是默认方式
- 运行研究代理 - 如果你需要先生成 `RESEARCH.md`，请先运行 `/gsd-plan-phase --skip-verify`，或先做一次仅研究流程，再使用这个命令

### 故障排除

**“ultraplan is not available in this runtime”**
你正在 Claude Code 之外运行 GSD。请切换到 Claude Code 终端会话，或者改用 `/gsd-plan-phase`。

**Ultraplan 浏览器会话没有打开**
检查 Claude Code 版本：`claude --version`。需要 v2.1.91+。使用 `claude update` 更新。

**`/gsd-import` 报告冲突**
Ultraplan 可能提出了与 `PROJECT.md` 中决策冲突的方案。导入步骤会在写入前提示你逐一解决这些冲突。

**导入后 plan checker 失败**
导入的计划存在结构问题。查看检查器输出，编辑保存的文件修复问题，然后重新运行 `/gsd-import --from <same-file>`。

### 相关命令

- [`/gsd-plan-phase`](COMMANDS.md#gsd-plan-phase) - 标准本地规划（稳定版，支持所有运行时）
- [`/gsd-import`](COMMANDS.md#gsd-import) - 将任意外部计划文件导入 GSD
