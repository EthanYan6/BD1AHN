# BD1AHN · 产品展示

简约高级的产品作品展示站，部署于 GitHub Pages。

## 快速开始

### 添加一个新产品

在 `products/` 下新建文件夹，结构如下：

```
products/
  我的产品名/
    product.md      ← 产品信息与详情（必填）
    images/         ← 展示图片（必填）
      01.png
      02.jpg
```

### product.md 格式

```yaml
---
title: 产品标题
device: pc          # phone = 手机 | walkie = 对讲机 | pc = 显示器
device_label: UVK6    # 对讲机机身铭牌 & 角标文字，如 UVK1、UVK6
description: 一句话简介
order: 1
date: 2025-08
tags:
  - 标签1
---

正文支持 Markdown，会显示在产品详情页右侧。
```

**`device` 字段说明：**

| 值 | 效果 |
|---|---|
| `walkie` | 左侧显示对讲机实物框，图片在屏幕区域轮播 |
| `phone` | 左侧显示手机横屏实物框，图片在屏幕区域轮播 |
| `pc` | 左侧显示 PC 显示器，大屏展示截图 |

**`device_label`**：对讲机机身上的型号文字（如 `UVK1`、`UVK6`），同时显示在右上角角标。手机产品可省略。

**`date`**：支持 `2026-08-26` 或 `2026-08-26 08:00:00`（年月日时分秒），页面按原样简洁展示。

### 图片顺序

有两种方式（可混用）：

**方式一：文件夹顺序（默认）**

不写 `images` 时，按 `images/` 文件夹内的**文件排列顺序**展示（与资源管理器中顺序一致）。

**方式二：在 product.md 里手动指定**

```yaml
images:
  - image (1).png
  - image.png
  - image (2).png
  - 567756772-2097c20d-58fc-4577-ba84-dbfc83876e03.png
```

列表从上到下即为轮播顺序；未写入列表的图片会排在后面。

### 本地预览

```bash
npm install
npm run build
npx serve .
```

浏览器打开 `http://localhost:3000` 查看效果。

### 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

请在仓库 Settings → Pages 中将 Source 设为 **GitHub Actions**。

站点地址：`https://ethanyan6.github.io/BD1AHN/`

> 若使用自定义域名，将 `site.config.json` 中的 `basePath` 改为 `""`。

## 目录结构

```
├── products/          # 产品源文件（你在这里添加内容）
├── p/                 # 构建生成的产品页面
├── assets/            # 样式、脚本、产品图片
├── scripts/build.js   # 构建脚本
└── index.html         # 首页（构建生成）
```
