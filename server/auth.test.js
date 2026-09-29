import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'

let appProcess
let appOutput = ''
let baseUrl
let temporaryDirectory

async function getAvailablePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise((resolveServer, rejectServer) => {
    server.close((error) => (error ? rejectServer(error) : resolveServer()))
  })
  return port
}

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'autocare-auth-'))
  const port = await getAvailablePort()
  baseUrl = `http://127.0.0.1:${port}`
  const projectDirectory = resolve(import.meta.dirname, '..')

  appProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      JWT_SECRET: 'test-secret-for-auth-routes',
      PORT: String(port),
      SQLITE_DATABASE_PATH: join(temporaryDirectory, 'auth.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  appProcess.stdout.setEncoding('utf8').on('data', (chunk) => { appOutput += chunk })
  appProcess.stderr.setEncoding('utf8').on('data', (chunk) => { appOutput += chunk })

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (appProcess.exitCode !== null) {
      throw new Error(`API server exited during startup:\n${appOutput}`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) {
        return
      }
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
    }
  }

  throw new Error(`API server did not start in time:\n${appOutput}`)
})

after(async () => {
  if (appProcess && appProcess.exitCode === null) {
    appProcess.kill()
    await once(appProcess, 'exit')
  }

  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('registration, login, profile update, and logout work with JWTs', async () => {
  const unauthenticatedResponse = await fetch(`${baseUrl}/api/auth/me`)
  assert.equal(unauthenticatedResponse.status, 401)
  assert.equal(unauthenticatedResponse.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(unauthenticatedResponse.headers.get('x-frame-options'), 'DENY')
  assert.equal(
    unauthenticatedResponse.headers.get('content-security-policy'),
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
  )

  const invalidRegistrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'A',
      email: 'not-an-email',
      password: 'short',
    }),
  })
  assert.equal(invalidRegistrationResponse.status, 400)
  assert.deepEqual(await invalidRegistrationResponse.json(), {
    error: 'Name must be between 2 and 120 characters.',
  })

  const invalidJsonResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email":',
  })
  assert.equal(invalidJsonResponse.status, 400)
  assert.deepEqual(await invalidJsonResponse.json(), {
    error: 'Request body must contain valid JSON.',
  })

  const oversizedBodyResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'x'.repeat(40_000) }),
  })
  assert.equal(oversizedBodyResponse.status, 413)
  assert.deepEqual(await oversizedBodyResponse.json(), {
    error: 'Request body is too large.',
  })

  const missingRouteResponse = await fetch(`${baseUrl}/api/not-a-route`)
  assert.equal(missingRouteResponse.status, 404)
  assert.deepEqual(await missingRouteResponse.json(), {
    error: 'API endpoint not found.',
  })

  const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Nguyen Van A',
      email: 'TEST@example.com',
      password: 'secure-password-123',
    }),
  })
  assert.equal(registrationResponse.status, 201)
  const registration = await registrationResponse.json()
  assert.equal(registration.user.email, 'test@example.com')
  assert.equal(registration.user.fullName, 'Nguyen Van A')
  assert.ok(registration.token)
  assert.equal('password_hash' in registration.user, false)

  const duplicateResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Nguyen Van B',
      email: 'test@example.com',
      password: 'secure-password-123',
    }),
  })
  assert.equal(duplicateResponse.status, 409)

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ' Test@Example.com ',
      password: 'secure-password-123',
    }),
  })
  assert.equal(loginResponse.status, 200)
  const login = await loginResponse.json()

  const invalidLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'wrong-password' }),
  })
  assert.equal(invalidLoginResponse.status, 401)

  const profileResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${login.token}` },
  })
  assert.equal(profileResponse.status, 200)
  assert.equal((await profileResponse.json()).user.fullName, 'Nguyen Van A')

  const missingCurrentPasswordResponse = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword: 'incorrect-password', newPassword: 'new-secure-password-456' }),
  })
  assert.equal(missingCurrentPasswordResponse.status, 401)

  const tooShortPasswordResponse = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword: 'secure-password-123', newPassword: 'short' }),
  })
  assert.equal(tooShortPasswordResponse.status, 400)

  const updateResponse = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fullName: 'Nguyen Van C',
      email: 'new@example.com',
    }),
  })
  assert.equal(updateResponse.status, 200)
  const updated = await updateResponse.json()
  assert.equal(updated.user.fullName, 'Nguyen Van C')
  assert.equal(updated.user.email, 'new@example.com')
  assert.ok(updated.token)

  const passwordChangeResponse = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${updated.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'secure-password-123',
      newPassword: 'new-secure-password-456',
    }),
  })
  assert.equal(passwordChangeResponse.status, 200)
  const passwordChange = await passwordChangeResponse.json()
  assert.ok(passwordChange.token)

  const invalidatedProfileResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${updated.token}` },
  })
  assert.equal(invalidatedProfileResponse.status, 401)

  const newPasswordLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'new@example.com',
      password: 'new-secure-password-456',
    }),
  })
  assert.equal(newPasswordLoginResponse.status, 200)

  const oldPasswordLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'new@example.com',
      password: 'secure-password-123',
    }),
  })
  assert.equal(oldPasswordLoginResponse.status, 401)

  const expiredProfileResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${login.token}` },
  })
  assert.equal(expiredProfileResponse.status, 401)

  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${passwordChange.token}` },
  })
  assert.equal(logoutResponse.status, 204)

  const loggedOutProfileResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${passwordChange.token}` },
  })
  assert.equal(loggedOutProfileResponse.status, 401)
})

test('users can only create, read, update, and delete their own cars', async () => {
  async function register(email) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Car Owner',
        email,
        password: 'secure-password-123',
      }),
    })
    assert.equal(response.status, 201)
    return response.json()
  }

  const owner = await register('car-owner@example.com')
  const otherUser = await register('other-owner@example.com')
  const ownerAuthHeaders = { Authorization: `Bearer ${owner.token}` }
  const headers = { ...ownerAuthHeaders, 'Content-Type': 'application/json' }
  const carInput = {
    make: 'Honda',
    model: 'Civic',
    productionYear: 2020,
    licensePlate: '  51A-12345 ',
    currentMileage: 65000,
    purchaseDate: '2023-06-15',
    imageUrl: '',
  }

  const unauthorizedResponse = await fetch(`${baseUrl}/api/cars`)
  assert.equal(unauthorizedResponse.status, 401)

  const invalidCarResponse = await fetch(`${baseUrl}/api/cars`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...carInput, currentMileage: -1 }),
  })
  assert.equal(invalidCarResponse.status, 400)

  const createResponse = await fetch(`${baseUrl}/api/cars`, {
    method: 'POST',
    headers,
    body: JSON.stringify(carInput),
  })
  assert.equal(createResponse.status, 201)
  const { car } = await createResponse.json()
  assert.equal(car.make, 'Honda')
  assert.equal(car.licensePlate, '51A-12345')
  assert.equal(car.currentMileage, 65000)

  const duplicateResponse = await fetch(`${baseUrl}/api/cars`, {
    method: 'POST',
    headers,
    body: JSON.stringify(carInput),
  })
  assert.equal(duplicateResponse.status, 409)

  const listResponse = await fetch(`${baseUrl}/api/cars`, { headers })
  assert.equal(listResponse.status, 200)
  assert.equal((await listResponse.json()).cars.length, 1)

  const updateResponse = await fetch(`${baseUrl}/api/cars/${car.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ ...carInput, currentMileage: 70000 }),
  })
  assert.equal(updateResponse.status, 200)
  assert.equal((await updateResponse.json()).car.currentMileage, 70000)

  const otherUserHeaders = { Authorization: `Bearer ${otherUser.token}` }
  const otherUsersList = await fetch(`${baseUrl}/api/cars`, {
    headers: otherUserHeaders,
  })
  assert.deepEqual((await otherUsersList.json()).cars, [])

  const otherUsersUpdate = await fetch(`${baseUrl}/api/cars/${car.id}`, {
    method: 'PATCH',
    headers: { ...otherUserHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(carInput),
  })
  assert.equal(otherUsersUpdate.status, 404)

  const otherUsersDelete = await fetch(`${baseUrl}/api/cars/${car.id}`, {
    method: 'DELETE',
    headers: otherUserHeaders,
  })
  assert.equal(otherUsersDelete.status, 404)

  const deleteResponse = await fetch(`${baseUrl}/api/cars/${car.id}`, {
    method: 'DELETE',
    headers: ownerAuthHeaders,
  })
  assert.equal(deleteResponse.status, 204)

  const deletedCarResponse = await fetch(`${baseUrl}/api/cars/${car.id}`, {
    method: 'DELETE',
    headers: ownerAuthHeaders,
  })
  assert.equal(deletedCarResponse.status, 404)
})

test('signed-in users can add demo cars once when their list is empty', async () => {
  const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Demo User',
      email: 'demo-user@example.com',
      password: 'secure-password-123',
    }),
  })
  const { token } = await registrationResponse.json()
  const headers = { Authorization: `Bearer ${token}` }

  const demoResponse = await fetch(`${baseUrl}/api/cars/demo`, {
    method: 'POST',
    headers,
  })
  assert.equal(demoResponse.status, 201)
  const demoData = await demoResponse.json()
  assert.equal(demoData.cars.length, 2)
  assert.deepEqual(
    demoData.cars.map((car) => `${car.make} ${car.model}`),
    ['Toyota Vios', 'Honda City'],
  )

  const repeatResponse = await fetch(`${baseUrl}/api/cars/demo`, {
    method: 'POST',
    headers,
  })
  assert.equal(repeatResponse.status, 200)
  assert.equal((await repeatResponse.json()).cars.length, 2)

  const listResponse = await fetch(`${baseUrl}/api/cars`, { headers })
  assert.equal((await listResponse.json()).cars.length, 2)

  const carOwnerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Existing Car Owner',
      email: 'existing-car-owner@example.com',
      password: 'secure-password-123',
    }),
  })
  const { token: carOwnerToken } = await carOwnerResponse.json()
  const carOwnerHeaders = {
    Authorization: `Bearer ${carOwnerToken}`,
    'Content-Type': 'application/json',
  }

  await fetch(`${baseUrl}/api/cars`, {
    method: 'POST',
    headers: carOwnerHeaders,
    body: JSON.stringify({
      make: 'Mazda',
      model: '3',
      productionYear: 2020,
      licensePlate: '51A-98765',
      currentMileage: 20000,
    }),
  })

  const existingCarsDemoResponse = await fetch(`${baseUrl}/api/cars/demo`, {
    method: 'POST',
    headers: carOwnerHeaders,
  })
  assert.equal(existingCarsDemoResponse.status, 409)
})

test('users can manage maintenance records only for their own cars', async () => {
  async function register(email) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Maintenance Owner',
        email,
        password: 'secure-password-123',
      }),
    })
    assert.equal(response.status, 201)
    return response.json()
  }

  const owner = await register('maintenance-owner@example.com')
  const otherUser = await register('other-maintenance-owner@example.com')
  const ownerHeaders = {
    Authorization: `Bearer ${owner.token}`,
    'Content-Type': 'application/json',
  }

  const carResponse = await fetch(`${baseUrl}/api/cars`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      make: 'Toyota',
      model: 'Vios',
      licensePlate: '51A-45678',
      currentMileage: 65000,
    }),
  })
  const { car } = await carResponse.json()
  const recordInput = {
    itemName: 'Thay dầu động cơ',
    performedAt: '2025-04-10',
    mileage: 65000,
    cost: 850000,
    garage: 'Garage ABC',
    notes: 'Dùng dầu tổng hợp',
  }

  const invalidRecordResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/maintenance`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ ...recordInput, cost: -1 }),
    },
  )
  assert.equal(invalidRecordResponse.status, 400)

  const createResponse = await fetch(`${baseUrl}/api/cars/${car.id}/maintenance`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify(recordInput),
  })
  assert.equal(createResponse.status, 201)
  const { record } = await createResponse.json()
  assert.equal(record.itemName, 'Thay dầu động cơ')
  assert.equal(record.cost, 850000)
  assert.equal(record.carId, car.id)

  const listResponse = await fetch(`${baseUrl}/api/cars/${car.id}/maintenance`, {
    headers: ownerHeaders,
  })
  assert.equal(listResponse.status, 200)
  assert.equal((await listResponse.json()).records.length, 1)

  const updateResponse = await fetch(`${baseUrl}/api/maintenance/${record.id}`, {
    method: 'PATCH',
    headers: ownerHeaders,
    body: JSON.stringify({ ...recordInput, itemName: 'Thay dầu và lọc dầu', cost: 950000 }),
  })
  assert.equal(updateResponse.status, 200)
  const updatedRecord = (await updateResponse.json()).record
  assert.equal(updatedRecord.itemName, 'Thay dầu và lọc dầu')
  assert.equal(updatedRecord.cost, 950000)

  const otherUserHeaders = { Authorization: `Bearer ${otherUser.token}` }
  const otherUserListResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/maintenance`,
    { headers: otherUserHeaders },
  )
  assert.equal(otherUserListResponse.status, 404)

  const otherUserUpdateResponse = await fetch(
    `${baseUrl}/api/maintenance/${record.id}`,
    {
      method: 'PATCH',
      headers: { ...otherUserHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(recordInput),
    },
  )
  assert.equal(otherUserUpdateResponse.status, 404)

  const otherUserDeleteResponse = await fetch(
    `${baseUrl}/api/maintenance/${record.id}`,
    {
      method: 'DELETE',
      headers: otherUserHeaders,
    },
  )
  assert.equal(otherUserDeleteResponse.status, 404)

  const deleteResponse = await fetch(`${baseUrl}/api/maintenance/${record.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${owner.token}` },
  })
  assert.equal(deleteResponse.status, 204)

  const deletedListResponse = await fetch(`${baseUrl}/api/cars/${car.id}/maintenance`, {
    headers: ownerHeaders,
  })
  assert.deepEqual((await deletedListResponse.json()).records, [])

  const demoResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/maintenance/demo`,
    { method: 'POST', headers: ownerHeaders },
  )
  assert.equal(demoResponse.status, 201)
  const demoRecords = (await demoResponse.json()).records
  assert.equal(demoRecords.length, 2)
  assert.ok(demoRecords.every((item) => item.notes.includes('Dữ liệu mẫu')))

  const duplicateDemoResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/maintenance/demo`,
    { method: 'POST', headers: ownerHeaders },
  )
  assert.equal(duplicateDemoResponse.status, 409)

  const otherUserDemoResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/maintenance/demo`,
    { method: 'POST', headers: otherUserHeaders },
  )
  assert.equal(otherUserDemoResponse.status, 404)
})

test('users can manage maintenance schedules only for their own cars', async () => {
  async function register(email) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Schedule Owner',
        email,
        password: 'secure-password-123',
      }),
    })
    assert.equal(response.status, 201)
    return response.json()
  }

  const owner = await register('schedule-owner@example.com')
  const otherUser = await register('other-schedule-owner@example.com')
  const ownerHeaders = {
    Authorization: `Bearer ${owner.token}`,
    'Content-Type': 'application/json',
  }

  const carResponse = await fetch(`${baseUrl}/api/cars`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      make: 'Toyota',
      model: 'Vios',
      licensePlate: '51A-11111',
      currentMileage: 65000,
    }),
  })
  const { car } = await carResponse.json()
  const scheduleInput = {
    itemName: 'Thay dầu động cơ',
    nextDueMileage: 70000,
    nextDueDate: '',
    reminderBeforeKm: 1000,
    reminderBeforeDays: 30,
    notes: 'Kiểm tra cấp dầu phù hợp.',
  }

  const invalidScheduleResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/schedules`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ ...scheduleInput, nextDueMileage: '' }),
    },
  )
  assert.equal(invalidScheduleResponse.status, 400)

  const createResponse = await fetch(`${baseUrl}/api/cars/${car.id}/schedules`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify(scheduleInput),
  })
  assert.equal(createResponse.status, 201)
  const { schedule } = await createResponse.json()
  assert.equal(schedule.itemName, 'Thay dầu động cơ')
  assert.equal(schedule.nextDueMileage, 70000)
  assert.equal(schedule.currentMileage, 65000)
  assert.equal(schedule.licensePlate, '51A-11111')

  const listResponse = await fetch(`${baseUrl}/api/schedules`, {
    headers: ownerHeaders,
  })
  assert.equal(listResponse.status, 200)
  assert.equal((await listResponse.json()).schedules.length, 1)

  const updateResponse = await fetch(`${baseUrl}/api/schedules/${schedule.id}`, {
    method: 'PATCH',
    headers: ownerHeaders,
    body: JSON.stringify({
      ...scheduleInput,
      itemName: 'Thay dầu và lọc dầu',
      nextDueDate: '2027-01-15',
    }),
  })
  assert.equal(updateResponse.status, 200)
  const updated = (await updateResponse.json()).schedule
  assert.equal(updated.itemName, 'Thay dầu và lọc dầu')
  assert.equal(updated.nextDueDate, '2027-01-15')

  const otherUserHeaders = { Authorization: `Bearer ${otherUser.token}` }
  const otherUserList = await fetch(`${baseUrl}/api/schedules`, {
    headers: otherUserHeaders,
  })
  assert.deepEqual((await otherUserList.json()).schedules, [])

  const otherUserUpdate = await fetch(`${baseUrl}/api/schedules/${schedule.id}`, {
    method: 'PATCH',
    headers: { ...otherUserHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleInput),
  })
  assert.equal(otherUserUpdate.status, 404)

  const otherUserDelete = await fetch(`${baseUrl}/api/schedules/${schedule.id}`, {
    method: 'DELETE',
    headers: otherUserHeaders,
  })
  assert.equal(otherUserDelete.status, 404)

  const deleteResponse = await fetch(`${baseUrl}/api/schedules/${schedule.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${owner.token}` },
  })
  assert.equal(deleteResponse.status, 204)

  const demoResponse = await fetch(`${baseUrl}/api/cars/${car.id}/schedules/demo`, {
    method: 'POST',
    headers: ownerHeaders,
  })
  assert.equal(demoResponse.status, 201)
  const demoSchedules = (await demoResponse.json()).schedules
  assert.equal(demoSchedules.length, 2)
  assert.deepEqual(
    demoSchedules.map((item) => item.itemName),
    ['Thay dầu động cơ', 'Bảo dưỡng định kỳ'],
  )
  assert.ok(demoSchedules.every((item) => item.notes.includes('Lịch mẫu')))

  const repeatedDemoResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/schedules/demo`,
    { method: 'POST', headers: ownerHeaders },
  )
  assert.equal(repeatedDemoResponse.status, 409)

  const otherUserDemoResponse = await fetch(
    `${baseUrl}/api/cars/${car.id}/schedules/demo`,
    { method: 'POST', headers: otherUserHeaders },
  )
  assert.equal(otherUserDemoResponse.status, 404)
})

test('dashboard summary includes only the signed-in user data', async () => {
  async function register(email) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dashboard User',
        email,
        password: 'secure-password-123',
      }),
    })
    assert.equal(response.status, 201)
    return response.json()
  }

  async function createCar(token, licensePlate) {
    const response = await fetch(`${baseUrl}/api/cars`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        make: 'Honda',
        model: 'City',
        licensePlate,
        currentMileage: 50000,
      }),
    })
    assert.equal(response.status, 201)
    return (await response.json()).car
  }

  async function addMaintenance(token, carId, record) {
    const response = await fetch(`${baseUrl}/api/cars/${carId}/maintenance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    })
    assert.equal(response.status, 201)
  }

  const owner = await register('dashboard-owner@example.com')
  const otherUser = await register('dashboard-other@example.com')
  const emptyUser = await register('dashboard-empty@example.com')
  const ownerCar = await createCar(owner.token, '51A-20001')
  await createCar(owner.token, '51A-20002')
  const otherCar = await createCar(otherUser.token, '51A-20003')

  await addMaintenance(owner.token, ownerCar.id, {
    itemName: 'Thay dầu',
    performedAt: '2025-01-10',
    mileage: 40000,
    cost: 850000,
  })
  await addMaintenance(owner.token, ownerCar.id, {
    itemName: 'Thay má phanh',
    performedAt: '2025-06-20',
    mileage: 48000,
    cost: 1250000,
  })
  await addMaintenance(otherUser.token, otherCar.id, {
    itemName: 'Bảo dưỡng riêng',
    performedAt: '2025-07-01',
    mileage: 50000,
    cost: 9900000,
  })

  const response = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  })
  assert.equal(response.status, 200)
  const summary = await response.json()

  assert.equal(summary.totalCars, 2)
  assert.equal(summary.activeCars, 2)
  assert.equal(summary.totalMaintenanceCost, 2100000)
  assert.equal(summary.latestMaintenance.itemName, 'Thay má phanh')
  assert.equal(summary.latestMaintenance.cost, 1250000)
  assert.equal(summary.latestMaintenance.licensePlate, '51A-20001')

  const emptyResponse = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${emptyUser.token}` },
  })
  assert.equal(emptyResponse.status, 200)
  assert.deepEqual(await emptyResponse.json(), {
    totalCars: 0,
    activeCars: 0,
    totalMaintenanceCost: 0,
    latestMaintenance: null,
  })
})
