# 研究模板

用于 `.planning/phases/XX-name/{phase_num}-RESEARCH.md` 的模板 - 在规划前进行全面生态研究。

**目的：** 记录 Claude 为了把某个阶段做好而需要了解的内容 - 不只是“用哪个库”，而是“专家会如何构建这件事”。

---

## 文件模板

```markdown
# 阶段 [X]：[Name] - 研究

**研究时间：** [date]
**领域：** [主要技术/问题领域]
**置信度：** [HIGH/MEDIUM/LOW]

<user_constraints>
## 用户约束（来自 CONTEXT.md）

**CRITICAL:** 如果存在由 /gsd-discuss-phase 生成的 CONTEXT.md，请将其中锁定的决策逐字复制到这里。规划器必须遵守这些决策。

### 已锁定决策
[从 CONTEXT.md 的 `## Decisions` 部分复制 - 这些是不可协商的]
- [Decision 1]
- [Decision 2]

### Claude 可自行决定的部分
[从 CONTEXT.md 复制 - 研究者/规划者可自行决定的区域]
- [Area 1]
- [Area 2]

### 延后想法（OUT OF SCOPE）
[从 CONTEXT.md 复制 - 不要研究或规划这些内容]
- [Deferred 1]
- [Deferred 2]

**如果不存在 CONTEXT.md：** 写入 "No user constraints - all decisions at Claude's discretion"
</user_constraints>

<architectural_responsibility_map>
## 架构职责映射

在深入框架研究之前，先将每个阶段能力映射到其标准架构分层责任归属。这样可以防止错误的分层归属继续传递到计划中。

| 能力 | 主要层级 | 次要层级 | 理由 |
|------------|-------------|----------------|-----------|
| [来自阶段描述的能力] | [Browser/Client, Frontend Server, API/Backend, CDN/Static, or Database/Storage] | [secondary tier or —] | [为什么由该层负责] |

**如果是单层应用：** 写入 "Single-tier application — all capabilities reside in [tier]"，并省略表格。
</architectural_responsibility_map>

<research_summary>
## 摘要

[2-3 段执行摘要]
- 研究了什么
- 标准做法是什么
- 关键建议是什么

**主要建议：** [一句话、可执行的指导]
</research_summary>

<standard_stack>
## 标准技术栈

该领域已建立的库/工具：

### 核心
| 库 | 版本 | 用途 | 为何是标准方案 |
|---------|---------|---------|--------------|
| [name] | [ver] | [做什么] | [为什么专家会用它] |
| [name] | [ver] | [做什么] | [为什么专家会用它] |

### 支撑工具
| 库 | 版本 | 用途 | 何时使用 |
|---------|---------|---------|-------------|
| [name] | [ver] | [做什么] | [适用场景] |
| [name] | [ver] | [做什么] | [适用场景] |

### 已考虑的替代方案
| 当前方案 | 可替代方案 | 权衡 |
|------------|-----------|----------|
| [standard] | [alternative] | [替代方案何时有意义] |

**安装：**
```bash
npm install [packages]
# or
yarn add [packages]
```
</standard_stack>

<architecture_patterns>
## 架构模式

### 系统架构图

架构图必须展示数据如何流经概念组件，而不是文件清单。

要求：
- 展示入口点（数据/请求如何进入系统）
- 展示处理阶段（发生了哪些转换、顺序如何）
- 展示决策点和分支路径
- 展示外部依赖和服务边界
- 用箭头表示数据流方向
- 读者应能沿箭头从输入追踪到输出，理解主要用例

文件到实现的映射应放在 Component Responsibilities 表中，而不是图里。

### 推荐项目结构
```
src/
├── [folder]/        # [用途]
├── [folder]/        # [用途]
└── [folder]/        # [用途]
```

### 模式 1：[Pattern Name]
**是什么：** [描述]
**何时使用：** [条件]
**示例：**
```typescript
// [来自 Context7/官方文档的代码示例]
```

### 模式 2：[Pattern Name]
**是什么：** [描述]
**何时使用：** [条件]
**示例：**
```typescript
// [代码示例]
```

### 应避免的反模式
- **[反模式]：** [为什么不好，应该怎么做]
- **[反模式]：** [为什么不好，应该怎么做]
</architecture_patterns>

<dont_hand_roll>
## 不要手搓

看起来简单、但其实已有成熟方案的问题：

| 问题 | 不要自己造 | 改用 | 原因 |
|---------|-------------|-------------|-----|
| [problem] | [你会自己造的东西] | [library] | [边界情况、复杂度] |
| [problem] | [你会自己造的东西] | [library] | [边界情况、复杂度] |
| [problem] | [你会自己造的东西] | [library] | [边界情况、复杂度] |

**关键洞察：** [为什么在这个领域自定义方案更差]
</dont_hand_roll>

<common_pitfalls>
## 常见陷阱

### 陷阱 1：[Name]
**会出什么问题：** [描述]
**为什么会发生：** [根因]
**如何避免：** [预防策略]
**预警信号：** [如何及早发现]

### 陷阱 2：[Name]
**会出什么问题：** [描述]
**为什么会发生：** [根因]
**如何避免：** [预防策略]
**预警信号：** [如何及早发现]

### 陷阱 3：[Name]
**会出什么问题：** [描述]
**为什么会发生：** [根因]
**如何避免：** [预防策略]
**预警信号：** [如何及早发现]
</common_pitfalls>

<code_examples>
## 代码示例

来自官方来源、已验证的模式：

### [常见操作 1]
```typescript
// Source: [Context7/official docs URL]
[code]
```

### [常见操作 2]
```typescript
// Source: [Context7/official docs URL]
[code]
```

### [常见操作 3]
```typescript
// Source: [Context7/official docs URL]
[code]
```
</code_examples>

<sota_updates>
## 最新实践（2024-2025）

最近有哪些变化：

| 旧方案 | 当前方案 | 何时变化 | 影响 |
|--------------|------------------|--------------|--------|
| [old] | [new] | [date/version] | [对实现意味着什么] |

**值得考虑的新工具/模式：**
- [Tool/Pattern]: [它带来了什么、何时使用]
- [Tool/Pattern]: [它带来了什么、何时使用]

**已弃用/过时：**
- [Thing]: [为什么过时、被什么替代]
</sota_updates>

<open_questions>
## 未决问题

尚未完全解决的问题：

1. **[Question]**
   - 已知内容：[部分信息]
   - 不清楚的地方：[缺口]
   - 建议：[规划/执行期间如何处理]

2. **[Question]**
   - 已知内容：[部分信息]
   - 不清楚的地方：[缺口]
   - 建议：[如何处理]
</open_questions>

<sources>
## 来源

### 一级来源（HIGH confidence）
- [Context7 library ID] - [获取了哪些主题]
- [Official docs URL] - [检查了什么]

### 二级来源（MEDIUM confidence）
- [WebSearch verified with official source] - [发现内容 + 验证方式]

### 三级来源（LOW confidence - needs validation）
- [WebSearch only] - [发现内容，标记为实现时验证]
</sources>

<metadata>
## 元数据

**研究范围：**
- 核心技术：[什么]
- 生态：[探索了哪些库]
- 模式：[研究了哪些模式]
- 陷阱：[检查了哪些领域]

**置信度拆分：**
- 标准技术栈：[HIGH/MEDIUM/LOW] - [原因]
- 架构：[HIGH/MEDIUM/LOW] - [原因]
- 陷阱：[HIGH/MEDIUM/LOW] - [原因]
- 代码示例：[HIGH/MEDIUM/LOW] - [原因]

**研究日期：** [date]
**有效期至：** [estimate - 稳定技术 30 天，变化快的技术 7 天]
</metadata>

---

*阶段：XX-name*
*研究完成时间：[date]*
*可进入规划：[yes/no]*
```

---

## 良好示例

```markdown
# 阶段 3：3D City Driving - 研究

**研究时间：** 2025-01-20
**领域：** 带驾驶机制的 Three.js 3D Web 游戏
**置信度：** HIGH

<research_summary>
## 摘要

研究了用于构建 3D 城市驾驶游戏的 Three.js 生态。标准做法是使用 Three.js + React Three Fiber 作为组件架构，Rapier 负责物理，drei 提供常用辅助能力。

关键发现：不要自己手写物理或碰撞检测。Rapier（通过 @react-three/rapier）能高效处理车辆物理、地形碰撞和城市物体交互。自定义物理代码会带来 bug 和性能问题。

**主要建议：** 使用 R3F + Rapier + drei 组合。从 drei 的 vehicle controller 开始，加入 Rapier 车辆物理，并用 instanced meshes 构建城市以获得更好性能。
</research_summary>

<standard_stack>
## 标准技术栈

### 核心
| 库 | 版本 | 用途 | 为何是标准方案 |
|---------|---------|---------|--------------|
| three | 0.160.0 | 3D 渲染 | Web 3D 的标准方案 |
| @react-three/fiber | 8.15.0 | Three.js 的 React 渲染器 | 声明式 3D，更好的 DX |
| @react-three/drei | 9.92.0 | 辅助工具和抽象 | 解决常见问题 |
| @react-three/rapier | 1.2.1 | 物理引擎绑定 | R3F 最佳物理方案 |

### 支撑工具
| 库 | 版本 | 用途 | 何时使用 |
|---------|---------|---------|-------------|
| @react-three/postprocessing | 2.16.0 | 视觉特效 | Bloom、DOF、运动模糊 |
| leva | 0.9.35 | 调试 UI | 调参 |
| zustand | 4.4.7 | 状态管理 | 游戏状态、UI 状态 |
| use-sound | 4.0.1 | 音频 | 引擎声、环境音 |

### 已考虑的替代方案
| 当前方案 | 可替代方案 | 权衡 |
|------------|-----------|----------|
| Rapier | Cannon.js | Cannon 更简单，但在车辆场景下性能更差 |
| R3F | Vanilla Three | 若不用 React 可选 Vanilla，但 R3F 的 DX 好得多 |
| drei | Custom helpers | drei 已久经考验，不要重复造轮子 |

**安装：**
```bash
npm install three @react-three/fiber @react-three/drei @react-three/rapier zustand
```
</standard_stack>

<architecture_patterns>
## 架构模式

### 系统架构图

架构图必须展示数据如何流经概念组件，而不是文件清单。

要求：
- 展示入口点（数据/请求如何进入系统）
- 展示处理阶段（发生了哪些转换、顺序如何）
- 展示决策点和分支路径
- 展示外部依赖和服务边界
- 用箭头表示数据流方向
- 读者应能沿箭头从输入追踪到输出，理解主要用例

文件到实现的映射应放在 Component Responsibilities 表中，而不是图里。

### 推荐项目结构
```
src/
├── components/
│   ├── Vehicle/          # 带物理的玩家车辆
│   ├── City/             # 城市生成和建筑
│   ├── Road/             # 道路网络
│   └── Environment/      # 天空、光照、雾
├── hooks/
│   ├── useVehicleControls.ts
│   └── useGameState.ts
├── stores/
│   └── gameStore.ts      # Zustand 状态
└── utils/
    └── cityGenerator.ts  # 程序化生成辅助函数
```

### 模式 1：Vehicle with Rapier Physics
**是什么：** 使用带车辆专用设置的 RigidBody，而不是自定义物理
**何时使用：** 任意地面车辆
**示例：**
```typescript
// Source: @react-three/rapier docs
import { RigidBody, useRapier } from '@react-three/rapier'

function Vehicle() {
  const rigidBody = useRef()

  return (
    <RigidBody
      ref={rigidBody}
      type="dynamic"
      colliders="hull"
      mass={1500}
      linearDamping={0.5}
      angularDamping={0.5}
    >
      <mesh>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial />
      </mesh>
    </RigidBody>
  )
}
```

### 模式 2：Instanced Meshes for City
**是什么：** 对重复对象（建筑、树、道具）使用 InstancedMesh
**何时使用：** >100 个相似对象
**示例：**
```typescript
// Source: drei docs
import { Instances, Instance } from '@react-three/drei'

function Buildings({ positions }) {
  return (
    <Instances limit={1000}>
      <boxGeometry />
      <meshStandardMaterial />
      {positions.map((pos, i) => (
        <Instance key={i} position={pos} scale={[1, Math.random() * 5 + 1, 1]} />
      ))}
    </Instances>
  )
}
```

### 应避免的反模式
- **在 render loop 中创建 meshes：** 只创建一次，之后只更新 transform
- **不使用 InstancedMesh：** 为每栋建筑使用独立 mesh 会拖垮性能
- **自定义物理计算：** Rapier 每次都会做得更好
</architecture_patterns>

<dont_hand_roll>
## 不要手搓

| 问题 | 不要自己造 | 改用 | 原因 |
|---------|-------------|-------------|-----|
| Vehicle physics | Custom velocity/acceleration | Rapier RigidBody | 轮胎摩擦、悬挂、碰撞都很复杂 |
| Collision detection | Raycasting everything | Rapier colliders | 性能、边界情况、穿透问题 |
| Camera follow | Manual lerp | drei CameraControls or custom with useFrame | 平滑插值、边界控制 |
| City generation | Pure random placement | Grid-based with noise for variation | 纯随机看起来不对，网格更可控 |
| LOD | Manual distance checks | drei <Detailed> | 可处理过渡和滞后 |

**关键洞察：** 3D 游戏开发里，40 多年的大量问题都已有成熟解法。Rapier 实现了正确的物理模拟，drei 实现了正确的 3D 辅助能力。对抗这些成熟方案，最终会得到看似“手感问题”、实则是物理边界 bug 的结果。
</dont_hand_roll>

<common_pitfalls>
## 常见陷阱

### 陷阱 1：Physics Tunneling
**会出什么问题：** 高速物体穿墙
**为什么会发生：** 默认物理步长相对于速度过大
**如何避免：** 在 Rapier 中启用 CCD（Continuous Collision Detection）
**预警信号：** 物体随机出现在建筑外部

### 陷阱 2：Performance Death by Draw Calls
**会出什么问题：** 建筑一多，游戏就开始卡顿
**为什么会发生：** 每个 mesh = 1 次 draw call，几百栋建筑 = 几百次调用
**如何避免：** 对相似对象使用 InstancedMesh，合并静态几何体
**预警信号：** GPU 成为瓶颈，即便场景简单 FPS 也很低

### 陷阱 3：Vehicle "Floaty" Feel
**会出什么问题：** 汽车缺乏贴地感
**为什么会发生：** 缺少合适的车轮/悬挂模拟
**如何避免：** 使用 Rapier 车辆控制器，或谨慎调节 mass/damping
**预警信号：** 车会奇怪地弹跳，过弯抓地力差
</common_pitfalls>

<code_examples>
## 代码示例

### 基础 R3F + Rapier 设置
```typescript
// Source: @react-three/rapier getting started
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'

function Game() {
  return (
    <Canvas>
      <Physics gravity={[0, -9.81, 0]}>
        <Vehicle />
        <City />
        <Ground />
      </Physics>
    </Canvas>
  )
}
```

### 车辆控制 Hook
```typescript
// Source: Community pattern, verified with drei docs
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'

function useVehicleControls(rigidBodyRef) {
  const [, getKeys] = useKeyboardControls()

  useFrame(() => {
    const { forward, back, left, right } = getKeys()
    const body = rigidBodyRef.current
    if (!body) return

    const impulse = { x: 0, y: 0, z: 0 }
    if (forward) impulse.z -= 10
    if (back) impulse.z += 5

    body.applyImpulse(impulse, true)

    if (left) body.applyTorqueImpulse({ x: 0, y: 2, z: 0 }, true)
    if (right) body.applyTorqueImpulse({ x: 0, y: -2, z: 0 }, true)
  })
}
```
</code_examples>

<sota_updates>
## 最新实践（2024-2025）

| 旧方案 | 当前方案 | 何时变化 | 影响 |
|--------------|------------------|--------------|--------|
| cannon-es | Rapier | 2023 | Rapier 更快，维护更好 |
| vanilla Three.js | React Three Fiber | 2020+ | R3F 现在已是 React 应用标准 |
| Manual InstancedMesh | drei <Instances> | 2022 | API 更简单，也能处理更新 |

**值得考虑的新工具/模式：**
- **WebGPU:** 正在到来，但对游戏来说截至 2025 年仍未准备好用于生产
- **drei Gltf helpers:** 使用 `<useGLTF.preload>` 做加载界面

**已弃用/过时：**
- **cannon.js (original):** 使用 cannon-es 分叉版，或者更好地直接用 Rapier
- **Manual raycasting for physics:** 直接用 Rapier colliders
</sota_updates>

<sources>
## 来源

### 一级来源（HIGH confidence）
- /pmndrs/react-three-fiber - getting started、hooks、performance
- /pmndrs/drei - instances、controls、helpers
- /dimforge/rapier-js - physics setup、vehicle physics

### 二级来源（MEDIUM confidence）
- Three.js discourse 中关于 “city driving game” 的讨论串 - 已对照文档验证模式
- R3F examples 仓库 - 已验证代码可工作

### 三级来源（LOW confidence - needs validation）
- None - 所有发现都已验证
</sources>

<metadata>
## 元数据

**研究范围：**
- 核心技术：Three.js + React Three Fiber
- 生态：Rapier、drei、zustand
- 模式：车辆物理、实例化、城市生成
- 陷阱：性能、物理、手感

**置信度拆分：**
- 标准技术栈：HIGH - 已通过 Context7 验证，且广泛使用
- 架构：HIGH - 来自官方示例
- 陷阱：HIGH - 在 discourse 中有记录，并已在文档中验证
- 代码示例：HIGH - 来自 Context7/官方来源

**研究日期：** 2025-01-20
**有效期至：** 2025-02-20（30 天 - R3F 生态较稳定）
</metadata>

---

*阶段：03-city-driving*
*研究完成时间：2025-01-20*
*可进入规划：yes*
```

---

## 指南

**何时创建：**
- 在为小众/复杂领域做阶段规划之前
- 当 Claude 的训练数据可能已经过时或覆盖不足时
- 当“专家如何做这件事”比“用哪个库”更重要时

**结构：**
- 使用 XML 标签作为分段标记（与 GSD 模板一致）
- 七个核心部分：summary、standard_stack、architecture_patterns、dont_hand_roll、common_pitfalls、code_examples、sources
- 所有部分都是必需的（推动全面研究）

**内容质量：**
- 标准技术栈：给出具体版本，不只是名称
- 架构：包含来自权威来源的真实代码示例
- 不要手搓：明确指出哪些问题**不要**自己解决
- 陷阱：包含预警信号，而不只是“别这么做”
- 来源：诚实标注置信度

**与规划的集成：**
- RESEARCH.md 会在 PLAN.md 中作为 `@context` 引用加载
- 标准技术栈影响库的选择
- 不要手搓防止自定义方案
- 陷阱影响验证标准
- 代码示例可在任务 action 中引用

**创建后：**
- 文件位于阶段目录：`.planning/phases/XX-name/{phase_num}-RESEARCH.md`
- 在规划工作流中被引用
- 存在时 `plan-phase` 会自动加载它
