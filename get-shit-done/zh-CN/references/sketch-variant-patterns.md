# 多变体 HTML 模式

每个 sketch 都在同一个 HTML 文件中产出 2-3 个变体。用户通过切换来比较它们。

## 基于标签页的变体

标准方式：页面顶部放一个标签栏，每个标签展示不同变体。

```html
<div id="variant-nav" style="position:fixed;top:0;left:0;right:0;z-index:9998;background:var(--color-surface, #fff);border-bottom:1px solid var(--color-border, #e5e5e5);padding:8px 16px;display:flex;gap:8px;font-family:system-ui;">
  <button class="variant-tab active" onclick="showVariant('a')">A: 侧边栏布局</button>
  <button class="variant-tab" onclick="showVariant('b')">B: 顶部导航</button>
  <button class="variant-tab" onclick="showVariant('c')">C: 浮动面板</button>
</div>

<div id="variant-a" class="variant active">
  <!-- 变体 A 内容 -->
</div>
<div id="variant-b" class="variant" style="display:none">
  <!-- 变体 B 内容 -->
</div>
<div id="variant-c" class="variant" style="display:none">
  <!-- 变体 C 内容 -->
</div>

<script>
function showVariant(id) {
  document.querySelectorAll('.variant').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.variant-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('variant-' + id).style.display = 'block';
  event.target.classList.add('active');
}
</script>
```

给 body 加上 `padding-top`，为固定标签栏留出空间。

## 标记胜出方案

当用户选定方向后，在胜出标签上加一个视觉标识：

```html
<button class="variant-tab active">A: 侧边栏布局 ★ 已选中</button>
```

保留所有变体可见且可导航，胜出者只是被高亮，不是唯一选项。

## 并排展示（适用于小型变体）

当比较较小元素（按钮样式、卡片布局、图标处理）时，不要用标签页，而是并排渲染并加标签：

```html
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:24px;">
  <div>
    <h3>A: 圆角</h3>
    <!-- 变体内容 -->
  </div>
  <div>
    <h3>B: 锐角</h3>
    <!-- 变体内容 -->
  </div>
  <div>
    <h3>C: 胶囊</h3>
    <!-- 变体内容 -->
  </div>
</div>
```

## 变体数量

- **第一轮（差异明显）：** 2-3 个有实质差异的方案
- **精修轮次：** 在选定方向内做 2-3 个细微变化
- **绝不要超过 4 个** - 再多就会让人不堪重负。如果有 5+ 个选项，先收窄再展示。

## 综合变体

当用户从多个变体里挑选元素时，新建一个描述性命名的变体标签：

```html
<button class="variant-tab" onclick="showVariant('synth1')">综合：A 的布局 + C 的配色</button>
```
