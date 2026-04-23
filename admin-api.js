/**
 * 易票小程序 H5 管理后台 - API 调用层
 * 对接 Express 后端
 *
 * 配置：在环境配置弹窗中填入后端地址，如 https://express-rzac-xxx.sh.run.tcloudbase.com
 */

let BASE_URL = ''
let currentUser = null

// ===================== 工具函数 =====================

async function request(method, path, data = null) {
  if (!BASE_URL) throw new Error('请先配置后端地址')

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (currentUser) {
    opts.headers['X-User-Id'] = currentUser.id
    opts.headers['X-User-Role'] = currentUser.role
  }

  let url = `${BASE_URL}${path}`
  if (method === 'GET' && data) {
    const params = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    if (params) url += '?' + params
  } else if (data) {
    opts.body = JSON.stringify(data)
  }

  const res = await fetch(url, opts)
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || '请求失败')
  return json.data
}

// ===================== 认证 =====================

async function init(config = {}) {
  if (config.baseUrl) BASE_URL = config.baseUrl.replace(/\/$/, '')
  if (!BASE_URL) throw new Error('请先配置后端地址')
  window._apiInited = true
}

async function login(username, password) {
  const user = await request('POST', '/api/login', { username, password })
  currentUser = user
  return user
}

function logout() {
  currentUser = null
}

// ===================== 业务接口 =====================

/** 展会列表 */
async function getExpos(status) {
  const params = status ? { status } : {}
  return request('GET', '/api/expos', params)
}

/** 获取单个展会 */
async function getExpoById(id) {
  return request('GET', `/api/expos/${id}`)
}

/** 新增展会 */
async function createExpo(data) {
  return request('POST', '/api/expos', data)
}

/** 更新展会 */
async function updateExpo(id, data) {
  return request('PUT', `/api/expos/${id}`, data)
}

/** 删除展会 */
async function deleteExpo(id) {
  return request('DELETE', `/api/expos/${id}`)
}

/** 切换展会状态 */
async function toggleExpoStatus(id, currentStatus) {
  const expo = await getExpoById(id)
  return updateExpo(id, { ...expo, status: currentStatus === 'active' ? 'inactive' : 'active' })
}

/** 票种列表 */
async function getTicketTypes(expoId, status) {
  const params = {}
  if (expoId) params.expoId = expoId
  if (status) params.status = status
  return request('GET', '/api/ticket-types', params)
}

/** 新增票种 */
async function createTicketType(data) {
  return request('POST', '/api/ticket-types', data)
}

/** 更新票种 */
async function updateTicketType(id, data) {
  return request('PUT', `/api/ticket-types/${id}`, data)
}

/** 删除票种 */
async function deleteTicketType(id) {
  return request('DELETE', `/api/ticket-types/${id}`)
}

/** 订单列表 */
async function getTickets(filter = {}, options = {}) {
  return request('GET', '/api/tickets', { ...filter })
}

/** 核销票券 */
async function verifyTicket(code) {
  return request('POST', '/api/tickets/verify', { code })
}

/** 统计数据 */
async function getStats(expoId) {
  const params = {}
  if (expoId) params.expoId = expoId
  return request('GET', '/api/stats', params)
}

/** 用户列表 */
async function getUsers() {
  return request('GET', '/api/users')
}

/** 新增用户 */
async function createUser(data) {
  return request('POST', '/api/users', data)
}

/** 更新用户 */
async function updateUser(id, data) {
  return request('PUT', `/api/users/${id}`, data)
}

/** 删除用户 */
async function deleteUser(id) {
  return request('DELETE', `/api/users/${id}`)
}

// ===================== 导出到全局 =====================
if (typeof window !== 'undefined') {
  window.api = {
    init, login, logout,
    getExpos, getExpoById, createExpo, updateExpo, deleteExpo, toggleExpoStatus,
    getTicketTypes, createTicketType, updateTicketType, deleteTicketType,
    getTickets, verifyTicket, getStats,
    getUsers, createUser, updateUser, deleteUser,
    get currentUser() { return currentUser }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.api
}
