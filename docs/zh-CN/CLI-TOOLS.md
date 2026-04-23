# GSD CLI 工具参考

> `get-shit-done/bin/gsd-tools.cjs`（旧版 Node CLI）的接口概览。工作流和代理在有对应处理器时应优先使用 `gsd-sdk query` 或 `@gsd-build/sdk`。slash 命令与用户流程请参阅 [COMMANDS.md](COMMANDS.md)。

---

## 概览

`gsd-tools.cjs` 统一处理 GSD 命令、工作流和代理中的配置解析、模型解析、阶段查找、git 提交、摘要验证、状态管理和模板操作。

| 项目 | 说明 |
|------|------|
| **发布路径** | `get-shit-done/bin/gsd-tools.cjs` |
| **实现** | `get-shit-done/bin/lib/` 下的 20 个领域模块（该目录为权威来源） |
| **状态** | 仅为兼容性测试和 CJS 入口保留；新编排推荐使用 `gsd-sdk query` / SDK registry |

**用法（CJS）：**

```bash
node gsd-tools.cjs <command> [args] [--raw] [--cwd <path>]
```

**全局标志（CJS）：**

| 标志 | 说明 |
|------|------|
| `--raw` | 机器可读输出（JSON 或纯文本，不做格式化） |
| `--cwd <path>` | 覆盖工作目录（用于隔离子代理） |
| `--ws <name>` | 工作流上下文（SDK 启动该二进制时也会识别） |

---

## SDK 和程序化访问

编写工作流时使用这里的方式；如果你只是想看命令列表，可直接跳过。

### 1. CLI - `gsd-sdk query <argv…>`

- 使用与类型化 registry 相同的 **最长前缀** 规则解析 argv。
- 未注册命令会 **快速失败**。

### 2. TypeScript - `@gsd-build/sdk`

- `GSDTools` 仍通过 `execFile` 调用 `gsd-tools.cjs`，不是进程内 registry。
- 若要进行类型化、进程内分发，请使用 `createRegistry()` 或 `gsd-sdk query`。

### CJS → SDK 示例

| 旧 CJS | 推荐 `gsd-sdk query` |
|------|------|
| `node gsd-tools.cjs init phase-op 12` | `gsd-sdk query init phase-op 12` |
| `node gsd-tools.cjs phase-plan-index 12` | `gsd-sdk query phase-plan-index 12` |
| `node gsd-tools.cjs state json` | `gsd-sdk query state json` |
| `node gsd-tools.cjs roadmap analyze` | `gsd-sdk query roadmap analyze` |

> 其余命令分组可继续按需补全；本版先覆盖工具层主干。
