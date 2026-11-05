# 发布与收录说明

本目录（`market-entry/`）不是插件运行时代码，而是发布到 dsh-market 生态所需的材料。

## 一、发布到 GitHub

仓库已在本目录的上一级初始化（`git init`），但**尚未提交**：这台机器没有配置 Git 身份（`user.name` / `user.email`）。

```sh
cd ..                                     # 回到 dsh-open-in-codebuddy/
git config user.name  "你的名字"
git config user.email "你的邮箱"
git commit -m "feat: open current workspace in CodeBuddy from the Session header"
```

然后在 GitHub 创建同名仓库 `caizhihang/dsh-open-in-codebuddy`，再推送：

```sh
git remote add origin https://github.com/caizhihang/dsh-open-in-codebuddy.git
git branch -M main
git push -u origin main
```

推送后务必做一件事：**给仓库添加 `dsh-plugin` topic**（Settings → Topics）。这是收录的硬性要求。

## 二、发布到 npm（可选但推荐）

收录不依赖 npm，但发布后市场能显示下载量，且用户安装时免去构建授权步骤。

```sh
cd ..
npm publish --access public
```

发布前请确认 `package.json` 的 `repository.url` 指向你实际创建的仓库地址；若 GitHub 用户名或仓库名与本文件不同，需同步修改。

## 三、提交到 awesome-dsh-plugin 收录列表

dsh-market 只接受该注册表中的源，未收录的插件在市场中无法直接搜到。

1. Fork `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin`
2. 把 `caizhihang__dsh-open-in-codebuddy.yml` 复制到该仓库的 **`data/plugins/`** 目录
3. 提 PR

**一个文件就是全部投稿**，不要手改 README（它们由脚本从 `data/plugins/*.yml` 生成）。

### 该条目已满足的收录要求

| 要求 | 状态 |
|---|---|
| `package.json` 声明 `dsh.bundle` | ✅ `{"patch": "./cordis.patch.yml"}` |
| 仓库根有 `cordis.patch.yml` | ✅ |
| 真实可用代码（非占位） | ✅ Host + Client 两侧实测通过 |
| 仓库创建满 1 天 | ⏳ 推送后需等待 |
| 仓库带 `dsh-plugin` topic | ⏳ 推送后手动添加 |
| 描述属实、无营销词 | ✅ 只陈述功能 |
| `icon` 为 GitHub 托管的位图 | ✅ `assets/icon-180.png`（PNG，180×180） |
| 不使用 SVG 作为市场图标 | ✅ 市场图标用 PNG；`icon.svg` 仅供 DSH 插件列表显示 |

### 关于分类

条目选的是 `ui`（UI Enhancements）——本插件在会话头部加一个按钮，属于 UI 增强。规范明确说明分类选得不准不会被打回，维护者会直接调整。

## 四、市场图标为什么是原创的

`assets/icon-180.png` 是**原创绘制**的（蓝色圆角方块 + `</>` 字形），不是腾讯 CodeBuddy 的官方应用图标。官方 `.icns` 虽可从本机应用包中提取，但其再分发许可不明确，作为公开发布的插件图标存在商标与授权风险，故未采用。

`icon.svg`（DSH 插件列表用）与之一致，同样是原创作品。

## 五、等待收录期间如何安装

收录前，用户仍可通过 GitHub 或 tarball 直接安装：

```sh
# GitHub 源码
dsh plugin --profile <profile> add github:caizhihang/dsh-open-in-codebuddy

# 或 GitHub Release 上的预构建 tarball
dsh plugin --profile <profile> add "https://github.com/caizhihang/dsh-open-in-codebuddy/releases/latest/download/dsh-open-in-codebuddy.tgz"
```

若使用 tarball 形式，建议把 `tarball:` 字段补进 `data/plugins/` 的条目里，让市场优先展示它。
