# GSD 架构

> 面向贡献者和高级用户的系统架构说明。面向使用者的内容请参阅 [FEATURES.md](FEATURES.md) 或 [USER-GUIDE.md](USER-GUIDE.md)。

---

## 目录

- [系统总览](#系统总览)
- [设计原则](#设计原则)
- [组件架构](#组件架构)
- [代理模型](#代理模型)
- [数据流](#数据流)
- [文件系统布局](#文件系统布局)
- [安装器架构](#安装器架构)
- [Hook 系统](#hook-系统)
- [CLI 工具层](#cli-工具层)
- [运行时抽象](#运行时抽象)

---

## 系统总览

GSD 是一个 **元提示框架**，位于用户和 AI 编码代理（Claude Code、Gemini CLI、OpenCode、Kilo、Codex、Copilot、Antigravity、Trae、Cline、Augment Code）之间。它提供：

1. **上下文工程** - 为每个任务提供结构化工件，让 AI 拿到所需的一切
2. **多代理编排** - 轻量编排器启动带有新上下文窗口的专门代理
3. **规格驱动开发** - 需求 → 研究 → 计划 → 执行 → 验证 的流水线
4. **状态管理** - 跨会话、跨上下文重置的持久化项目记忆

```text
用户 → 命令层 → 工作流层 → 代理层 → CLI 工具层 → .planning/ 文件系统
```

---

## 设计原则

### 1. 每个代理都有新上下文

每个被编排器启动的代理都会获得干净的上下文窗口（最多 200K tokens），避免上下文腐化。

### 2. 编排器保持轻薄

工作流文件只负责加载上下文、启动专门代理、收集结果并更新状态。

### 3. 基于文件的状态

所有状态都存放在 `.planning/` 中，以可读的 Markdown 和 JSON 形式保存。

### 4. 缺省即启用

工作流开关采用“缺省即启用”模式，未配置时默认为 `true`。

### 5. 多层防御

通过计划校验、原子提交、执行后验证和 UAT 形成多层质量门禁。

---

## 组件架构

### Commands（`commands/gsd/*.md`）

用户入口。每个文件包含 YAML frontmatter 和提示主体。

### Workflows（`get-shit-done/workflows/*.md`）

命令引用的编排逻辑，负责步骤、门禁、状态更新和恢复。

### Agents（`agents/*.md`）

专门代理定义，规定角色、工具和输出。

### References（`get-shit-done/references/*.md`）

工作流和代理共享的知识文档。

### Templates（`get-shit-done/templates/`）

用于生成计划、总结、验证文档的模板。

### Hooks（`hooks/`）

与宿主 AI 运行时集成的钩子，例如状态栏和上下文监控。

---

## 文件布局

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/config.json`
- `.planning/phases/`
- `.planning/research/`

---

## 代理模型

每个编排器都会启动一组职责明确的代理，并给它们分配新上下文窗口。这样可以把研究、规划、执行、验证拆开，避免单个上下文越滚越臃肿。

### 典型流程

1. 编排器读取项目工件
2. 启动专门代理
3. 代理把结果写回磁盘
4. 编排器再读取结果并决定下一步

## 数据流

```text
用户输入 -> 命令文件 -> 工作流文件 -> 专门代理 -> 工件写入磁盘 -> 后续工作流读取
```

关键点：
- 工件是主要状态载体
- 代理之间不共享可变内存
- 所有重要决策都会落盘

## Hook 系统

GSD 的 hooks 用于上下文监控、状态栏展示和更新提醒。

| Hook | 事件 | 作用 |
|------|------|------|
| `gsd-statusline.js` | `statusLine` | 显示模型、任务、目录和上下文使用率 |
| `gsd-context-monitor.js` | `PostToolUse` / `AfterTool` | 在剩余上下文不足时注入提醒 |
| `gsd-check-update.js` | `SessionStart` | 启动更新检查 |

## CLI 工具层

CLI 工具层负责配置解析、模型解析、阶段定位、模板生成和验证。工作流通常优先使用 `gsd-sdk query`，而不是直接拼长 Bash 命令。

## 运行时抽象

GSD 可以适配不同运行时，但会尽量保留同一套工作流语义。差异通常体现在：

- 命令前缀（slash command、skill、rules）
- hook 事件名
- 配置文件位置
- 安装目录和路径约定

> 本文件后续仍可继续扩展到安装器和运行时映射的完整细节。
