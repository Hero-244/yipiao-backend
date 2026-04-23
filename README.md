# 易票管理后台 - Express 后端

## 快速部署到 CloudBase

### 方式一：GitHub 一键部署

1. **创建 GitHub 仓库**，把 `backend/` 目录上传（或直接用 GitHub 网页创建）
2. 进入 [腾讯云 CloudBase](https://console.cloud.tencent.com/tcb)
3. 新建服务 → 选择「Express.js」模板
4. 绑定你的 GitHub 仓库，选择 `backend/` 目录
5. 环境变量填入以下内容：

```
DB_HOST=10.23.110.168
DB_PORT=3306
DB_USER=root
DB_PASSWORD=gU3EGYyJ
DB_NAME=yipiao
PORT=80
```

6. 部署完成后拿到**公网域名**，填入前端管理后台的「⚙️ 环境配置」

### 方式二：本地调试

```bash
cd backend
npm install
npm start
```

访问 `http://localhost:80`

---

## 数据库

- **Host**: `10.23.110.168:3306`
- **用户**: `root`
- **密码**: `gU3EGYyJ`
- **数据库名**: `yipiao`（会自动创建）

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
