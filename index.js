/**
 * 易票小程序管理后台 API
 * Express + MySQL
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
const { v4: uuidv4 } = require('uuid')

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// 数据库初始化
async function initDB() {
  const connection = await pool.getConnection()
  try {
    // 创建数据库（如果不存在）
    await connection.query(`CREATE DATABASE IF NOT EXISTS yipiao`)
    await connection.query(`USE yipiao`)

    // 展会表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS expos (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255) DEFAULT '',
        start_date DATE,
        end_date DATE,
        venue VARCHAR(255) DEFAULT '',
        location VARCHAR(500) DEFAULT '',
        coords VARCHAR(50) DEFAULT '',
        poster TEXT,
        description TEXT,
        status ENUM('active','inactive','draft') DEFAULT 'draft',
        sort INT DEFAULT 100,
        create_time BIGINT,
        update_time BIGINT
      )
    `)

    // 票种表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ticket_types (
        id VARCHAR(36) PRIMARY KEY,
        expo_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        stock INT DEFAULT 100,
        sold INT DEFAULT 0,
        description TEXT,
        benefits TEXT,
        status ENUM('active','inactive') DEFAULT 'active',
        sort INT DEFAULT 10,
        create_time BIGINT,
        update_time BIGINT
      )
    `)

    // 订单表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(36) PRIMARY KEY,
        order_no VARCHAR(50) UNIQUE,
        expo_id VARCHAR(36),
        ticket_type_id VARCHAR(36),
        ticket_type_name VARCHAR(255),
        user_name VARCHAR(100),
        user_phone VARCHAR(20),
        verify_code VARCHAR(20),
        status ENUM('valid','used','refunded','cancelled') DEFAULT 'valid',
        price DECIMAL(10,2),
        create_time BIGINT,
        used_time BIGINT,
        update_time BIGINT
      )
    `)

    // 用户表（管理员）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin','operator') DEFAULT 'operator',
        create_time BIGINT
      )
    `)

    // 初始化默认用户
    const [existingUsers] = await connection.query('SELECT COUNT(*) as c FROM users')
    if (existingUsers[0].c === 0) {
      await connection.query(`INSERT INTO users (id, username, password, role, create_time) VALUES
        (?, 'admin', 'admin123', 'admin', ?),
        (?, 'operator', 'op123', 'operator', ?)`,
        [uuidv4(), Date.now(), uuidv4(), Date.now()]
      )
      console.log('[易票] 默认用户已创建: admin/admin123, operator/op123')
    }

    console.log('[易票] 数据库初始化完成')
  } finally {
    connection.release()
  }
}

// 统一响应格式
function ok(res, data, message = 'success') {
  res.json({ code: 0, message, data })
}

function fail(res, message = 'error', code = 1) {
  res.json({ code, message, data: null })
}

// 生成订单号
function genOrderNo() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, '0')
  return `EP${y}${m}${day}${rand}`
}

// 生成核销码
function genVerifyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// ==================== 登录接口 ====================

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password])
    if (users.length === 0) {
      return fail(res, '用户名或密码错误')
    }
    const user = users[0]
    delete user.password
    ok(res, user, '登录成功')
  } catch (e) {
    console.error('登录失败', e)
    fail(res, '登录失败')
  }
})

// ==================== 展会接口 ====================

// 展会列表
app.get('/api/expos', async (req, res) => {
  try {
    const { status } = req.query
    let sql = 'SELECT * FROM expos'
    let params = []
    if (status) {
      sql += ' WHERE status = ?'
      params.push(status)
    }
    sql += ' ORDER BY sort DESC, create_time DESC'
    const [rows] = await pool.query(sql, params)
    ok(res, rows)
  } catch (e) {
    console.error('查询展会失败', e)
    fail(res, '查询失败')
  }
})

// 获取单个展会
app.get('/api/expos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM expos WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '展会不存在')
    ok(res, rows[0])
  } catch (e) {
    fail(res, '查询失败')
  }
})

// 新增展会
app.post('/api/expos', async (req, res) => {
  try {
    const { name, subtitle, startDate, endDate, venue, location, coords, poster, description, status, sort } = req.body
    const id = uuidv4()
    const now = Date.now()
    await pool.query(`
      INSERT INTO expos (id, name, subtitle, start_date, end_date, venue, location, coords, poster, description, status, sort, create_time, update_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, subtitle, startDate, endDate, venue, location, coords, poster, description, status || 'draft', sort || 100, now, now])
    const [rows] = await pool.query('SELECT * FROM expos WHERE id = ?', [id])
    ok(res, rows[0], '创建成功')
  } catch (e) {
    console.error('创建展会失败', e)
    fail(res, '创建失败')
  }
})

// 更新展会
app.put('/api/expos/:id', async (req, res) => {
  try {
    const { name, subtitle, startDate, endDate, venue, location, coords, poster, description, status, sort } = req.body
    await pool.query(`
      UPDATE expos SET name=?, subtitle=?, start_date=?, end_date=?, venue=?, location=?, coords=?, poster=?, description=?, status=?, sort=?, update_time=? WHERE id=?
    `, [name, subtitle, startDate, endDate, venue, location, coords, poster, description, status, sort, Date.now(), req.params.id])
    const [rows] = await pool.query('SELECT * FROM expos WHERE id = ?', [req.params.id])
    ok(res, rows[0], '更新成功')
  } catch (e) {
    console.error('更新展会失败', e)
    fail(res, '更新失败')
  }
})

// 删除展会
app.delete('/api/expos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM expos WHERE id = ?', [req.params.id])
    ok(res, null, '删除成功')
  } catch (e) {
    fail(res, '删除失败')
  }
})

// ==================== 票种接口 ====================

// 票种列表
app.get('/api/ticket-types', async (req, res) => {
  try {
    const { expoId, status } = req.query
    let sql = 'SELECT * FROM ticket_types WHERE 1=1'
    const params = []
    if (expoId) { sql += ' AND expo_id = ?'; params.push(expoId) }
    if (status) { sql += ' AND status = ?'; params.push(status) }
    sql += ' ORDER BY sort ASC, create_time DESC'
    const [rows] = await pool.query(sql, params)
    ok(res, rows)
  } catch (e) {
    fail(res, '查询失败')
  }
})

// 新增票种
app.post('/api/ticket-types', async (req, res) => {
  try {
    const { expoId, name, price, stock, description, benefits, status, sort } = req.body
    const id = uuidv4()
    const now = Date.now()
    await pool.query(`
      INSERT INTO ticket_types (id, expo_id, name, price, stock, sold, description, benefits, status, sort, create_time, update_time)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `, [id, expoId, name, price, stock, description, benefits, status || 'active', sort || 10, now, now])
    const [rows] = await pool.query('SELECT * FROM ticket_types WHERE id = ?', [id])
    ok(res, rows[0], '创建成功')
  } catch (e) {
    console.error('创建票种失败', e)
    fail(res, '创建失败')
  }
})

// 更新票种
app.put('/api/ticket-types/:id', async (req, res) => {
  try {
    const { name, price, stock, description, benefits, status, sort } = req.body
    await pool.query(`
      UPDATE ticket_types SET name=?, price=?, stock=?, description=?, benefits=?, status=?, sort=?, update_time=? WHERE id=?
    `, [name, price, stock, description, benefits, status, sort, Date.now(), req.params.id])
    const [rows] = await pool.query('SELECT * FROM ticket_types WHERE id = ?', [req.params.id])
    ok(res, rows[0], '更新成功')
  } catch (e) {
    fail(res, '更新失败')
  }
})

// 删除票种
app.delete('/api/ticket-types/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM ticket_types WHERE id = ?', [req.params.id])
    ok(res, null, '删除成功')
  } catch (e) {
    fail(res, '删除失败')
  }
})

// ==================== 订单接口 ====================

// 订单列表
app.get('/api/tickets', async (req, res) => {
  try {
    const { expoId, status, search } = req.query
    let sql = 'SELECT t.*, e.name as expo_name FROM tickets t LEFT JOIN expos e ON t.expo_id = e.id WHERE 1=1'
    const params = []
    if (expoId) { sql += ' AND t.expo_id = ?'; params.push(expoId) }
    if (status) { sql += ' AND t.status = ?'; params.push(status) }
    if (search) { sql += ' AND (t.order_no LIKE ? OR t.user_name LIKE ? OR t.user_phone LIKE ?)'; const s = `%${search}%`; params.push(s, s, s) }
    sql += ' ORDER BY t.create_time DESC LIMIT 200'
    const [rows] = await pool.query(sql, params)
    ok(res, rows)
  } catch (e) {
    console.error('查询订单失败', e)
    fail(res, '查询失败')
  }
})

// 核销票券
app.post('/api/tickets/verify', async (req, res) => {
  try {
    const { code } = req.body
    const [tickets] = await pool.query('SELECT * FROM tickets WHERE verify_code = ?', [code.toUpperCase()])
    if (tickets.length === 0) return fail(res, '核销码无效')
    const ticket = tickets[0]
    if (ticket.status !== 'valid') return fail(res, '该票券状态不可核销')
    await pool.query('UPDATE tickets SET status=?, used_time=?, update_time=? WHERE id=?',
      ['used', Date.now(), Date.now(), ticket.id])
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
    const [expoCount] = await pool.query('SELECT COUNT(*) as c FROM expos WHERE status != "draft"')

    // 订单总数
    let orderSql = 'SELECT COUNT(*) as c FROM tickets'
    let todaySql = 'SELECT COUNT(*) as c FROM tickets WHERE create_time >= ?'
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const params = []
    if (expoId) { orderSql += ' WHERE expo_id = ?'; todaySql += ' AND expo_id = ?'; params.push(expoId) }
    params.unshift(todayStart.getTime())
    const [orderCount] = await pool.query(orderSql, expoId ? [expoId] : [])
    const [todayCount] = await pool.query(todaySql, params)

    // 销售额
    let revSql = 'SELECT SUM(price) as total FROM tickets'
    if (expoId) revSql += ' WHERE expo_id = ?'
    const [revenue] = await pool.query(revSql, expoId ? [expoId] : [])

    // 各展会统计
    const [expos] = await pool.query('SELECT * FROM expos ORDER BY sort DESC')
    const expoStats = []
    for (const expo of expos) {
      const [countRes] = await pool.query('SELECT COUNT(*) as c FROM tickets WHERE expo_id = ?', [expo.id])
      const [revRes] = await pool.query('SELECT SUM(price) as total FROM tickets WHERE expo_id = ?', [expo.id])
      const [soldRes] = await pool.query('SELECT SUM(sold) as total FROM ticket_types WHERE expo_id = ?', [expo.id])
      expoStats.push({
        id: expo.id, name: expo.name, status: expo.status,
        ticketCount: countRes[0].c || 0,
        revenue: revRes[0].total || 0,
        soldCount: soldRes[0].total || 0
      })
    }

    ok(res, {
      totalOrders: orderCount[0].c || 0,
      todayOrders: todayCount[0].c || 0,
      revenue: revenue[0].total || 0,
      expoCount: expoCount[0].c || 0,
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
    const [rows] = await pool.query('SELECT id, username, role, create_time FROM users ORDER BY create_time ASC')
    ok(res, rows)
  } catch (e) {
    fail(res, '查询失败')
  }
})

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role } = req.body
    if (!username || !password) return fail(res, '用户名和密码不能为空')
    const id = uuidv4()
    await pool.query('INSERT INTO users (id, username, password, role, create_time) VALUES (?, ?, ?, ?, ?)',
      [id, username, password, role || 'operator', Date.now()])
    ok(res, { id, username, role: role || 'operator' }, '创建成功')
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return fail(res, '用户名已存在')
    fail(res, '创建失败')
  }
})

app.put('/api/users/:id', async (req, res) => {
  try {
    const { password, role } = req.body
    const updates = []
    const params = []
    if (password) { updates.push('password = ?'); params.push(password) }
    if (role) { updates.push('role = ?'); params.push(role) }
    if (updates.length === 0) return fail(res, '没有更新内容')
    params.push(req.params.id)
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)
    ok(res, null, '更新成功')
  } catch (e) {
    fail(res, '更新失败')
  }
})

app.delete('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [req.params.id])
    if (rows.length > 0 && rows[0].role === 'admin') return fail(res, '不能删除管理员账号')
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id])
    ok(res, null, '删除成功')
  } catch (e) {
    fail(res, '删除失败')
  }
})

// ==================== 健康检查 ====================

app.get('/api/health', (req, res) => {
  ok(res, { status: 'ok', time: new Date().toISOString() })
})

// ==================== 启动 ====================

const PORT = process.env.PORT || 80

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[易票] API 服务已启动 http://0.0.0.0:${PORT}`)
  })
}).catch(e => {
  console.error('[易票] 数据库初始化失败', e)
  process.exit(1)
})
