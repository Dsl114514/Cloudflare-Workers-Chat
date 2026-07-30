# ☁️ CloudChat — Cloudflare Workers 聊天室

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat&logo=Cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Durable_Objects-✔-blue" alt="Durable Objects">
  <img src="https://img.shields.io/badge/WebSocket-✔-brightgreen" alt="WebSocket">
  <img src="https://img.shields.io/github/v/release/MEMZ-CHROER/Cloudflare-Workers-Chat?color=orange" alt="Version">
</p>

基于 [Cloudflare Workers](https://workers.cloudflare.com/) + [Durable Objects](https://developers.cloudflare.com/durable-objects/) 的实时聊天室，100% 运行在边缘网络，无需任何服务器。

🌐 **在线体验**: [https://chat.liuxiyu.dpdns.org](https://chat.liuxiyu.dpdns.org)
🔧 **管理后台**: [https://chat.liuxiyu.dpdns.org/admin](https://chat.liuxiyu.dpdns.org/admin)

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

---

## 📡 API 参考

### 管理后台 API

所有管理接口需要传入 `key` 参数（超级管理员或普通管理员密钥）。

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/auth-check?key={key}` | GET | 验证密钥，返回权限等级 |
| `/api/admin/clear-room/{room}?key={key}` | GET | 清空房间聊天记录 |
| `/api/admin/destroy-room/{room}?key={key}` | GET | **销毁房间**（清空+断连+移除） |
| `/api/admin/room-users/{room}?key={key}` | GET | 房间在线用户列表 |
| `/api/admin/room-messages/{room}?key={key}&limit=N` | GET | 查看房间最近消息 |
| `/api/admin/room-files/{room}?key={key}` | GET | 房间文件列表 |
| `/api/admin/kick-user/{room}?key={key}&name={user}` | GET | 踢出用户 |
| `/api/admin/ban/add?key={key}&name={user}` | GET | 封禁用户 |
| `/api/admin/ban/remove?key={key}&name={user}` | GET | 解封用户 |
| `/api/admin/ban/list?key={key}` | GET | 封禁列表 |
| `/api/admin/ip-ban/add?key={key}&ip={ip}` | GET | 封禁IP |
| `/api/admin/ip-ban/remove?key={key}&ip={ip}` | GET | 解封IP |
| `/api/admin/global-blacklist/add?key={key}&name={user}` | GET | 全局拉黑 |
| `/api/admin/global-blacklist/remove?key={key}&name={user}` | GET | 移出黑名单 |
| `/api/admin/delete-user?key={key}&name={user}` | GET | **删除用户**（清除所有数据） |
| `/api/admin/user-tags?key={key}` | GET | 所有用户标签/背包 |
| `/api/admin/tag/set?key={key}&name={user}&tag={tag}&color={color}` | GET | 设置用户标签 |
| `/api/admin/tag/remove?key={key}&name={user}` | GET | 移除标签 |
| `/api/admin/points/get?key={key}&name={user}` | GET | 查询用户积分 |
| `/api/admin/points/set?key={key}&name={user}&amount={n}` | GET | 设置积分 |
| `/api/admin/points/add?key={key}&name={user}&amount={n}` | GET | 增加/扣除积分 |
| `/api/admin/kick-protect/add?key={key}&name={user}` | GET | 添加踢出保护 |
| `/api/admin/kick-protect/list?key={key}` | GET | 踢出保护列表 |
| `/api/admin/send-message/{room}?key={key}&text={msg}` | GET | 以系统身份发送消息 |
| `/api/admin/announcement/{room}?key={key}&text={msg}` | GET | 设置房间公告 |
| `/api/admin/admin-key/get?key={key}` | GET | 获取当前普通管理员密钥 |
| `/api/admin/admin-key/set?key={key}&newkey={key}` | GET | 修改普通管理员密钥 |
| `/api/admin/log/list?key={key}` | GET | 查看操作日志 |
| `/api/admin/log/clear?key={key}` | POST | 清空操作日志 |

### 积分 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/points/get?name={user}` | GET | 查询用户积分 |
| `/api/points/all?key={key}` | GET | 所有用户积分（需管理密钥） |
| `/api/points/transfer?sender={s}&receiver={r}&amount={n}&token={t}` | GET | 转账积分（需 token 验证） |

### 游戏 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/game/play` | POST | 游戏积分结算 `{name, token, game, action:"bet"|"win", wager, win}` |

### 用户 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/register` | POST | 注册 `{name, password}` |
| `/api/login` | POST | 登录 `{name, password}` → 返回 token |
| `/api/check-auth?name={n}&token={t}` | GET | 验证 token 有效性 |
| `/api/user/profile?name={user}` | GET | 用户公开资料 |
| `/api/user/avatar` | POST | 设置头像 `{avatar, token}` |
| `/api/user/bio` | POST | 设置简介 `{bio, token}` |

### 商店/任务/抽奖 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/shop/items` | GET | 商品列表 |
| `/api/shop/inventory?name={user}` | GET | 用户背包 |
| `/api/shop/buy` | POST | 购买商品 `{name, itemId}` |
| `/api/shop/equip` | POST | 装备商品 `{name, itemId}` |
| `/api/tasks/list` | GET | 任务列表 |
| `/api/tasks/claim` | POST | 领取任务 |
| `/api/tasks/complete` | POST | 完成任务 |
| `/api/lottery/pools` | GET | 奖池列表 |
| `/api/lottery/draw` | POST | 抽奖 |
| `/api/checkin` | POST | 每日签到 `{name, token}` |
| `/api/redeem/redeem` | POST | 兑换码兑换 |

### 红包 API

通过 WebSocket 消息实现：

| 消息 | 说明 |
|------|------|
| `{type:"redpacket", action:"create", total, count, mode}` | 发红包 |
| `{type:"redpacket", action:"grab", id}` | 抢红包 |
| `{type:"redpacket", action:"info", id}` | 查询红包状态 |

### WebSocket

连接: `wss://{host}/api/room/{room}/websocket`

建立连接后发送 `{name:"用户名", token:"(可选)"}` 进行认证。

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
