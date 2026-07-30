# CloudChat — Cloudflare Workers 聊天室

基于 [Cloudflare Workers](https://workers.cloudflare.com/) + [Durable Objects](https://developers.cloudflare.com/durable-objects/) 的实时聊天室，100% 运行在边缘网络，无需任何服务器。

🌐 **在线体验**: [https://chat.liuxiyu.dpdns.org](https://chat.liuxiyu.dpdns.org)

---

## ✨ 功能

### 聊天
- 实时 WebSocket 消息
- 图片/文件上传
- Markdown 渲染（加粗、代码块、链接等）
- LaTeX 公式渲染（KaTeX）
- 代码高亮（highlight.js）
- 快捷表情、私信、@提及
- 消息引用回复、编辑、撤回（2分钟内）
- 在线用户列表

### 积分系统
- 注册/登录（SHA-256 密码哈希）
- 每日签到
- 积分转账
- 🧧 **积分红包** — 拼手气/固定金额
- 🏪 **商城** — 购买标签（装备后修改显示名称颜色）
- 🎰 **抽奖** — 奖池抽奖，赢取稀有标签
- 📋 **任务系统** — 完成任务赚积分
- 🎮 **小游戏中心** — 29 款小游戏（老虎机、21点、扫雷、2048、打砖块等）

### 管理后台 (`/admin`)
- 房间管理（查看/清空/销毁）
- 用户管理（踢出/封禁/IP封禁/全局拉黑）
- 积分管理（查询/设置/批量操作）
- 标签管理（设置用户标签颜色）
- 🏪 商店管理（上架/下架商品）
- 🎰 抽奖管理（创建奖池/奖品）
- 📋 任务管理
- 🤖 机器人自定义回复
- 😀 自定义表情
- 🎁 兑换码生成
- 🛡️ 踢出保护
- 📜 **操作日志** — 审计所有管理操作

### 安全
- 🔐 64 位随机超级管理员密码
- 🔐 48 位随机普通管理员密码
- 🔐 标签颜色权限验证（红色=超级管理员，青色=管理员）
- 🛡️ CSRF 防护、XSS 防护、SSRF 防护
- 🛡️ 原型污染防护
- 🛡️ 积分操作需 token 验证
- 🛡️ 文件存储隔离（FileBucket 桶存储）

---

## 🚀 部署

### 前置条件
1. [Cloudflare 账号](https://dash.cloudflare.com/)
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
3. 登录 Wrangler: `wrangler login`

### 部署步骤

```bash
# 克隆项目
git clone https://github.com/MEMZ-CHROER/Cloudflare-Workers-Chat.git
cd Cloudflare-Workers-Chat

# 部署
npx wrangler deploy
```

### 配置环境变量

编辑 `wrangler.toml` 或通过 Cloudflare Dashboard 设置：

```toml
[vars]
ADMIN_SECRET_KEY = "你的超级管理员密钥（建议64位随机）"
ADMIN_KEY = "你的普通管理员密钥（建议48位随机）"
AI_BASE_URL = "https://api.deepseek.com/v1"
AI_MODEL = "deepseek-v4-flash"
AI_SYSTEM_PROMPT = "你是一个友好的助手，请用中文回答。"
```

> ⚠️ **安全提醒**: 生产环境请通过 `wrangler secret put ADMIN_SECRET_KEY` 设置密钥，而非硬编码在配置文件中。

### 自定义域名

在 `wrangler.toml` 的 `routes` 中添加你的域名：

```toml
routes = [
  { pattern = "chat.yourdomain.com/*", zone_name = "yourdomain.com" },
]
```

---

## 🏗️ 架构

```
用户 → Cloudflare Workers → Durable Objects
                                ├── ChatRoom（每房间一个DO）
                                ├── RoomRegistry（全局注册表）
                                ├── VersionArchive（版本存档）
                                └── FileBucket（文件存储桶）
```

- **ChatRoom DO**: 每个聊天室一个实例，管理 WebSocket 连接、消息广播、历史存储
- **RoomRegistry DO**: 全局单例，管理房间列表、用户认证、积分、商城、任务、抽奖等
- **FileBucket DO**: 分布式文件存储，文件 7 天自动过期

---

## 🛠️ 技术栈

| 前端 | 后端 | 基础设施 |
|------|------|---------|
| 原生 ES Modules | Cloudflare Workers | Cloudflare 边缘网络 |
| KaTeX | Durable Objects | Wrangler CLI |
| highlight.js | WebSocket/Hibernation API | GitHub |
| CSS Custom Properties | SQLite (DO Storage) | |

---

## 📜 许可证

MIT
