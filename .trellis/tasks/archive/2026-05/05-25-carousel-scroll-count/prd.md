# 扫描页路径轮播增加剩余可滑动页数

## Goal

在左右箭头下方显示"剩 N 页"，让用户知道还能往这个方向滑动几次。

## Requirements

- 左箭头下：`剩 {remainingLeft} 页`（0 时灰色）
- 右箭头下：`剩 {remainingRight} 页`（0 时灰色）
- 仅在 mediaDirs.length > CARDS_PER_VIEW 时显示
- i18n 支持中英文
