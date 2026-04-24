/**
 * 易票小程序管理后台 API
 * Express + CloudBase Database
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const TcbSdk = require('@cloudbase/node-sdk')

const app = express()

// 中间件
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// 初始化 CloudBase
const env = TcbSdk.init({
  secretId: process.env.SECRET_ID,
  secretKey: process.env.SECRET_KEY,
  envId: process.env.ENV_ID
})

const db = env.database()
const cloudStorage = env.uploadFile
const _ = db.command

// ==================== 工具函数 ====================

// 通用字段映射：snake_case → camelCase
const FIELD_MAP = {
  expo_id: 'expoId',
  order_no: 'orderNo',
  verify_code: 'verifyCode',
  ticket_type_id: 'ticketTypeId',
  user_id: 'userId',
  create_time: 'createTime',
  update_time: 'updateTime',
  original_price: 'originalPrice',
  start_date: 'startDate',
  end_date: 'endDate',
}

// 把 CloudBase 的 _id 转换成 id，同时做 snake_case → camelCase
function normalizeItem(item) {
  const result = {}
  for (const key of Object.keys(item)) {
    if (key === '_id') { result.id = item._id; continue }
    const mapped = FIELD_MAP[key] || key
    result[mapped] = item[key]
  }
  return result
}

function normalizeData(data) {
  if (Array.isArray(data)) {
    return data.map(item => normalizeItem(item))
  } else if (data && typeof data === 'object') {
    return normalizeItem(data)
  }
  return data
}

function ok(res, data, message = 'success') {
  res.json({ code: 0, message, data: normalizeData(data) })
}

function fail(res, message = 'error', code = 1) {
  res.json({ code, message, data: null })
}

function genOrderNo() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, '0')
  return `EP${y}${m}${day}${rand}`
}

function genVerifyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function now() {
  return Date.now()
}

// ==================== 系统接口 ====================

// 健康检查/版本信息
app.get('/api/_health', (req, res) => {
  ok(res, { version: 'v1.0.4', time: new Date().toISOString() })
})

// ==================== 文件上传接口 ====================

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, '没有上传文件')
    }

    // 生成唯一文件名
    const ext = path.extname(req.file.originalname)
    const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`
    const cloudPath = `uploads/${filename}`

    // 上传到云存储
    const result = await cloudStorage({
      cloudPath,
      fileContent: req.file.buffer
    })

    // 获取文件访问 URL
    const fileUrl = env.getTempFileURL(result.fileId)
    const urlResult = await fileUrl()

    ok(res, {
      fileId: result.fileId,
      url: urlResult.tempFileURL
    }, '上传成功')
  } catch (e) {
    console.error('上传失败', e)
    fail(res, '上传失败')
  }
})

// ==================== 登录接口 ====================

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const { data } = await db.collection('users')
      .where({ username, password })
      .get()
    if (data.length === 0) {
      return fail(res, '用户名或密码错误')
    }
    const user = data[0]
    delete user.password
    ok(res, user, '登录成功')
  } catch (e) {
    console.error('登录失败', e)
    fail(res, '登录失败')
  }
})

// ==================== 展会接口 ====================

app.get('/api/expos', async (req, res) => {
  try {
    const { status } = req.query
    const conn = db.collection('expos')
    let query = conn
    if (status) {
      query = query.where({ status })
    }
    const { data } = await query.orderBy('sort', 'desc').orderBy('create_time', 'desc').get()
    ok(res, data)
  } catch (e) {
    console.error('查询展会失败', e)
    fail(res, '查询失败')
  }
})

app.get('/api/expos/:id', async (req, res) => {
  try {
    const { data } = await db.collection('expos').doc(req.params.id).get()
    if (data.length === 0) return fail(res, '展会不存在')
    ok(res, data[0])
  } catch (e) {
    fail(res, '查询失败')
  }
})

app.post('/api/expos', async (req, res) => {
  try {
    const { name, subtitle, startDate, endDate, venue, location, coords, poster, description, status, sort } = req.body
    const record = {
      name, subtitle, start_date: startDate, end_date: endDate, venue,
      location, coords, poster, description, status: status || 'draft', sort: sort || 100,
      create_time: now(), update_time: now()
    }
    console.log('[CREATE EXPO] record:', JSON.stringify(record))
    const { id } = await db.collection('expos').add({ data: record })
    // 直接用 record + id 返回，不依赖 fetch（CloudBase fetch 有时丢字段）
    ok(res, { ...record, id }, '创建成功')
  } catch (e) {
    console.error('创建展会失败', e)
    fail(res, '创建失败')
  }
})

app.put('/api/expos/:id', async (req, res) => {
  try {
    const { name, subtitle, startDate, endDate, venue, location, coords, poster, description, status, sort } = req.body
    await db.collection('expos').doc(req.params.id).update({
      name, subtitle, start_date: startDate, end_date: endDate, venue,
      location, coords, poster, description, status, sort,
      update_time: now()
    })
    const { data } = await db.collection('expos').doc(req.params.id).get()
    ok(res, data[0], '更新成功')
  } catch (e) {
    fail(res, '更新失败')
  }
})

app.delete('/api/expos/:id', async (req, res) => {
  try {
    await db.collection('expos').doc(req.params.id).remove()
    ok(res, null, '删除成功')
  } catch (e) {
    fail(res, '删除失败')
  }
})

// ==================== 票种接口 ====================

app.get('/api/ticket-types', async (req, res) => {
  try {
    const { expoId, status } = req.query
    let query = db.collection('ticket_types')
    if (expoId) query = query.where({ expo_id: expoId })
    if (status) query = query.where({ status })
    const { data } = await query.orderBy('sort', 'asc').get()
    ok(res, data)
  } catch (e) {
    fail(res, '查询失败')
  }
})

app.post('/api/ticket-types', async (req, res) => {
  try {
    const { expoId, name, price, stock, description, benefits, status, sort } = req.body
    const record = {
      expo_id: expoId, name, price: price || 0, stock: stock || 100, sold: 0,
      description, benefits, status: status || 'active', sort: sort || 10,
      create_time: now(), update_time: now()
    }
    const { id } = await db.collection('ticket_types').add({ data: record })
    const { data } = await db.collection('ticket_types').doc(id).get()
    ok(res, data[0], '创建成功')
  } catch (e) {
    fail(res, '创建失败')
  }
})

app.put('/api/ticket-types/:id', async (req, res) => {
  try {
    const { name, price, stock, description, benefits, status, sort } = req.body
    await db.collection('ticket_types').doc(req.params.id).update({
      name, price, stock, description, benefits, status, sort, update_time: now()
    })
    const { data } = await db.collection('ticket_types').doc(req.params.id).get()
    ok(res, data[0], '更新成功')
  } catch (e) {
    fail(res, '更新失败')
  }
})

app.delete('/api/ticket-types/:id', async (req, res) => {
  try {
    await db.collection('ticket_types').doc(req.params.id).remove()
    ok(res, null, '删除成功')
  } catch (e) {
    fail(res, '删除失败')
  }
})

// ==================== 订单接口 ====================

app.get('/api/tickets', async (req, res) => {
  try {
    const { expoId, status, search } = req.query
    let query = db.collection('tickets')
    if (expoId) query = query.where({ expo_id: expoId })
    if (status) query = query.where({ status })
    if (search) {
      query = query.where(_.or([
        { order_no: db.RegExp({ regex: search, options: 'i' }) },
        { user_name: db.RegExp({ regex: search, options: 'i' }) },
        { user_phone: db.RegExp({ regex: search, options: 'i' }) }
      ]))
    }
    const { data } = await query.orderBy('create_time', 'desc').limit(200).get()
    ok(res, data)
  } catch (e) {
    fail(res, '查询失败')
  }
})

app.post('/api/tickets/verify', async (req, res) => {
  try {
    const { code } = req.body
    const { data } = await db.collection('tickets')
      .where({ verify_code: code.toUpperCase() })
      .get()
    if (data.length === 0) return fail(res, '核销码无效')
    const ticket = data[0]
    if (ticket.status !== 'valid') return fail(res, '该票券状态不可核销')
    await db.collection('tickets').doc(ticket._id).update({
      status: 'used', used_time: now(), update_time: now()
    })
    ticket.status = 'used'
    ok(res, ticket, '核销成功')
  } catch (e) {
    fail(res, '核销失败')
  }
})

// ==================== 数据清理接口 ====================

// 清理无名称的脏数据（内部维护接口，慎用）
app.post('/api/_cleanup', async (req, res) => {
  try {
    const results = {}
    // 删除 name 为空的历史展会
    const { data: badExpos } = await db.collection('expos').where({
      name: db.command.exists(false)
    }).get()
    for (const expo of badExpos) {
      await db.collection('expos').doc(expo._id).remove()
    }
    results.exposDeleted = badExpos.length

    // 删除无名称的票种
    const { data: badTickets } = await db.collection('ticket_types').where({
      name: db.command.exists(false)
    }).get()
    for (const t of badTickets) {
      await db.collection('ticket_types').doc(t._id).remove()
    }
    results.ticketTypesDeleted = badTickets.length

    console.error('[CLEANUP] done:', JSON.stringify(results))
    ok(res, results, '清理完成')
  } catch (e) {
    console.error('[CLEANUP] error:', e)
    fail(res, '清理失败：' + e.message)
  }
})

// ==================== 统计接口 ====================

app.get('/api/stats', async (req, res) => {
  try {
    const { expoId } = req.query

    // 展会数量
    const { data: expos } = await db.collection('expos')
      .where({ status: _.neq('draft') })
      .get()

    // 订单统计
    let ticketQuery = db.collection('tickets')
    if (expoId) ticketQuery = ticketQuery.where({ expo_id: expoId })
    const { data: tickets } = await ticketQuery.get()

    // 今日订单
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayOrders = tickets.filter(t => t.create_time >= todayStart.getTime()).length

    // 销售额
    const revenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0)

    // 各展会统计
    const expoStats = expos.map(e => {
      const expoTickets = tickets.filter(t => t.expo_id === e._id)
      return {
        id: e._id, name: e.name, status: e.status,
        ticketCount: expoTickets.length,
        revenue: expoTickets.reduce((s, t) => s + (t.price || 0), 0),
        soldCount: 0
      }
    })

    ok(res, {
      totalOrders: tickets.length,
      todayOrders,
      revenue,
      expoCount: expos.length,
      expoStats
    })
  } catch (e) {
    console.error('统计失败', e)
    fail(res, '统计失败')
  }
})

// ==================== 用户管理接口 ====================

app.get('/api/users', async (req, res) => {
  try {
    const { data } = await db.collection('users').get()
    ok(res, data.map(u => ({ id: u._id, username: u.username, role: u.role, create_time: u.create_time })))
  } catch (e) {
    fail(res, '查询失败')
  }
})

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role } = req.body
    if (!username || !password) return fail(res, '用户名和密码不能为空')
    const record = { username, password, role: role || 'operator', create_time: now() }
    const { id } = await db.collection('users').add({ data: record })
    ok(res, { id, username, role: role || 'operator' }, '创建成功')
  } catch (e) {
    fail(res, '创建失败')
  }
})

app.put('/api/users/:id', async (req, res) => {
  try {
    const { password, role } = req.body
    const updates = {}
    if (password) updates.password = password
    if (role) updates.role = role
    if (Object.keys(updates).length === 0) return fail(res, '没有更新内容')
    await db.collection('users').doc(req.params.id).update(updates)
    ok(res, null, '更新成功')
  } catch (e) {
    fail(res, '更新失败')
  }
})

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { data } = await db.collection('users').doc(req.params.id).get()
    if (data.length > 0 && data[0].role === 'admin') return fail(res, '不能删除管理员账号')
    await db.collection('users').doc(req.params.id).remove()
    ok(res, null, '删除成功')
  } catch (e) {
    fail(res, '删除失败')
  }
})

// ==================== 健康检查 ====================

app.get('/api/health', (req, res) => {
  ok(res, { status: 'ok', time: new Date().toISOString() })
})

// ==================== 静态文件服务 ====================
// 静态文件在当前目录（因为 Dockerfile 把代码复制到 /app）
app.use(express.static(__dirname))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'))
})
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'))
})

// ==================== 启动 ====================

const PORT = process.env.PORT || 80

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[易票] API 服务已启动 http://0.0.0.0:${PORT}`)
})
