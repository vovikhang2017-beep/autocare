import 'dotenv/config'
import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { resolve } from 'node:path'
import { getDatabase } from './db.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const database = getDatabase()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const jwtSecret = process.env.JWT_SECRET

if (process.env.NODE_ENV === 'production' && Buffer.byteLength(jwtSecret || '') < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters before starting in production.')
}

const tokenSecret = jwtSecret || 'local-development-secret-change-before-deploy'

app.disable('x-powered-by')

app.use((_request, response, next) => {
  response.set({
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  })
  next()
})

app.use(express.json({ limit: '32kb' }))

function getPublicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    createdAt: user.created_at,
  }
}

function getRequestBody(request) {
  if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
    return request.body
  }

  return {}
}

function isUniqueConstraintError(error) {
  return error.errcode === 1555 || error.errcode === 2067
}

function getCarInput(body) {
  const make = typeof body.make === 'string' ? body.make.trim() : ''
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  const licensePlate = typeof body.licensePlate === 'string'
    ? body.licensePlate.trim().toUpperCase()
    : ''
  const productionYear = body.productionYear === '' || body.productionYear == null
    ? null
    : Number(body.productionYear)
  const currentMileage = Number(body.currentMileage)
  const purchaseDate = typeof body.purchaseDate === 'string'
    ? body.purchaseDate.trim()
    : ''
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''

  if (!make || make.length > 100 || !model || model.length > 100) {
    return { error: 'Hãng xe và model không được để trống, tối đa 100 ký tự.' }
  }

  if (!licensePlate || licensePlate.length > 30) {
    return { error: 'Biển số xe không được để trống, tối đa 30 ký tự.' }
  }

  if (
    productionYear !== null &&
    (!Number.isInteger(productionYear) ||
      productionYear < 1886 ||
      productionYear > new Date().getFullYear() + 1)
  ) {
    return { error: 'Năm sản xuất không hợp lệ.' }
  }

  if (!Number.isSafeInteger(currentMileage) || currentMileage < 0) {
    return { error: 'Số km phải là số nguyên không âm.' }
  }

  if (
    purchaseDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
      !Number.isFinite(Date.parse(`${purchaseDate}T00:00:00.000Z`)) ||
      new Date(`${purchaseDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== purchaseDate)
  ) {
    return { error: 'Ngày mua phải có định dạng YYYY-MM-DD hợp lệ.' }
  }

  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol) || imageUrl.length > 2048) {
        return { error: 'Ảnh xe cần là địa chỉ URL http hoặc https hợp lệ.' }
      }
    } catch {
      return { error: 'Ảnh xe cần là địa chỉ URL http hoặc https hợp lệ.' }
    }
  }

  return {
    value: {
      make,
      model,
      productionYear,
      licensePlate,
      currentMileage,
      purchaseDate: purchaseDate || null,
      imageUrl: imageUrl || null,
    },
  }
}

function getPublicCar(car) {
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    productionYear: car.production_year,
    licensePlate: car.license_plate,
    currentMileage: car.current_mileage,
    purchaseDate: car.purchase_date,
    imageUrl: car.image_url,
    status: car.status,
    createdAt: car.created_at,
  }
}

function getMaintenanceInput(body) {
  const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : ''
  const performedAt = typeof body.performedAt === 'string'
    ? body.performedAt.trim()
    : ''
  const mileage = Number(body.mileage)
  const cost = Number(body.cost)
  const garage = typeof body.garage === 'string' ? body.garage.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (!itemName || itemName.length > 150) {
    return { error: 'Tên hạng mục không được để trống, tối đa 150 ký tự.' }
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(performedAt) ||
    !Number.isFinite(Date.parse(`${performedAt}T00:00:00.000Z`)) ||
    new Date(`${performedAt}T00:00:00.000Z`).toISOString().slice(0, 10) !== performedAt
  ) {
    return { error: 'Ngày thực hiện phải có định dạng YYYY-MM-DD hợp lệ.' }
  }

  if (!Number.isSafeInteger(mileage) || mileage < 0) {
    return { error: 'Số km phải là số nguyên không âm.' }
  }

  if (!Number.isFinite(cost) || cost < 0 || !/^\d+(\.\d{1,2})?$/.test(String(body.cost))) {
    return { error: 'Chi phí phải là số tiền không âm, tối đa 2 chữ số thập phân.' }
  }

  if (garage.length > 180 || notes.length > 5000) {
    return { error: 'Garage tối đa 180 ký tự; ghi chú tối đa 5000 ký tự.' }
  }

  return {
    value: {
      itemName,
      performedAt,
      mileage,
      cost,
      garage: garage || null,
      notes: notes || null,
    },
  }
}

function getPublicMaintenanceRecord(record) {
  return {
    id: record.id,
    carId: record.car_id,
    itemName: record.item_name,
    performedAt: record.performed_at,
    mileage: record.mileage,
    cost: record.cost,
    garage: record.garage,
    notes: record.notes,
    createdAt: record.created_at,
  }
}

function getScheduleInput(body) {
  const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : ''
  const nextDueMileage = body.nextDueMileage === '' || body.nextDueMileage == null
    ? null
    : Number(body.nextDueMileage)
  const nextDueDate = typeof body.nextDueDate === 'string'
    ? body.nextDueDate.trim()
    : ''
  const reminderBeforeKm = body.reminderBeforeKm === '' || body.reminderBeforeKm == null
    ? null
    : Number(body.reminderBeforeKm)
  const reminderBeforeDays = body.reminderBeforeDays === '' || body.reminderBeforeDays == null
    ? null
    : Number(body.reminderBeforeDays)
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (!itemName || itemName.length > 150) {
    return { error: 'Tên hạng mục không được để trống, tối đa 150 ký tự.' }
  }

  if (
    nextDueMileage === null &&
    !nextDueDate
  ) {
    return { error: 'Hãy nhập hạn theo số km hoặc ngày.' }
  }

  if (
    nextDueMileage !== null &&
    (!Number.isSafeInteger(nextDueMileage) || nextDueMileage < 0)
  ) {
    return { error: 'Số km đến hạn phải là số nguyên không âm.' }
  }

  if (
    nextDueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate) ||
      !Number.isFinite(Date.parse(`${nextDueDate}T00:00:00.000Z`)) ||
      new Date(`${nextDueDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== nextDueDate)
  ) {
    return { error: 'Ngày đến hạn phải có định dạng YYYY-MM-DD hợp lệ.' }
  }

  if (
    reminderBeforeKm !== null &&
    (!Number.isSafeInteger(reminderBeforeKm) || reminderBeforeKm < 0)
  ) {
    return { error: 'Khoảng nhắc theo km phải là số nguyên không âm.' }
  }

  if (
    reminderBeforeDays !== null &&
    (!Number.isSafeInteger(reminderBeforeDays) || reminderBeforeDays < 0)
  ) {
    return { error: 'Khoảng nhắc theo ngày phải là số nguyên không âm.' }
  }

  if (notes.length > 5000) {
    return { error: 'Ghi chú tối đa 5000 ký tự.' }
  }

  return {
    value: {
      itemName,
      nextDueMileage,
      nextDueDate: nextDueDate || null,
      reminderBeforeKm,
      reminderBeforeDays,
      notes: notes || null,
    },
  }
}

function getPublicSchedule(schedule) {
  return {
    id: schedule.id,
    carId: schedule.car_id,
    itemName: schedule.item_name,
    nextDueMileage: schedule.next_due_mileage,
    nextDueDate: schedule.next_due_date,
    reminderBeforeKm: schedule.reminder_before_km,
    reminderBeforeDays: schedule.reminder_before_days,
    notes: schedule.notes,
    isActive: Boolean(schedule.is_active),
    make: schedule.make,
    model: schedule.model,
    licensePlate: schedule.license_plate,
    currentMileage: schedule.current_mileage,
  }
}

function authenticate(request, response, next) {
  const authorization = request.get('authorization')
  const [scheme, token] = authorization?.split(' ') || []

  if (scheme !== 'Bearer' || !token) {
    response.status(401).json({ error: 'Please sign in to continue.' })
    return
  }

  try {
    const payload = jwt.verify(token, tokenSecret)

    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.version !== 'number'
    ) {
      response.status(401).json({ error: 'Invalid or expired access token.' })
      return
    }

    const user = database.prepare(
      'SELECT id, full_name, email, created_at, token_version FROM users WHERE id = ?',
    ).get(Number(payload.sub))

    if (!user || user.token_version !== payload.version) {
      response.status(401).json({ error: 'Invalid or expired access token.' })
      return
    }

    request.user = user
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      response.status(401).json({ error: 'Invalid or expired access token.' })
      return
    }

    next(error)
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'AutoCare API' })
})

app.get('/api/health/database', (_request, response) => {
  try {
    database.prepare('SELECT 1').get()
    response.json({ status: 'ok', database: 'connected', engine: 'sqlite' })
  } catch (error) {
    console.error('SQLite health check failed:', error.message)
    response.status(503).json({
      status: 'error',
      database: 'unavailable',
      message: 'Check the SQLite database file and its permissions.',
    })
  }
})

app.get('/api/dashboard', authenticate, (request, response) => {
  const carTotals = database.prepare(
    `SELECT
       COUNT(*) AS total_cars,
       COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_cars
     FROM cars
     WHERE user_id = ?`,
  ).get(request.user.id)

  const maintenanceTotals = database.prepare(
    `SELECT COALESCE(SUM(records.cost), 0) AS total_cost
     FROM maintenance_records AS records
     JOIN cars ON cars.id = records.car_id
     WHERE cars.user_id = ?`,
  ).get(request.user.id)

  const latestRecord = database.prepare(
    `SELECT records.*, cars.make, cars.model, cars.license_plate
     FROM maintenance_records AS records
     JOIN cars ON cars.id = records.car_id
     WHERE cars.user_id = ?
     ORDER BY records.performed_at DESC, records.id DESC
     LIMIT 1`,
  ).get(request.user.id)

  response.json({
    totalCars: carTotals.total_cars,
    activeCars: carTotals.active_cars,
    totalMaintenanceCost: maintenanceTotals.total_cost,
    latestMaintenance: latestRecord
      ? {
        id: latestRecord.id,
        itemName: latestRecord.item_name,
        performedAt: latestRecord.performed_at,
        mileage: latestRecord.mileage,
        cost: latestRecord.cost,
        make: latestRecord.make,
        model: latestRecord.model,
        licensePlate: latestRecord.license_plate,
      }
      : null,
  })
})

app.post('/api/auth/register', async (request, response, next) => {
  const body = getRequestBody(request)
  const fullName = typeof body.fullName === 'string'
    ? body.fullName.trim()
    : ''
  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : ''
  const password = typeof body.password === 'string'
    ? body.password
    : ''

  if (fullName.length < 2 || fullName.length > 120) {
    response.status(400).json({ error: 'Name must be between 2 and 120 characters.' })
    return
  }

  if (!emailPattern.test(email) || email.length > 255) {
    response.status(400).json({ error: 'Enter a valid email address.' })
    return
  }

  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    response.status(400).json({ error: 'Password must be between 8 and 72 characters.' })
    return
  }

  try {
    const existingUser = database.prepare(
      'SELECT id FROM users WHERE email = ?',
    ).get(email)

    if (existingUser) {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const result = database.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
    ).run(fullName, email, passwordHash)
    const user = database.prepare(
      'SELECT id, full_name, email, created_at, token_version FROM users WHERE id = ?',
    ).get(Number(result.lastInsertRowid))
    const token = jwt.sign(
      { version: user.token_version },
      tokenSecret,
      { subject: String(user.id), expiresIn: '2h' },
    )

    response.status(201).json({ user: getPublicUser(user), token })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  const body = getRequestBody(request)
  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : ''
  const password = typeof body.password === 'string'
    ? body.password
    : ''

  if (!emailPattern.test(email) || !password) {
    response.status(400).json({ error: 'Enter a valid email address and password.' })
    return
  }

  try {
    const user = database.prepare(
      'SELECT id, full_name, email, password_hash, created_at, token_version FROM users WHERE email = ?',
    ).get(email)

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      response.status(401).json({ error: 'Email or password is incorrect.' })
      return
    }

    const token = jwt.sign(
      { version: user.token_version },
      tokenSecret,
      { subject: String(user.id), expiresIn: '2h' },
    )

    response.json({ user: getPublicUser(user), token })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', authenticate, (request, response) => {
  response.json({ user: getPublicUser(request.user) })
})

app.patch('/api/auth/me', authenticate, (request, response) => {
  const body = getRequestBody(request)
  const fullName = typeof body.fullName === 'string'
    ? body.fullName.trim()
    : ''
  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : ''

  if (fullName.length < 2 || fullName.length > 120) {
    response.status(400).json({ error: 'Name must be between 2 and 120 characters.' })
    return
  }

  if (!emailPattern.test(email) || email.length > 255) {
    response.status(400).json({ error: 'Enter a valid email address.' })
    return
  }

  try {
    database.prepare(
      `UPDATE users
       SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP,
           token_version = token_version + 1
       WHERE id = ?`,
    ).run(fullName, email, request.user.id)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    throw error
  }

  const user = database.prepare(
    'SELECT id, full_name, email, created_at, token_version FROM users WHERE id = ?',
  ).get(request.user.id)
  const token = jwt.sign(
    { version: user.token_version },
    tokenSecret,
    { subject: String(user.id), expiresIn: '2h' },
  )

  response.json({ user: getPublicUser(user), token })
})

app.patch('/api/auth/password', authenticate, async (request, response, next) => {
  const body = getRequestBody(request)
  const currentPassword = typeof body.currentPassword === 'string'
    ? body.currentPassword
    : ''
  const newPassword = typeof body.newPassword === 'string'
    ? body.newPassword
    : ''

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    response.status(400).json({ error: 'New password must be between 8 and 72 characters.' })
    return
  }

  try {
    const account = database.prepare(
      'SELECT password_hash FROM users WHERE id = ?',
    ).get(request.user.id)

    if (!account || !(await bcrypt.compare(currentPassword, account.password_hash))) {
      response.status(401).json({ error: 'Current password is incorrect.' })
      return
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    database.prepare(
      `UPDATE users
       SET password_hash = ?, token_version = token_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(passwordHash, request.user.id)

    const user = database.prepare(
      'SELECT id, full_name, email, created_at, token_version FROM users WHERE id = ?',
    ).get(request.user.id)
    const token = jwt.sign(
      { version: user.token_version },
      tokenSecret,
      { subject: String(user.id), expiresIn: '2h' },
    )

    response.json({ token })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', authenticate, (request, response) => {
  database.prepare(
    'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
  ).run(request.user.id)

  response.status(204).end()
})

app.post('/api/cars/demo', authenticate, (request, response) => {
  const demoLicensePrefix = `DEMO-${request.user.id}-`
  const existingDemoCars = database.prepare(
    `SELECT * FROM cars
     WHERE user_id = ? AND license_plate LIKE ?
     ORDER BY license_plate`,
  ).all(request.user.id, `${demoLicensePrefix}%`)

  if (existingDemoCars.length === 2) {
    response.json({ cars: existingDemoCars.map(getPublicCar) })
    return
  }

  const existingCars = database.prepare(
    'SELECT COUNT(*) AS count FROM cars WHERE user_id = ?',
  ).get(request.user.id)

  if (existingCars.count > 0) {
    response.status(409).json({
      error: 'Chỉ có thể thêm dữ liệu mẫu khi tài khoản chưa có xe.',
    })
    return
  }

  try {
    database.exec('BEGIN')
    const insertCar = database.prepare(
      `INSERT INTO cars (
        user_id, make, model, production_year, license_plate,
        current_mileage, purchase_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    insertCar.run(
      request.user.id,
      'Toyota',
      'Vios',
      2021,
      `${demoLicensePrefix}01`,
      65000,
      '2021-06-15',
    )
    insertCar.run(
      request.user.id,
      'Honda',
      'City',
      2022,
      `${demoLicensePrefix}02`,
      32000,
      '2022-03-20',
    )
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')

    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'Không thể thêm xe mẫu do biển số bị trùng.' })
      return
    }

    throw error
  }

  const cars = database.prepare(
    `SELECT * FROM cars
     WHERE user_id = ? AND license_plate LIKE ?
     ORDER BY license_plate`,
  ).all(request.user.id, `${demoLicensePrefix}%`)

  response.status(201).json({ cars: cars.map(getPublicCar) })
})

app.get('/api/cars', authenticate, (request, response) => {
  const cars = database.prepare(
    'SELECT * FROM cars WHERE user_id = ? ORDER BY created_at DESC, id DESC',
  ).all(request.user.id)

  response.json({ cars: cars.map(getPublicCar) })
})

app.post('/api/cars', authenticate, (request, response) => {
  const { value, error } = getCarInput(getRequestBody(request))

  if (error) {
    response.status(400).json({ error })
    return
  }

  try {
    const result = database.prepare(
      `INSERT INTO cars (
        user_id, make, model, production_year, license_plate,
        current_mileage, purchase_date, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      request.user.id,
      value.make,
      value.model,
      value.productionYear,
      value.licensePlate,
      value.currentMileage,
      value.purchaseDate,
      value.imageUrl,
    )
    const car = database.prepare(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
    ).get(Number(result.lastInsertRowid), request.user.id)

    response.status(201).json({ car: getPublicCar(car) })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'Biển số xe này đã được đăng ký.' })
      return
    }

    throw error
  }
})

app.patch('/api/cars/:id', authenticate, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const { value, error } = getCarInput(getRequestBody(request))
  if (error) {
    response.status(400).json({ error })
    return
  }

  const ownedCar = database.prepare(
    'SELECT id FROM cars WHERE id = ? AND user_id = ?',
  ).get(id, request.user.id)
  if (!ownedCar) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  try {
    database.prepare(
      `UPDATE cars
       SET make = ?, model = ?, production_year = ?, license_plate = ?,
           current_mileage = ?, purchase_date = ?, image_url = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
    ).run(
      value.make,
      value.model,
      value.productionYear,
      value.licensePlate,
      value.currentMileage,
      value.purchaseDate,
      value.imageUrl,
      id,
      request.user.id,
    )
    const car = database.prepare(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
    ).get(id, request.user.id)

    response.json({ car: getPublicCar(car) })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'Biển số xe này đã được đăng ký.' })
      return
    }

    throw error
  }
})

app.delete('/api/cars/:id', authenticate, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const result = database.prepare(
    'DELETE FROM cars WHERE id = ? AND user_id = ?',
  ).run(id, request.user.id)

  if (result.changes === 0) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  response.status(204).end()
})

app.get('/api/cars/:carId/maintenance', authenticate, (request, response) => {
  const carId = Number(request.params.carId)
  if (!Number.isSafeInteger(carId) || carId < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const car = database.prepare(
    'SELECT id FROM cars WHERE id = ? AND user_id = ?',
  ).get(carId, request.user.id)
  if (!car) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  const records = database.prepare(
    `SELECT * FROM maintenance_records
     WHERE car_id = ?
     ORDER BY performed_at DESC, id DESC`,
  ).all(carId)

  response.json({ records: records.map(getPublicMaintenanceRecord) })
})

app.post('/api/cars/:carId/maintenance/demo', authenticate, (request, response) => {
  const carId = Number(request.params.carId)
  if (!Number.isSafeInteger(carId) || carId < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const car = database.prepare(
    'SELECT id, current_mileage FROM cars WHERE id = ? AND user_id = ?',
  ).get(carId, request.user.id)
  if (!car) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  const existingRecord = database.prepare(
    'SELECT id FROM maintenance_records WHERE car_id = ? LIMIT 1',
  ).get(carId)
  if (existingRecord) {
    response.status(409).json({
      error: 'Xe này đã có lịch sử. Không thể thêm dữ liệu mẫu để tránh trộn với dữ liệu thật.',
    })
    return
  }

  const makeDateDaysAgo = (daysAgo) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - daysAgo)
    return date.toISOString().slice(0, 10)
  }
  const previousMileage = Math.max(0, car.current_mileage - 5000)

  try {
    database.exec('BEGIN')
    const insertRecord = database.prepare(
      `INSERT INTO maintenance_records (
        car_id, item_name, performed_at, mileage, cost, garage, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    insertRecord.run(
      carId,
      'Thay dầu động cơ',
      makeDateDaysAgo(180),
      previousMileage,
      850000,
      'Garage minh họa',
      'Dữ liệu mẫu — vui lòng thay bằng thông tin thực tế.',
    )
    insertRecord.run(
      carId,
      'Kiểm tra và bảo dưỡng định kỳ',
      makeDateDaysAgo(30),
      car.current_mileage,
      500000,
      'Garage minh họa',
      'Dữ liệu mẫu — vui lòng thay bằng thông tin thực tế.',
    )
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  const records = database.prepare(
    `SELECT * FROM maintenance_records
     WHERE car_id = ?
     ORDER BY performed_at DESC, id DESC`,
  ).all(carId)

  response.status(201).json({ records: records.map(getPublicMaintenanceRecord) })
})

app.post('/api/cars/:carId/maintenance', authenticate, (request, response) => {
  const carId = Number(request.params.carId)
  if (!Number.isSafeInteger(carId) || carId < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const car = database.prepare(
    'SELECT id FROM cars WHERE id = ? AND user_id = ?',
  ).get(carId, request.user.id)
  if (!car) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  const { value, error } = getMaintenanceInput(getRequestBody(request))
  if (error) {
    response.status(400).json({ error })
    return
  }

  const result = database.prepare(
    `INSERT INTO maintenance_records (
      car_id, item_name, performed_at, mileage, cost, garage, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    carId,
    value.itemName,
    value.performedAt,
    value.mileage,
    value.cost,
    value.garage,
    value.notes,
  )
  const record = database.prepare(
    'SELECT * FROM maintenance_records WHERE id = ? AND car_id = ?',
  ).get(Number(result.lastInsertRowid), carId)

  response.status(201).json({ record: getPublicMaintenanceRecord(record) })
})

app.patch('/api/maintenance/:id', authenticate, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Mã lịch sử bảo dưỡng không hợp lệ.' })
    return
  }

  const { value, error } = getMaintenanceInput(getRequestBody(request))
  if (error) {
    response.status(400).json({ error })
    return
  }

  const ownedRecord = database.prepare(
    `SELECT maintenance_records.id, maintenance_records.car_id
     FROM maintenance_records
     JOIN cars ON cars.id = maintenance_records.car_id
     WHERE maintenance_records.id = ? AND cars.user_id = ?`,
  ).get(id, request.user.id)
  if (!ownedRecord) {
    response.status(404).json({ error: 'Không tìm thấy lịch sử bảo dưỡng.' })
    return
  }

  database.prepare(
    `UPDATE maintenance_records
     SET item_name = ?, performed_at = ?, mileage = ?, cost = ?,
         garage = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(
    value.itemName,
    value.performedAt,
    value.mileage,
    value.cost,
    value.garage,
    value.notes,
    id,
  )
  const record = database.prepare(
    'SELECT * FROM maintenance_records WHERE id = ?',
  ).get(id)

  response.json({ record: getPublicMaintenanceRecord(record) })
})

app.delete('/api/maintenance/:id', authenticate, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Mã lịch sử bảo dưỡng không hợp lệ.' })
    return
  }

  const result = database.prepare(
    `DELETE FROM maintenance_records
     WHERE id = ? AND car_id IN (
       SELECT id FROM cars WHERE user_id = ?
     )`,
  ).run(id, request.user.id)
  if (result.changes === 0) {
    response.status(404).json({ error: 'Không tìm thấy lịch sử bảo dưỡng.' })
    return
  }

  response.status(204).end()
})

app.get('/api/schedules', authenticate, (request, response) => {
  const schedules = database.prepare(
    `SELECT schedules.*, cars.make, cars.model, cars.license_plate, cars.current_mileage
     FROM maintenance_schedules AS schedules
     JOIN cars ON cars.id = schedules.car_id
     WHERE cars.user_id = ? AND schedules.is_active = 1
     ORDER BY
       CASE WHEN schedules.next_due_date IS NULL THEN 1 ELSE 0 END,
       schedules.next_due_date ASC,
       schedules.next_due_mileage ASC`,
  ).all(request.user.id)

  response.json({ schedules: schedules.map(getPublicSchedule) })
})

app.post('/api/cars/:carId/schedules', authenticate, (request, response) => {
  const carId = Number(request.params.carId)
  if (!Number.isSafeInteger(carId) || carId < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const car = database.prepare(
    'SELECT id FROM cars WHERE id = ? AND user_id = ?',
  ).get(carId, request.user.id)
  if (!car) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  const { value, error } = getScheduleInput(getRequestBody(request))
  if (error) {
    response.status(400).json({ error })
    return
  }

  const result = database.prepare(
    `INSERT INTO maintenance_schedules (
      car_id, item_name, next_due_mileage, next_due_date,
      reminder_before_km, reminder_before_days, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    carId,
    value.itemName,
    value.nextDueMileage,
    value.nextDueDate,
    value.reminderBeforeKm,
    value.reminderBeforeDays,
    value.notes,
  )
  const schedule = database.prepare(
    `SELECT schedules.*, cars.make, cars.model, cars.license_plate, cars.current_mileage
     FROM maintenance_schedules AS schedules
     JOIN cars ON cars.id = schedules.car_id
     WHERE schedules.id = ? AND cars.user_id = ?`,
  ).get(Number(result.lastInsertRowid), request.user.id)

  response.status(201).json({ schedule: getPublicSchedule(schedule) })
})

app.post('/api/cars/:carId/schedules/demo', authenticate, (request, response) => {
  const carId = Number(request.params.carId)
  if (!Number.isSafeInteger(carId) || carId < 1) {
    response.status(400).json({ error: 'Mã xe không hợp lệ.' })
    return
  }

  const car = database.prepare(
    `SELECT id, current_mileage
     FROM cars
     WHERE id = ? AND user_id = ?`,
  ).get(carId, request.user.id)
  if (!car) {
    response.status(404).json({ error: 'Không tìm thấy xe.' })
    return
  }

  const existingSchedule = database.prepare(
    'SELECT id FROM maintenance_schedules WHERE car_id = ? LIMIT 1',
  ).get(carId)
  if (existingSchedule) {
    response.status(409).json({
      error: 'Xe này đã có lịch nhắc. Không thể thêm dữ liệu mẫu để tránh trộn với dữ liệu thật.',
    })
    return
  }

  const makeDateDaysAhead = (daysAhead) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + daysAhead)
    return date.toISOString().slice(0, 10)
  }

  try {
    database.exec('BEGIN')
    const insertSchedule = database.prepare(
      `INSERT INTO maintenance_schedules (
        car_id, item_name, next_due_mileage, next_due_date,
        reminder_before_km, reminder_before_days, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    insertSchedule.run(
      carId,
      'Thay dầu động cơ',
      car.current_mileage + 5000,
      makeDateDaysAhead(180),
      1000,
      30,
      'Lịch mẫu — vui lòng thay bằng thông tin thực tế.',
    )
    insertSchedule.run(
      carId,
      'Bảo dưỡng định kỳ',
      car.current_mileage + 10000,
      makeDateDaysAhead(365),
      1000,
      30,
      'Lịch mẫu — vui lòng thay bằng thông tin thực tế.',
    )
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  const schedules = database.prepare(
    `SELECT schedules.*, cars.make, cars.model, cars.license_plate, cars.current_mileage
     FROM maintenance_schedules AS schedules
     JOIN cars ON cars.id = schedules.car_id
     WHERE schedules.car_id = ? AND cars.user_id = ? AND schedules.is_active = 1
     ORDER BY schedules.id`,
  ).all(carId, request.user.id)

  response.status(201).json({ schedules: schedules.map(getPublicSchedule) })
})

app.patch('/api/schedules/:id', authenticate, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Mã lịch nhắc không hợp lệ.' })
    return
  }

  const ownedSchedule = database.prepare(
    `SELECT schedules.id, schedules.car_id
     FROM maintenance_schedules AS schedules
     JOIN cars ON cars.id = schedules.car_id
     WHERE schedules.id = ? AND cars.user_id = ?`,
  ).get(id, request.user.id)
  if (!ownedSchedule) {
    response.status(404).json({ error: 'Không tìm thấy lịch nhắc.' })
    return
  }

  const { value, error } = getScheduleInput(getRequestBody(request))
  if (error) {
    response.status(400).json({ error })
    return
  }

  database.prepare(
    `UPDATE maintenance_schedules
     SET item_name = ?, next_due_mileage = ?, next_due_date = ?,
         reminder_before_km = ?, reminder_before_days = ?, notes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(
    value.itemName,
    value.nextDueMileage,
    value.nextDueDate,
    value.reminderBeforeKm,
    value.reminderBeforeDays,
    value.notes,
    id,
  )
  const schedule = database.prepare(
    `SELECT schedules.*, cars.make, cars.model, cars.license_plate, cars.current_mileage
     FROM maintenance_schedules AS schedules
     JOIN cars ON cars.id = schedules.car_id
     WHERE schedules.id = ? AND cars.user_id = ?`,
  ).get(id, request.user.id)

  response.json({ schedule: getPublicSchedule(schedule) })
})

app.delete('/api/schedules/:id', authenticate, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Mã lịch nhắc không hợp lệ.' })
    return
  }

  const result = database.prepare(
    `DELETE FROM maintenance_schedules
     WHERE id = ? AND car_id IN (
       SELECT id FROM cars WHERE user_id = ?
     )`,
  ).run(id, request.user.id)
  if (result.changes === 0) {
    response.status(404).json({ error: 'Không tìm thấy lịch nhắc.' })
    return
  }

  response.status(204).end()
})

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' })
})

if (process.env.NODE_ENV === 'production') {
  const frontendDirectory = resolve(import.meta.dirname, '../dist')
  app.use(express.static(frontendDirectory, { index: false }))
  app.get('/{*splat}', (_request, response, next) => {
    response.sendFile(resolve(frontendDirectory, 'index.html'), (error) => {
      if (error) {
        next(error)
      }
    })
  })
} else {
  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found.' })
  })
}

app.use((error, _request, response, _next) => {
  if (error.status === 413) {
    response.status(413).json({ error: 'Request body is too large.' })
    return
  }

  if (error.status === 400 && error.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'Request body must contain valid JSON.' })
    return
  }

  console.error('API request failed:', error.message)
  response.status(500).json({ error: 'An unexpected server error occurred.' })
})

app.listen(port, () => {
  console.log(`AutoCare API is running at http://localhost:${port}`)
})
