---
name: redeem-system
description: 兑换码系统架构 — admin生成码，user兑换积分
metadata:
  type: reference
---

# 兑换码系统

2026-05-31 上线 v1.16

## 架构

| 层 | 文件 | 说明 |
|----|------|------|
| 数据 | `src/registry/redeem.mjs` | 积分存储&验证，handler |
| 持久化 | `src/registry/persistence.mjs` | saveRedeemCodes |
| 注册 | `src/registry.mjs` | this.redeemCodes Map，路由 |
| API | `src/api/redeem.mjs` | 用户兑换 POST /api/redeem |
| 管理API | `src/api/admin/redeem.mjs` | 增删查 POST /api/admin/redeem/* |
| 页面 | `src/redeem.html` | /redeem 用户兑换页 |
| 管理 | `src/admin.html` | 后台兑换码管理 section |
| 管理JS | `src/client/admin/redeem.js` | ES模块 |
| 路由 | `src/client/admin/routing.js` | loadRedeemSection |

## 数据存储

`this.redeemCodes` (Map) → key: 大写的兑换码, value: `{ points, createdBy, createdAt, usedBy, usedAt }`

## 管理员操作

- 批量生成: 设积分+数量+前缀 → 自动生成码
- 自定义添加: 手动输码
- 查看列表: 排序(sort: 未使用>已使用, 创建时间倒序)
- 删除: 仅可删未使用的码

## 用户兑换

1. 访问 `/redeem` 输入码
2. POST `/api/redeem` → 验证 → 加积分 → 标记已用
3. 兑换记录存 localStorage

**相关:** [[changelog_auto_update]]
