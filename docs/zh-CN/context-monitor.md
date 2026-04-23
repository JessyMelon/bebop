# 上下文窗口监控器

一个工具后置钩子（Claude Code 使用 `PostToolUse`，Gemini CLI 使用 `AfterTool`），用于在上下文窗口使用率过高时提醒代理。

## 问题

状态栏会把上下文使用情况显示给**用户**，但**代理**并不知道上下文限制。上下文快用完时，代理仍会继续工作，直到撞墙为止，可能在任务中途就停下，而且状态还没来得及保存。

## 工作方式

1. 状态栏钩子把上下文指标写入 `/tmp/claude-ctx-{session_id}.json`
2. 每次使用工具后，上下文监控器读取这些指标
3. 当剩余上下文低于阈值时，它会作为 `additionalContext` 注入提醒
4. 代理会在对话中收到提醒，并据此采取行动

## 阈值

| 等级 | 剩余比例 | 代理行为 |
|-------|-----------|----------------|
| 正常 | > 35% | 不提示 |
| WARNING | <= 35% | 收尾当前任务，避免开始新的复杂工作 |
| CRITICAL | <= 25% | 立即停止，保存状态（`/gsd-pause-work`） |

## 去抖动

为了避免重复警告刷屏：
- 第一次警告总是立即触发
- 后续警告之间至少间隔 5 次工具使用
- 严重级别升级（WARNING -> CRITICAL）会绕过去抖动

## 架构

```text
状态栏钩子 (gsd-statusline.js)
    | 写入
    v
/tmp/claude-ctx-{session_id}.json
    ^ 读取
    |
上下文监控器 (gsd-context-monitor.js, PostToolUse/AfterTool)
    | 注入
    v
additionalContext -> 代理看到提醒
```

桥接文件是一个简单的 JSON 对象：

```json
{
  "session_id": "abc123",
  "remaining_percentage": 28.5,
  "used_pct": 71,
  "timestamp": 1708200000
}
```

## 与 GSD 的集成

GSD 的 `/gsd-pause-work` 命令会保存执行状态。WARNING 提示会建议使用它。CRITICAL 提示会要求立即保存状态。

## 设置

这两个钩子会在 `npx get-shit-done-cc` 安装期间自动注册：

- **状态栏**（写入桥接文件）：在 `settings.json` 中注册为 `statusLine`
- **上下文监控器**（读取桥接文件）：在 `settings.json` 中注册为 `PostToolUse` 钩子（Gemini 使用 `AfterTool`）

在 `~/.claude/settings.json` 中手动注册（Claude Code）：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hooks/gsd-statusline.js"
  },
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/gsd-context-monitor.js"
          }
        ]
      }
    ]
  }
}
```

对于 Gemini CLI（`~/.gemini/settings.json`），请使用 `AfterTool` 代替 `PostToolUse`：

```json
{
  "hooks": {
    "AfterTool": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.gemini/hooks/gsd-context-monitor.js"
          }
        ]
      }
    ]
  }
}
```

## 安全性

- 钩子会用 `try/catch` 包住所有逻辑，并在出错时静默退出
- 它永远不会阻塞工具执行 - 监控器坏掉也不应影响代理工作流
- 过期指标（超过 60 秒）会被忽略
- 缺失的桥接文件会被优雅处理（子代理、新会话）
