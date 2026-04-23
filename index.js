/**
 * 易票小程序管理后台 API
 * Express + CloudBase Database
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const TcbSdk = require('@cloudbase/node-sdk')

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 初始化 CloudBase
const env = TcbSdk.init({
  secretId: process.env.SECRET_ID,
  secretKey: process.env.SECRET_KEY,
  envId: process.env.ENV_ID
})

const db = env.database()
const _ = db.command

// ==================== 工具函数 ====================

function ok(res, data, message = 'success') {
  res.json({ code: 0, message, data })
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
    const { id } = await db.collection('expos').add({ data: record })
    const { data } = await db.collection('expos').doc(id).get()
    ok(res, data[0], '创建成功')
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
const path = require('path')
app.use(express.static(path.join(__dirname, '../')))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin.html'))
})

// ==================== 启动 ====================

const PORT = process.env.PORT || 80

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[易票] API 服务已启动 http://0.0.0.0:${PORT}`)
})
