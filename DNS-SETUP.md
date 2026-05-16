# GitHub Pages 自定义域名配置指南

## 当前状态
✅ 网站已部署到 GitHub Pages
✅ 仓库已设为公开
✅ CNAME 文件已添加（指向 izmw.me）

## 需要完成的 DNS 配置

### 1. 登录域名管理面板
访问你的域名 `izmw.me` 的 DNS 管理面板（通常在域名注册商处，如 GoDaddy、Namecheap、Cloudflare 等）。

### 2. 添加 CNAME 记录
添加以下 CNAME 记录：

```
类型: CNAME
名称: @ 或 www（取决于你想要的域名格式）
值: parsifalc.github.io
TTL: 自动或 600
```

**注意：**
- 如果你想要 `izmw.me`（不带 www），使用 `@` 作为名称
- 如果你想要 `www.izmw.me`，使用 `www` 作为名称
- 两者都支持，你可以添加两条记录

### 3. 验证域名
在 GitHub 仓库设置中：
1. 进入 Settings > Pages
2. 在 "Custom domain" 部分，应该会显示 `izmw.me`
3. 点击 "Save" 保存
4. 勾选 "Enforce HTTPS"（推荐）

### 4. 等待 DNS 传播
DNS 更改通常需要几分钟到 48 小时生效。你可以使用以下命令检查：
```bash
nslookup izmw.me
# 或
dig izmw.me CNAME
```

## 网站访问地址
- GitHub Pages 默认地址: https://parsifalc.github.io/
- 自定义域名: https://izmw.me （DNS 配置完成后）

## 网站内容更新
如需更新网站内容：
1. 编辑 `~/izmw-me-site/index.html` 文件
2. 提交更改: `git add . && git commit -m "更新内容"`
3. 推送: `git push origin master`

## 技术栈
- 纯 HTML/CSS/JavaScript
- 设计系统: OpenCode 风格（深色背景、等宽字体、终端美学）
- 字体: JetBrains Mono
- 部署: GitHub Pages（静态网站）

## 故障排除
如果网站无法访问：
1. 检查仓库是否为公开
2. 确认 CNAME 文件存在且内容正确
3. 检查 DNS 记录是否正确
4. 等待 DNS 传播完成