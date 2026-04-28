# Common Bug Patterns

在形成假设前先扫描这些常见 bug 模式的清单。按出现频率排序。先检查这些 —— 它们覆盖了各类技术栈中约 80% 的 bug。

<patterns>

## Null / Undefined Access

- **Null property access** — 在 `null` 或 `undefined` 上访问属性，缺少 null check 或 optional chaining
- **Missing return value** — 函数返回 `undefined` 而不是预期值，缺少 `return` 语句或分支错误
- **Destructuring null** — 在 `null`/`undefined` 上做数组/对象解构，API 返回的是错误形态而不是数据
- **Undefaulted optional** — 可选参数未设默认值就直接使用，调用方省略了参数

## Off-by-One / Boundary

- **Wrong loop bound** — 循环从 1 而不是 0 开始，或结束于 `length` 而不是 `length - 1`
- **Fence-post error** — “N 个项只需要 N-1 个分隔符” 的计数错误
- **Inclusive vs exclusive** — 范围边界 `<` 与 `<=`，以及 slice/substring 的结束索引
- **Empty collection** — `.length === 0` 时仍落入假定集合中有元素的逻辑

## Async / Timing

- **Missing await** — 调用 async function 时缺少 `await`，得到 Promise 对象而不是解析值
- **Race condition** — 两个异步操作在无协调的情况下读写同一状态
- **Stale closure** — callback 捕获的是旧变量值，而不是当前值
- **Initialization order** — setup 完成前 event handler 就触发了
- **Leaked timer** — timeout/interval 未清理，在 component/context 销毁后仍触发

## State Management

- **Shared mutation** — 原地修改 object/array，影响到其他消费者
- **Stale render** — state 已更新但 UI 未重新渲染，缺少响应式触发或引用错误
- **Stale handler state** — closure 捕获的是绑定时状态，而不是当前值
- **Dual source of truth** — 同一份数据存了两处，其中一处失同步
- **Invalid transition** — 状态机允许发生本该被 guard condition 阻止的迁移

## Import / Module

- **Circular dependency** — module A import B，B import A，其中一个得到 `undefined`
- **Export mismatch** — default 与 named export 不匹配，`import X` 和 `import { X }` 混用
- **Wrong extension** — `.js` vs `.cjs` vs `.mjs`，`.ts` vs `.tsx`
- **Path case sensitivity** — 在 Windows/macOS 可用，在 Linux 失败
- **Missing extension** — ESM 的 imports 需要显式文件扩展名

## Type / Coercion

- **String vs number compare** — `"5" > "10"` 是 `true`（字典序），`5 > 10` 是 `false`
- **Implicit coercion** — 用 `==` 而不是 `===`，遇到 truthy/falsy 陷阱（`0`, `""`, `[]`）
- **Numeric precision** — `0.1 + 0.2 !== 0.3`，大整数丢精度
- **Falsy valid value** — 值为 `0` 或 `""`，它是合法值但会被当作 falsy

## Environment / Config

- **Missing env var** — 环境变量缺失，或在 dev/prod/CI 中值不对
- **Hardcoded path** — 在一台机器上可用，换机器就失败
- **Port conflict** — 端口已被占用，之前的进程还在运行
- **Permission denied** — 部署中的 user/group 不同
- **Missing dependency** — 不在 package.json 中或未安装

## Data Shape / API Contract

- **Changed response shape** — backend 更新了，frontend 仍按旧格式读取
- **Wrong container type** — 本该是 object 却给了 array，或反之；`data` vs `data.results` vs `data[0]`
- **Missing required field** — payload 缺少必填字段，backend 返回校验错误
- **Date format mismatch** — ISO string、timestamp 与 locale string 不一致
- **Encoding mismatch** — UTF-8 vs Latin-1、URL encoding、HTML entities 不一致

## Regex / String

- **Sticky lastIndex** — regex 带 `g` 标志时先 `.test()` 再 `.exec()`，调用间 `lastIndex` 未重置
- **Missing escape** — `.` 匹配任意字符，`$` 是特殊符号，反斜杠需要双重转义
- **Greedy overmatch** — `.*` 吃掉了分隔符，应该用 `.*?`
- **Wrong quote type** — 字符串插值需要模板字面量反引号

## Error Handling

- **Swallowed error** — 空 `catch {}`，或只是记录日志却不 rethrow/handle
- **Wrong error type** — 捕获基类 `Error`，而实际上需要特定错误类型
- **Error in handler** — 清理代码本身抛错，掩盖原始错误
- **Unhandled rejection** — 缺少 `.catch()` 或 `await` 外层的 try/catch

## Scope / Closure

- **Variable shadowing** — 内层作用域声明同名变量，遮蔽了外层变量
- **Loop variable capture** — 所有 closures 共享同一个 `var i`，应使用 `let` 或 bind
- **Lost this binding** — callback 丢失上下文，需要 `.bind()` 或 arrow function
- **Scope confusion** — `var` 提升到函数级，`let`/`const` 是块级作用域

</patterns>

<usage>

## How to Use This Checklist

1. **在形成任何假设之前**，先根据症状扫描相关类别
2. **将症状映射到模式** — 例如 bug 涉及 “undefined is not an object”，就先查 Null/Undefined
3. **每个被检查的模式都是一个候选假设** — 用证据验证或排除它
4. **如果没有模式匹配**，再进入开放式调查

### Symptom-to-Category Quick Map

| Symptom | Check First |
|---------|------------|
| `Cannot read property of undefined/null` | Null/Undefined Access |
| `X is not a function` | Import/Module, Type/Coercion |
| 有时能用，有时失败 | Async/Timing, State Management |
| 本地可用，CI/prod 失败 | Environment/Config |
| 显示了错误数据 | Data Shape, State Management |
| 多一个/少一个条目，或丢了最后一项 | Off-by-One/Boundary |
| `Unexpected token` / parse error | Data Shape, Type/Coercion |
| 内存泄漏 / 资源占用不断增加 | Async/Timing（cleanup）, Scope/Closure |
| 无限循环 / max call stack | State Management, Async/Timing |

</usage>
