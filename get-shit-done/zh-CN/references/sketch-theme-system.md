# 共享主题系统

所有 sketch 共用一套 CSS 变量主题，这样设计决策可以在多个 sketch 之间累计生效。

## 设置

在第一个 sketch 中，创建带默认主题的 `.planning/sketches/themes/`：

```
.planning/sketches/
  themes/
    default.css         <- 所有 sketches 都链接到这里
  001-dashboard-layout/
    index.html          <- 链接到 ../themes/default.css
```

## 主题文件结构

每个主题只定义 CSS 自定义属性，不包含组件样式或布局规则。只保留视觉词汇：

```css
:root {
  /* Colors */
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-border: #e5e5e5;
  --color-text: #1a1a1a;
  --color-text-muted: #6b6b6b;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-accent: #f59e0b;
  --color-danger: #ef4444;
  --color-success: #22c55e;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Shapes */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}
```

根据 intake 阶段确定的氛围/方向调整默认主题。上面的值只是起点，可以修改颜色、字体、间距和形状，以匹配约定好的审美。

## 链接方式

每个 sketch 都链接到主题：

```html
<link rel="stylesheet" href="../themes/default.css">
```

## 创建新主题

当某个 sketch 暴露出审美分叉（例如 “应该更冷静还是更温暖？”）时，不要争论，直接把两种方案都做成主题文件。用户可以切换并直观感受差异。

为主题起描述性名称：`midnight.css`、`warm-minimal.css`、`brutalist.css`。

## 主题切换器

每个 sketch 都要包含（作为 sketch toolbar 的一部分）：

```html
<select id="theme-switcher" onchange="document.querySelector('link[href*=themes]').href='../themes/'+this.value+'.css'">
  <option value="default">Default</option>
</select>
```

通过列出可用主题文件来动态填充选项，或者直接硬编码已知主题。
