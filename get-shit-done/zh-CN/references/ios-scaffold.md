# iOS App Scaffold Reference

用于搭建 iOS 应用脚手架的规则与模式。只要某个 plan 涉及创建新的 iOS app target，就应用这份参考。

---

## Critical Rule: Never Use Package.swift as the Primary Build System for iOS Apps

**绝不要使用带 `.executableTarget`（或 `.target`）的 `Package.swift` 来搭建 iOS app。** Swift Package Manager 的 executable targets 会编译成 macOS command-line tools —— 它们不会产出 `.app` bundles，不能为 iOS 设备签名，也不能提交到 App Store。

**Prohibited pattern:**
```swift
// Package.swift — DO NOT USE for iOS apps
.executableTarget(name: "MyApp", dependencies: [])
// or
.target(name: "MyApp", dependencies: [])
```

使用这种模式会得到一个 macOS CLI binary，而不是 iOS app。该 app 无法为任何 iOS simulator 或 device 构建。

---

## Required Pattern: XcodeGen

所有 iOS app 脚手架都**必须**使用 XcodeGen 来生成 `.xcodeproj`。

### Step 1 — Install XcodeGen (if not present)

```bash
brew install xcodegen
```

### Step 2 — Create `project.yml`

`project.yml` 是描述项目结构的 XcodeGen spec。最小可用配置如下：

```yaml
name: MyApp
options:
  bundleIdPrefix: com.example
  deploymentTarget:
    iOS: "17.0"
settings:
  SWIFT_VERSION: "5.10"
  IPHONEOS_DEPLOYMENT_TARGET: "17.0"
targets:
  MyApp:
    type: application
    platform: iOS
    sources: [Sources/MyApp]
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.example.MyApp
      INFOPLIST_FILE: Sources/MyApp/Info.plist
    scheme:
      testTargets:
        - MyAppTests
  MyAppTests:
    type: bundle.unit-test
    platform: iOS
    sources: [Tests/MyAppTests]
    dependencies:
      - target: MyApp
```

### Step 3 — Generate the .xcodeproj

```bash
xcodegen generate
```

这会在项目根目录创建 `MyApp.xcodeproj`。提交 `project.yml`，但把 `*.xcodeproj` 加到 `.gitignore` 中（checkout 后可重新生成）。

### Step 4 — Standard project layout

```
MyApp/
├── project.yml              # XcodeGen spec — commit this
├── .gitignore               # includes *.xcodeproj
├── Sources/
│   └── MyApp/
│       ├── MyAppApp.swift   # @main entry point
│       ├── ContentView.swift
│       └── Info.plist
└── Tests/
    └── MyAppTests/
        └── MyAppTests.swift
```

---

## iOS Deployment Target Compatibility

使用任何 SwiftUI component 之前，始终根据项目的 `IPHONEOS_DEPLOYMENT_TARGET` 验证其 API 可用性。

| API | Minimum iOS |
|-----|-------------|
| `NavigationView` | iOS 13 |
| `NavigationStack` | iOS 16 |
| `NavigationSplitView` | iOS 16 |
| `List(selection:)` with multi-select | iOS 17 |
| `ScrollView` scroll position APIs | iOS 17 |
| `Observable` macro (`@Observable`) | iOS 17 |
| `SwiftData` | iOS 17 |
| `@Bindable` | iOS 17 |
| `TipKit` | iOS 17 |

**Rule:** 如果某个 plan 需要使用的 SwiftUI API 超出项目 deployment target，有两种做法：
1. 在 `project.yml` 中提升 deployment target（并记录该决策），或
2. 用 `if #available(iOS NN, *) { ... }` 包裹调用，并提供 fallback implementation。

不要悄悄使用高于已声明 deployment target 的 API —— app 会在旧设备上运行时崩溃。

---

## Verification

运行 `xcodegen generate` 后，验证项目可以成功构建：

```bash
xcodebuild -project MyApp.xcodeproj -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' build
```

成功构建（exit code 0）即可确认该 scaffold 对 iOS 有效。
