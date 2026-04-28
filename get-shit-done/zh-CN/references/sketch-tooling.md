# Sketch 工具栏

每个 sketch 都包含一个小型悬浮工具栏。它提供实用功能，但不应与实际设计争抢注意力。

## 实现方式

在右下角放一个固定定位的小 `<div>`，半透明，并在悬停时展开：

```html
<div id="sketch-tools" style="position:fixed;bottom:12px;right:12px;z-index:9999;font-family:system-ui;font-size:12px;background:rgba(0,0,0,0.7);color:white;padding:8px 12px;border-radius:8px;opacity:0.4;transition:opacity 0.2s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'">
  <!-- 主题切换器 -->
  <!-- 视口按钮 -->
  <!-- 标注切换 -->
</div>
```

## 组件

### 主题切换器

一个可在运行时切换主题 CSS 文件的下拉框：

```html
<select onchange="document.querySelector('link[href*=themes]').href='../themes/'+this.value+'.css'">
  <option value="default">Default</option>
</select>
```

### 视口预览

三个按钮，将 sketch 内容区域约束为标准宽度：

- 手机：375px
- 平板：768px
- 桌面：1280px（或全宽）

通过把 sketch 内容包在一个容器里，并调整它的 `max-width` 来实现。

### 标注模式

一个切换开关，在悬停时叠加显示间距值、颜色十六进制代码和字体大小。通过一段读取计算样式并在 tooltip 中显示的 JS 代码实现。这样无需打开开发者工具也能理解视觉决策。

## 样式

工具栏应该不打扰视觉：小、深色、半透明。绝不能在视觉上与 sketch 竞争。它的样式应独立于主题（硬编码深色背景、白色文本）。
