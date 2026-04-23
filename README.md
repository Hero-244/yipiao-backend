# 易票管理后台 - Express 后端

基于 CloudBase 数据库的后端服务。

## 快速部署到 CloudBase

### 环境变量

```
SECRET_ID=你的SecretId
SECRET_KEY=你的SecretKey
ENV_ID=prod-d9grg86xj560374dd
PORT=80
```

### CloudBase 密钥获取

1. 进入 [腾讯云控制台](https://console.cloud.tencent.com/cam/capi)
2. 创建密钥或使用现有密钥

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录 |
| GET | `/api/expos` | 展会列表 |
| POST | `/api/expos` | 新增展会 |
| PUT | `/api/expos/:id` | 更新展会 |
| DELETE | `/api/expos/:id` | 删除展会 |
| GET | `/api/ticket-types` | 票种列表 |
| POST | `/api/ticket-types` | 新增票种 |
| PUT | `/api/ticket-types/:id` | 更新票种 |
| DELETE | `/api/ticket-types/:id` | 删除票种 |
| GET | `/api/tickets` | 订单列表 |
| POST | `/api/tickets/verify` | 核销票券 |
| GET | `/api/stats` | 数据统计 |
| GET | `/api/users` | 用户列表 |
| POST | `/api/users` | 新增用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |

---

## 默认账号

- **管理员**: `admin` / `admin123`
- **操作员**: `operator` / `op123`

> 首次登录后请在「用户管理」中初始化默认账号。
