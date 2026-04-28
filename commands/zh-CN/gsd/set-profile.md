---
name: gsd:set-profile
description: 为 GSD agents 切换模型配置档位（quality/balanced/budget/inherit）
argument-hint: <profile (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
---

向用户原样显示以下输出，不要添加任何额外说明：

!`if ! command -v gsd-sdk >/dev/null 2>&1; then printf '⚠ gsd-sdk not found in PATH — /gsd-set-profile requires it.\n\nInstall the GSD SDK:\n  npm install -g @gsd-build/sdk\n\nOr update GSD to get the latest packages:\n  /gsd-update\n'; exit 1; fi; gsd-sdk query config-set-model-profile $ARGUMENTS --raw`
