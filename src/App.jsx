import { useEffect, useState } from 'react'
import './App.css'

const TOKEN_KEY = 'autocare_access_token'

async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(path, { ...options, headers })
  const result = response.status === 204 ? null : await response.json()

  if (!response.ok) {
    const error = new Error(result?.error || 'Đã xảy ra lỗi. Vui lòng thử lại.')
    error.status = response.status
    throw error
  }

  return result
}

function Icon({ name, size = 20 }) {
  const icons = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    car: (
      <>
        <path d="m5 11 1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
        <path d="M3 11h18v7H3zM6 18v2m12-2v2M6 14h.01M18 14h.01" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
        <path d="M3 3v5h5m4-1v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    plus: <path d="M12 5v14m-7-7h14" />,
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    wrench: (
      <>
        <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-2-2z" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  )
}

const navigation = [
  { label: 'Tổng quan', icon: 'overview', active: true },
  { label: 'Xe của tôi', icon: 'car' },
  { label: 'Lịch sử bảo dưỡng', icon: 'history' },
  { label: 'Lịch nhắc', icon: 'calendar' },
  { label: 'Tài khoản', icon: 'user' },
]

function getScheduleStatus(schedule) {
  const today = new Date()
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  const daysUntilDue = schedule.nextDueDate
    ? Math.ceil(
      (Date.parse(`${schedule.nextDueDate}T00:00:00Z`) -
        Date.parse(`${todayIso}T00:00:00Z`)) /
        86400000,
    )
    : null
  const kmRemaining = schedule.nextDueMileage == null
    ? null
    : schedule.nextDueMileage - schedule.currentMileage

  if (
    (kmRemaining != null && kmRemaining <= 0) ||
    (daysUntilDue != null && daysUntilDue < 0)
  ) {
    return { status: 'overdue', daysUntilDue, kmRemaining, needsAttention: true }
  }

  if (
    (daysUntilDue === 0) ||
    (kmRemaining === 0) ||
    (kmRemaining != null &&
      schedule.reminderBeforeKm != null &&
      kmRemaining <= schedule.reminderBeforeKm) ||
    (daysUntilDue != null &&
      schedule.reminderBeforeDays != null &&
      daysUntilDue <= schedule.reminderBeforeDays)
  ) {
    return { status: 'upcoming', daysUntilDue, kmRemaining, needsAttention: true }
  }

  return { status: 'ok', daysUntilDue, kmRemaining, needsAttention: false }
}

const emptyCarForm = {
  make: '',
  model: '',
  productionYear: '',
  licensePlate: '',
  currentMileage: '0',
  purchaseDate: '',
  imageUrl: '',
}

function Sidebar({
  user,
  onCars,
  onMaintenance,
  onSchedules,
  onProfile,
  onLogout,
  onDashboard,
  activePage,
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="AutoCare - Trang chủ">
        <span className="brand-mark">
          <Icon name="car" size={21} />
        </span>
        <span>Auto<span className="brand-light">Care</span></span>
      </a>

      <p className="nav-heading">MENU</p>
      <nav className="side-nav" aria-label="Điều hướng chính">
        {navigation.map((item) => (
          item.label === 'Tài khoản' ? (
            <button
              className={`nav-link${activePage === 'profile' ? ' active' : ''}`}
              type="button"
              aria-current={activePage === 'profile' ? 'page' : undefined}
              onClick={onProfile}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : item.label === 'Xe của tôi' ? (
            <button
              className={`nav-link${activePage === 'cars' ? ' active' : ''}`}
              type="button"
              aria-current={activePage === 'cars' ? 'page' : undefined}
              onClick={onCars}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : item.label === 'Lịch sử bảo dưỡng' ? (
            <button
              className={`nav-link${activePage === 'maintenance' ? ' active' : ''}`}
              type="button"
              aria-current={activePage === 'maintenance' ? 'page' : undefined}
              onClick={onMaintenance}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : item.label === 'Lịch nhắc' ? (
            <button
              className={`nav-link${activePage === 'schedules' ? ' active' : ''}`}
              type="button"
              aria-current={activePage === 'schedules' ? 'page' : undefined}
              onClick={onSchedules}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : (
            <button
              className={`nav-link${item.active && activePage === 'dashboard' ? ' active' : ''}`}
              type="button"
              aria-current={item.active && activePage === 'dashboard' ? 'page' : undefined}
              onClick={onDashboard}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          )
        ))}
      </nav>

      <div className="sidebar-note">
        <span className="note-icon"><Icon name="wrench" size={19} /></span>
        <strong>Chăm xe đúng hạn</strong>
        <p>Theo dõi lịch bảo dưỡng để mỗi chuyến đi luôn an tâm.</p>
      </div>

      <div className="sidebar-profile">
        <span className="avatar">{user.fullName.charAt(0).toUpperCase()}</span>
        <span className="profile-copy"><strong>{user.fullName}</strong><small>{user.email}</small></span>
        <button className="profile-logout" type="button" onClick={onLogout}>Đăng xuất</button>
      </div>
    </aside>
  )
}

function MobileNav({
  activePage,
  onCars,
  onMaintenance,
  onSchedules,
  onDashboard,
  onProfile,
}) {
  return (
    <nav className="mobile-nav" aria-label="Điều hướng chính trên điện thoại">
      {navigation.slice(0, 4).map((item) => {
        const isCarsLink = item.label === 'Xe của tôi'
        const isMaintenanceLink = item.label === 'Lịch sử bảo dưỡng'
        const isSchedulesLink = item.label === 'Lịch nhắc'
        const isActive = isCarsLink
          ? activePage === 'cars'
          : isMaintenanceLink
            ? activePage === 'maintenance'
            : isSchedulesLink
              ? activePage === 'schedules'
              : item.active && activePage === 'dashboard'

        return (
          <button
            className={`mobile-nav-link${isActive ? ' active' : ''}`}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            key={item.label}
            onClick={
              isCarsLink
                ? onCars
                : isMaintenanceLink
                  ? onMaintenance
                  : isSchedulesLink
                    ? onSchedules
                    : onDashboard
            }
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label === 'Lịch sử bảo dưỡng' ? 'Lịch sử' : item.label === 'Tổng quan' ? 'Tổng quan' : item.label === 'Xe của tôi' ? 'Xe của tôi' : 'Lịch nhắc'}</span>
          </button>
        )
      })}
      <button
        className={`mobile-nav-link${activePage === 'profile' ? ' active' : ''}`}
        aria-current={activePage === 'profile' ? 'page' : undefined}
        onClick={onProfile}
        type="button"
      >
        <Icon name="user" size={21} />
        <span>Tài khoản</span>
      </button>
    </nav>
  )
}

function CarsPage({ cars, loadError, onCarsChanged, token }) {
  const [form, setForm] = useState(emptyCarForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingDemo, setIsAddingDemo] = useState(false)
  const [error, setError] = useState('')

  function openNewCarForm() {
    setForm(emptyCarForm)
    setEditingId(null)
    setError('')
    setIsFormOpen(true)
  }

  function openEditForm(car) {
    setForm({
      make: car.make,
      model: car.model,
      productionYear: car.productionYear ?? '',
      licensePlate: car.licensePlate,
      currentMileage: String(car.currentMileage),
      purchaseDate: car.purchaseDate ?? '',
      imageUrl: car.imageUrl ?? '',
    })
    setEditingId(car.id)
    setError('')
    setIsFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const result = await apiRequest(
        editingId ? `/api/cars/${editingId}` : '/api/cars',
        {
          method: editingId ? 'PATCH' : 'POST',
          token,
          body: JSON.stringify(form),
        },
      )
      onCarsChanged((currentCars) => (
        editingId
          ? currentCars.map((car) => car.id === editingId ? result.car : car)
          : [result.car, ...currentCars]
      ))
      setIsFormOpen(false)
      setForm(emptyCarForm)
      setEditingId(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(car) {
    if (!window.confirm(
      `Xóa xe ${car.make} ${car.model}? Lịch sử và lịch nhắc gắn với xe này cũng sẽ bị xóa.`,
    )) {
      return
    }

    setError('')

    try {
      await apiRequest(`/api/cars/${car.id}`, { method: 'DELETE', token })
      onCarsChanged((currentCars) => currentCars.filter((item) => item.id !== car.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleAddDemoCars() {
    setError('')
    setIsAddingDemo(true)

    try {
      const result = await apiRequest('/api/cars/demo', {
        method: 'POST',
        token,
      })
      onCarsChanged(result.cars)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsAddingDemo(false)
    }
  }

  function updateField(event) {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }))
  }

  return (
    <main className="main-content cars-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">QUẢN LÝ PHƯƠNG TIỆN</p>
          <h1>Xe của tôi</h1>
          <p className="page-subtitle">Lưu thông tin và theo dõi số km các xe của bạn.</p>
        </div>
        <button className="text-button" disabled={Boolean(loadError)} onClick={openNewCarForm} type="button">
          <Icon name="plus" size={18} />
          Thêm xe
        </button>
      </header>

      {error && !loadError && <p className="form-error cars-error" role="alert">{error}</p>}

      {isFormOpen && (
        <section className="panel car-form-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId ? 'Sửa thông tin xe' : 'Thêm xe mới'}</h2>
              <p>Các mục có dấu * là bắt buộc.</p>
            </div>
            <button
              aria-label="Đóng biểu mẫu"
              className="icon-button"
              onClick={() => setIsFormOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>

          <form className="car-form" onSubmit={handleSave}>
            <label>
              Hãng xe *
              <input maxLength={100} name="make" onChange={updateField} required value={form.make} />
            </label>
            <label>
              Model *
              <input maxLength={100} name="model" onChange={updateField} required value={form.model} />
            </label>
            <label>
              Năm sản xuất
              <input
                max={new Date().getFullYear() + 1}
                min="1886"
                name="productionYear"
                onChange={updateField}
                step="1"
                type="number"
                value={form.productionYear}
              />
            </label>
            <label>
              Biển số *
              <input maxLength={30} name="licensePlate" onChange={updateField} required value={form.licensePlate} />
            </label>
            <label>
              Số km hiện tại *
              <input min="0" name="currentMileage" onChange={updateField} required step="1" type="number" value={form.currentMileage} />
            </label>
            <label>
              Ngày mua
              <input name="purchaseDate" onChange={updateField} type="date" value={form.purchaseDate} />
            </label>
            <label className="car-form-wide">
              Link ảnh xe (không bắt buộc)
              <input
                maxLength={2048}
                name="imageUrl"
                onChange={updateField}
                placeholder="https://example.com/xe.jpg"
                type="url"
                value={form.imageUrl}
              />
            </label>
            <div className="car-form-actions car-form-wide">
              <button className="auth-submit" disabled={isSaving} type="submit">
                {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm xe'}
              </button>
              <button className="logout-button" onClick={() => setIsFormOpen(false)} type="button">
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      {cars.length === 0 && loadError ? (
        <section className="panel cars-empty-panel">
          <p className="form-error" role="alert">{loadError}</p>
        </section>
      ) : cars.length === 0 ? (
        <section className="panel cars-empty-panel">
          <div className="empty-state">
            <span className="empty-car"><Icon name="car" size={34} /></span>
            <h3>Chưa có xe nào</h3>
            <p>Thêm xe đầu tiên để bắt đầu lưu số km và thông tin bảo dưỡng.</p>
            <button className="primary-button" onClick={openNewCarForm} type="button">
              <Icon name="plus" size={18} />
              Thêm xe đầu tiên
            </button>
            <button
              className="demo-data-button"
              disabled={isAddingDemo}
              onClick={handleAddDemoCars}
              type="button"
            >
              {isAddingDemo ? 'Đang thêm xe mẫu...' : 'Thêm 2 xe mẫu'}
            </button>
            <p className="demo-data-note">Dữ liệu minh họa: Toyota Vios và Honda City. Bạn có thể sửa hoặc xóa sau.</p>
          </div>
        </section>
      ) : (
        <section aria-label="Danh sách xe" className="cars-list">
          {cars.map((car) => (
            <article className="panel car-card" key={car.id}>
              {car.imageUrl ? (
                <img
                  alt={`${car.make} ${car.model}`}
                  className="car-card-image"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={car.imageUrl}
                />
              ) : (
                <span className="car-card-placeholder"><Icon name="car" size={29} /></span>
              )}
              <div className="car-card-info">
                <h2>{car.make} {car.model}</h2>
                <p className="car-card-plate">{car.licensePlate}</p>
                <p className="car-card-details">
                  {car.productionYear ? `${car.productionYear} · ` : ''}
                  {car.currentMileage.toLocaleString('vi-VN')} km
                </p>
                {car.purchaseDate && <p className="car-card-details">Ngày mua: {car.purchaseDate}</p>}
              </div>
              <div className="car-card-actions">
                <button className="car-action-button" onClick={() => openEditForm(car)} type="button">Sửa</button>
                <button className="car-action-button delete" onClick={() => handleDelete(car)} type="button">Xóa</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}

const emptyMaintenanceForm = {
  itemName: '',
  performedAt: '',
  mileage: '',
  cost: '0',
  garage: '',
  notes: '',
}

function MaintenancePage({ cars, token }) {
  const [selectedCarId, setSelectedCarId] = useState(() => (
    cars.length ? String(cars[0].id) : ''
  ))
  const [records, setRecords] = useState([])
  const [form, setForm] = useState(emptyMaintenanceForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(cars.length))
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingDemo, setIsAddingDemo] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')

  const selectedCar = cars.find((car) => String(car.id) === selectedCarId)

  useEffect(() => {
    if (!selectedCarId) {
      return
    }

    let isMounted = true

    apiRequest(`/api/cars/${selectedCarId}/maintenance`, { token })
      .then((result) => {
        if (isMounted) {
          setRecords(result.records)
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setLoadError(requestError.message)
          setError(requestError.message)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedCarId, token, reloadCount])

  function openNewRecordForm() {
    setForm({
      ...emptyMaintenanceForm,
      mileage: String(selectedCar?.currentMileage ?? ''),
    })
    setEditingId(null)
    setError('')
    setIsFormOpen(true)
  }

  function openEditRecordForm(record) {
    setForm({
      itemName: record.itemName,
      performedAt: record.performedAt,
      mileage: String(record.mileage),
      cost: String(record.cost),
      garage: record.garage ?? '',
      notes: record.notes ?? '',
    })
    setEditingId(record.id)
    setError('')
    setIsFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const result = await apiRequest(
        editingId
          ? `/api/maintenance/${editingId}`
          : `/api/cars/${selectedCarId}/maintenance`,
        {
          method: editingId ? 'PATCH' : 'POST',
          token,
          body: JSON.stringify(form),
        },
      )
      setRecords((currentRecords) => (
        editingId
          ? currentRecords.map((record) => record.id === editingId ? result.record : record)
          : [result.record, ...currentRecords]
      ))
      setIsFormOpen(false)
      setEditingId(null)
      setForm(emptyMaintenanceForm)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Xóa lịch sử "${record.itemName}"?`)) {
      return
    }

    setError('')
    try {
      await apiRequest(`/api/maintenance/${record.id}`, { method: 'DELETE', token })
      setRecords((currentRecords) => currentRecords.filter((item) => item.id !== record.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleAddDemoRecords() {
    if (!selectedCarId) {
      return
    }

    setError('')
    setIsAddingDemo(true)

    try {
      const result = await apiRequest(
        `/api/cars/${selectedCarId}/maintenance/demo`,
        { method: 'POST', token },
      )
      setRecords(result.records)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsAddingDemo(false)
    }
  }

  function updateField(event) {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }))
  }

  return (
    <main className="main-content maintenance-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">THEO DÕI CHI PHÍ VÀ SỬA CHỮA</p>
          <h1>Lịch sử bảo dưỡng</h1>
          <p className="page-subtitle">Ghi lại những lần chăm sóc và sửa chữa xe.</p>
        </div>
        {selectedCar && (
          <button className="text-button" onClick={openNewRecordForm} type="button">
            <Icon name="plus" size={18} />
            Thêm lịch sử
          </button>
        )}
      </header>

      {cars.length === 0 ? (
        <section className="panel cars-empty-panel">
          <div className="empty-state">
            <span className="empty-car"><Icon name="car" size={34} /></span>
            <h3>Bạn chưa thêm xe</h3>
            <p>Thêm xe trước để ghi lại lịch sử bảo dưỡng.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="panel maintenance-filter">
            <label htmlFor="maintenance-car">Chọn xe</label>
            <select
              id="maintenance-car"
              onChange={(event) => {
                setSelectedCarId(event.target.value)
                setIsFormOpen(false)
                setIsLoading(true)
                setLoadError('')
                setError('')
              }}
              value={selectedCarId}
            >
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.make} {car.model} — {car.licensePlate}
                </option>
              ))}
            </select>
            {selectedCar && (
              <span className="maintenance-current-mileage">
                Số km hiện tại: {selectedCar.currentMileage.toLocaleString('vi-VN')} km
              </span>
            )}
          </section>

          {error && <p className="form-error cars-error" role="alert">{error}</p>}

          {isFormOpen && (
            <section className="panel car-form-panel">
              <div className="panel-heading">
                <div>
                  <h2>{editingId ? 'Sửa lịch sử bảo dưỡng' : 'Thêm lần bảo dưỡng'}</h2>
                  <p>Nhập thông tin đã thực hiện cho xe.</p>
                </div>
                <button
                  aria-label="Đóng biểu mẫu"
                  className="icon-button"
                  onClick={() => setIsFormOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <form className="car-form" onSubmit={handleSave}>
                <label>
                  Hạng mục *
                  <input
                    maxLength={150}
                    name="itemName"
                    onChange={updateField}
                    placeholder="Ví dụ: Thay dầu động cơ"
                    required
                    value={form.itemName}
                  />
                </label>
                <label>
                  Ngày thực hiện *
                  <input
                    name="performedAt"
                    onChange={updateField}
                    required
                    type="date"
                    value={form.performedAt}
                  />
                </label>
                <label>
                  Số km *
                  <input
                    min="0"
                    name="mileage"
                    onChange={updateField}
                    required
                    step="1"
                    type="number"
                    value={form.mileage}
                  />
                </label>
                <label>
                  Chi phí (đồng) *
                  <input
                    min="0"
                    name="cost"
                    onChange={updateField}
                    required
                    step="0.01"
                    type="number"
                    value={form.cost}
                  />
                </label>
                <label>
                  Garage
                  <input
                    maxLength={180}
                    name="garage"
                    onChange={updateField}
                    value={form.garage}
                  />
                </label>
                <label>
                  Ghi chú
                  <input
                    maxLength={5000}
                    name="notes"
                    onChange={updateField}
                    value={form.notes}
                  />
                </label>
                <div className="car-form-actions car-form-wide">
                  <button className="auth-submit" disabled={isSaving} type="submit">
                    {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu lịch sử'}
                  </button>
                  <button
                    className="logout-button"
                    onClick={() => setIsFormOpen(false)}
                    type="button"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </section>
          )}

          {isLoading ? (
            <p className="maintenance-loading" role="status">Đang tải lịch sử...</p>
          ) : loadError ? (
            <section className="panel cars-empty-panel">
              <p className="form-error" role="alert">{loadError}</p>
              <button
                className="logout-button"
                onClick={() => {
                  setIsLoading(true)
                  setLoadError('')
                  setError('')
                  setReloadCount((count) => count + 1)
                }}
                type="button"
              >
                Tải lại
              </button>
            </section>
          ) : records.length === 0 ? (
            <section className="panel cars-empty-panel">
              <div className="empty-state">
                <span className="empty-car"><Icon name="wrench" size={30} /></span>
                <h3>Chưa có lịch sử bảo dưỡng</h3>
                <p>Thêm lần bảo dưỡng đầu tiên để lưu hạng mục, số km và chi phí.</p>
                <button className="primary-button" onClick={openNewRecordForm} type="button">
                  <Icon name="plus" size={18} />
                  Thêm lịch sử đầu tiên
                </button>
                <button
                  className="demo-data-button"
                  disabled={isAddingDemo}
                  onClick={handleAddDemoRecords}
                  type="button"
                >
                  {isAddingDemo ? 'Đang thêm dữ liệu mẫu...' : 'Thêm 2 lần bảo dưỡng mẫu'}
                </button>
                <p className="demo-data-note">
                  Chỉ dành để thử giao diện; ghi chú đánh dấu đây là dữ liệu minh họa.
                </p>
              </div>
            </section>
          ) : (
            <section aria-label="Các lần bảo dưỡng" className="maintenance-list">
              {records.map((record) => (
                <article className="panel maintenance-card" key={record.id}>
                  <div className="maintenance-record-icon"><Icon name="wrench" size={20} /></div>
                  <div className="maintenance-record-info">
                    <h2>{record.itemName}</h2>
                    <p className="maintenance-record-meta">
                      {new Date(`${record.performedAt}T00:00:00`).toLocaleDateString('vi-VN')}
                      {' · '}
                      {record.mileage.toLocaleString('vi-VN')} km
                    </p>
                    {record.garage && <p className="maintenance-record-meta">Garage: {record.garage}</p>}
                    {record.notes && <p className="maintenance-record-notes">{record.notes}</p>}
                  </div>
                  <strong className="maintenance-record-cost">
                    {Number(record.cost).toLocaleString('vi-VN')} đ
                  </strong>
                  <div className="car-card-actions maintenance-actions">
                    <button
                      className="car-action-button"
                      onClick={() => openEditRecordForm(record)}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      className="car-action-button delete"
                      onClick={() => handleDelete(record)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

const emptyScheduleForm = {
  carId: '',
  itemName: '',
  nextDueMileage: '',
  nextDueDate: '',
  reminderBeforeKm: '1000',
  reminderBeforeDays: '30',
  notes: '',
}

function SchedulesPage({ cars, loadError, schedules, onSchedulesChanged, token }) {
  const [form, setForm] = useState(emptyScheduleForm)
  const [demoCarId, setDemoCarId] = useState(() => (
    cars.length ? String(cars[0].id) : ''
  ))
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingDemo, setIsAddingDemo] = useState(false)
  const [error, setError] = useState('')

  function openNewForm() {
    setForm({ ...emptyScheduleForm, carId: cars[0] ? String(cars[0].id) : '' })
    setEditingId(null)
    setError('')
    setIsFormOpen(true)
  }

  function openEditForm(schedule) {
    setForm({
      carId: String(schedule.carId),
      itemName: schedule.itemName,
      nextDueMileage: schedule.nextDueMileage ?? '',
      nextDueDate: schedule.nextDueDate ?? '',
      reminderBeforeKm: schedule.reminderBeforeKm ?? '',
      reminderBeforeDays: schedule.reminderBeforeDays ?? '',
      notes: schedule.notes ?? '',
    })
    setEditingId(schedule.id)
    setError('')
    setIsFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const result = await apiRequest(
        editingId ? `/api/schedules/${editingId}` : `/api/cars/${form.carId}/schedules`,
        {
          method: editingId ? 'PATCH' : 'POST',
          token,
          body: JSON.stringify(form),
        },
      )
      onSchedulesChanged((currentSchedules) => (
        editingId
          ? currentSchedules.map((schedule) => (
            schedule.id === editingId ? result.schedule : schedule
          ))
          : [result.schedule, ...currentSchedules]
      ))
      setIsFormOpen(false)
      setEditingId(null)
      setForm(emptyScheduleForm)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(schedule) {
    if (!window.confirm(`Xóa lịch nhắc "${schedule.itemName}"?`)) {
      return
    }

    setError('')
    try {
      await apiRequest(`/api/schedules/${schedule.id}`, { method: 'DELETE', token })
      onSchedulesChanged((currentSchedules) => (
        currentSchedules.filter((item) => item.id !== schedule.id)
      ))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleAddDemoSchedules() {
    if (!demoCarId) {
      return
    }

    setError('')
    setIsAddingDemo(true)

    try {
      const result = await apiRequest(
        `/api/cars/${demoCarId}/schedules/demo`,
        { method: 'POST', token },
      )
      onSchedulesChanged((currentSchedules) => [
        ...currentSchedules,
        ...result.schedules,
      ])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsAddingDemo(false)
    }
  }

  function updateField(event) {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }))
  }

  return (
    <main className="main-content schedules-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">CHỦ ĐỘNG CHĂM SÓC XE</p>
          <h1>Lịch nhắc bảo dưỡng</h1>
          <p className="page-subtitle">Đặt mốc theo số km, ngày hoặc cả hai.</p>
        </div>
        {cars.length > 0 && !loadError && (
          <button className="text-button" onClick={openNewForm} type="button">
            <Icon name="plus" size={18} />
            Tạo lịch nhắc
          </button>
        )}
      </header>

      <p className="schedule-tip">
        Lịch được nhắc ngay trong ứng dụng khi gần đến hạn; hiện chưa gửi email hoặc thông báo điện thoại.
      </p>
      {error && <p className="form-error cars-error" role="alert">{error}</p>}

      {loadError ? (
        <section className="panel cars-empty-panel">
          <p className="form-error" role="alert">{loadError}</p>
        </section>
      ) : cars.length === 0 ? (
        <section className="panel cars-empty-panel">
          <div className="empty-state">
            <span className="empty-car"><Icon name="car" size={34} /></span>
            <h3>Bạn chưa thêm xe</h3>
            <p>Thêm xe trước khi tạo lịch nhắc bảo dưỡng.</p>
          </div>
        </section>
      ) : (
        <>
          {isFormOpen && (
            <section className="panel car-form-panel">
              <div className="panel-heading">
                <div>
                  <h2>{editingId ? 'Sửa lịch nhắc' : 'Tạo lịch nhắc mới'}</h2>
                  <p>Nhập ít nhất một mốc: số km hoặc ngày.</p>
                </div>
                <button
                  aria-label="Đóng biểu mẫu"
                  className="icon-button"
                  onClick={() => setIsFormOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <form className="car-form" onSubmit={handleSave}>
                {!editingId && (
                  <label>
                    Xe *
                    <select
                      className="schedule-select"
                      name="carId"
                      onChange={updateField}
                      required
                      value={form.carId}
                    >
                      {cars.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.make} {car.model} — {car.licensePlate}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Hạng mục *
                  <input
                    list="maintenance-items"
                    maxLength={150}
                    name="itemName"
                    onChange={updateField}
                    placeholder="Ví dụ: Thay dầu"
                    required
                    value={form.itemName}
                  />
                  <datalist id="maintenance-items">
                    <option value="Thay dầu động cơ" />
                    <option value="Thay lọc dầu" />
                    <option value="Thay lọc gió" />
                    <option value="Thay má phanh" />
                    <option value="Bảo dưỡng định kỳ" />
                  </datalist>
                </label>
                <label>
                  Nhắc tại số km
                  <input
                    min="0"
                    name="nextDueMileage"
                    onChange={updateField}
                    placeholder="Ví dụ: 70000"
                    step="1"
                    type="number"
                    value={form.nextDueMileage}
                  />
                </label>
                <label>
                  Nhắc vào ngày
                  <input
                    name="nextDueDate"
                    onChange={updateField}
                    type="date"
                    value={form.nextDueDate}
                  />
                </label>
                <label>
                  Nhắc trước bao nhiêu km?
                  <input
                    min="0"
                    name="reminderBeforeKm"
                    onChange={updateField}
                    placeholder="1000"
                    step="1"
                    type="number"
                    value={form.reminderBeforeKm}
                  />
                </label>
                <label>
                  Nhắc trước bao nhiêu ngày?
                  <input
                    min="0"
                    name="reminderBeforeDays"
                    onChange={updateField}
                    placeholder="30"
                    step="1"
                    type="number"
                    value={form.reminderBeforeDays}
                  />
                </label>
                <label className="car-form-wide">
                  Ghi chú
                  <input
                    maxLength={5000}
                    name="notes"
                    onChange={updateField}
                    value={form.notes}
                  />
                </label>
                <div className="car-form-actions car-form-wide">
                  <button className="auth-submit" disabled={isSaving} type="submit">
                    {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo lịch nhắc'}
                  </button>
                  <button
                    className="logout-button"
                    onClick={() => setIsFormOpen(false)}
                    type="button"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </section>
          )}

          {schedules.length === 0 ? (
            <section className="panel cars-empty-panel">
              <div className="empty-state">
                <span className="reminder-icon"><Icon name="calendar" size={23} /></span>
                <h3>Chưa có lịch nhắc nào</h3>
                <p>Tạo lịch theo số km, ngày hoặc cả hai.</p>
                <button className="primary-button" onClick={openNewForm} type="button">
                  <Icon name="plus" size={18} />
                  Tạo lịch nhắc đầu tiên
                </button>
                <label className="demo-schedule-car-label" htmlFor="demo-schedule-car">
                  Chọn xe để thêm lịch mẫu
                </label>
                <select
                  className="schedule-select demo-schedule-car-select"
                  id="demo-schedule-car"
                  onChange={(event) => setDemoCarId(event.target.value)}
                  value={demoCarId}
                >
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.make} {car.model} — {car.licensePlate}
                    </option>
                  ))}
                </select>
                <button
                  className="demo-data-button"
                  disabled={isAddingDemo}
                  onClick={handleAddDemoSchedules}
                  type="button"
                >
                  {isAddingDemo ? 'Đang thêm lịch mẫu...' : 'Thêm 2 lịch nhắc mẫu'}
                </button>
                <p className="demo-data-note">
                  Chỉ dành để thử ứng dụng; lịch mẫu được đánh dấu và không trộn với lịch đã có.
                </p>
              </div>
            </section>
          ) : (
            <section aria-label="Danh sách lịch nhắc" className="schedule-list">
              {schedules.map((schedule) => {
                const due = getScheduleStatus(schedule)
                const statusLabel = due.status === 'overdue'
                  ? 'Đã đến hạn'
                  : due.status === 'upcoming'
                    ? 'Sắp đến hạn'
                    : 'Chưa đến hạn'

                return (
                  <article className="panel schedule-card" key={schedule.id}>
                    <span className={`schedule-status ${due.status}`}>{statusLabel}</span>
                    <div className="schedule-card-info">
                      <h2>{schedule.itemName}</h2>
                      <p className="maintenance-record-meta">
                        {schedule.make} {schedule.model} · {schedule.licensePlate}
                      </p>
                      <p className="maintenance-record-meta">
                        {schedule.nextDueMileage != null
                          ? `Mốc ${schedule.nextDueMileage.toLocaleString('vi-VN')} km`
                          : ''}
                        {schedule.nextDueMileage != null && schedule.nextDueDate ? ' · ' : ''}
                        {schedule.nextDueDate
                          ? `Ngày ${new Date(`${schedule.nextDueDate}T00:00:00`).toLocaleDateString('vi-VN')}`
                          : ''}
                      </p>
                      {schedule.notes && <p className="maintenance-record-notes">{schedule.notes}</p>}
                    </div>
                    <div className="car-card-actions">
                      <button
                        className="car-action-button"
                        onClick={() => openEditForm(schedule)}
                        type="button"
                      >
                        Sửa
                      </button>
                      <button
                        className="car-action-button delete"
                        onClick={() => handleDelete(schedule)}
                        type="button"
                      >
                        Xóa
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </>
      )}
    </main>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await apiRequest(
        mode === 'register' ? '/api/auth/register' : '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password }),
        },
      )
      localStorage.setItem(TOKEN_KEY, result.token)
      window.location.reload()
    } catch (requestError) {
      setError(requestError.message)
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand auth-brand" href="#" aria-label="AutoCare">
          <span className="brand-mark"><Icon name="car" size={21} /></span>
          <span>Auto<span className="brand-light">Care</span></span>
        </a>
        <p className="auth-eyebrow">CHĂM XE DỄ DÀNG HƠN</p>
        <h1>{mode === 'register' ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
        <p className="auth-description">
          {mode === 'register'
            ? 'Bắt đầu quản lý xe và lịch bảo dưỡng của bạn.'
            : 'Đăng nhập để tiếp tục quản lý chiếc xe của bạn.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Loại tài khoản">
          <button
            className={mode === 'login' ? 'selected' : ''}
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => { setMode('login'); setError('') }}
          >
            Đăng nhập
          </button>
          <button
            className={mode === 'register' ? 'selected' : ''}
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => { setMode('register'); setError('') }}
          >
            Đăng ký
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Họ và tên
              <input
                autoComplete="name"
                maxLength={120}
                minLength={2}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nguyễn Văn A"
                required
                value={fullName}
              />
            </label>
          )}
          <label>
            Email
            <input
              autoComplete="email"
              maxLength={255}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ban@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Mật khẩu
            <input
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              maxLength={72}
              minLength={mode === 'register' ? 8 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'register' ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu'}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Đang xử lý...' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>
        <p className="auth-security-note">Mật khẩu được mã hóa trước khi lưu.</p>
      </section>
    </main>
  )
}

function ProfilePage({ user, token, onUserUpdated, onLogout, onDashboard }) {
  const [fullName, setFullName] = useState(user.fullName)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      const result = await apiRequest('/api/auth/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ fullName, email }),
      })
      onUserUpdated(result.user, result.token)
      setMessage('Thông tin cá nhân đã được cập nhật.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await apiRequest('/api/auth/password', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      onUserUpdated(user, result.token)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password changed. You can continue using AutoCare.')
    } catch (requestError) {
      setPasswordError(requestError.message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <main className="main-content profile-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">TÀI KHOẢN</p>
          <h1>Thông tin cá nhân</h1>
          <p className="page-subtitle">Cập nhật tên và địa chỉ email của bạn.</p>
        </div>
        <button className="profile-back-button" onClick={onDashboard} type="button">
          Về tổng quan
        </button>
      </header>
      <section className="panel profile-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Họ và tên
            <input
              autoComplete="name"
              maxLength={120}
              minLength={2}
              onChange={(event) => setFullName(event.target.value)}
              required
              value={fullName}
            />
          </label>
          <label>
            Email
            <input
              autoComplete="email"
              maxLength={255}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button className="auth-submit" disabled={isSaving} type="submit">
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <button className="logout-button" onClick={onLogout} type="button">
            Đăng xuất
          </button>
        </form>
        <section className="password-section" aria-labelledby="change-password-heading">
          <h2 id="change-password-heading">Đổi mật khẩu</h2>
          <p className="page-subtitle">Mật khẩu mới cần có ít nhất 8 ký tự.</p>
          <form className="auth-form" onSubmit={handlePasswordChange}>
            <label>
              Mật khẩu hiện tại
              <input
                autoComplete="current-password"
                maxLength={72}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                autoComplete="new-password"
                maxLength={72}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                autoComplete="new-password"
                maxLength={72}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
            {passwordMessage && <p className="form-success" role="status">{passwordMessage}</p>}
            <button className="auth-submit" disabled={isChangingPassword} type="submit">
              {isChangingPassword ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [cars, setCars] = useState([])
  const [schedules, setSchedules] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [isCarsLoading, setIsCarsLoading] = useState(Boolean(token))
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(Boolean(token))
  const [isDashboardLoading, setIsDashboardLoading] = useState(Boolean(token))
  const [loadErrors, setLoadErrors] = useState({
    cars: '',
    schedules: '',
    dashboard: '',
  })
  const [activePage, setActivePage] = useState('dashboard')
  const [notice, setNotice] = useState('')
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const attentionSchedules = schedules
    .map((schedule) => ({ ...schedule, due: getScheduleStatus(schedule) }))
    .filter((schedule) => schedule.due.needsAttention)
    .sort((left, right) => (
      Number(right.due.status === 'overdue') - Number(left.due.status === 'overdue')
    ))

  useEffect(() => {
    if (!token) {
      return
    }

    let isMounted = true

    apiRequest('/api/auth/me', { token })
      .then((result) => {
        if (isMounted) {
          setUser(result.user)
        }
      })
      .catch((error) => {
        if (isMounted) {
          if (error.status === 401) {
            localStorage.removeItem(TOKEN_KEY)
            setToken(null)
          } else {
            setNotice('Không thể kết nối máy chủ để kiểm tra phiên đăng nhập. Hãy kiểm tra backend rồi tải lại trang.')
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    if (!token || activePage !== 'dashboard') {
      return
    }
    let isMounted = true
    apiRequest('/api/dashboard', { token })
      .then((result) => {
        if (isMounted) {
          setDashboard(result)
          setLoadErrors((current) => ({ ...current, dashboard: '' }))
        }
      })
      .catch((error) => {
        if (isMounted && error.status !== 401) {
          setLoadErrors((current) => ({
            ...current,
            dashboard: 'Không thể tải số liệu dashboard. Hãy kiểm tra backend rồi tải lại trang.',
          }))
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsDashboardLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token, activePage])

  useEffect(() => {
    if (!token || (activePage !== 'dashboard' && activePage !== 'schedules')) {
      return
    }

    let isMounted = true
    apiRequest('/api/schedules', { token })
      .then((result) => {
        if (isMounted) {
          setSchedules(result.schedules)
          setLoadErrors((current) => ({ ...current, schedules: '' }))
        }
      })
      .catch((error) => {
        if (isMounted && error.status !== 401) {
          setLoadErrors((current) => ({
            ...current,
            schedules: 'Không thể tải lịch nhắc. Hãy kiểm tra backend rồi tải lại trang.',
          }))
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsSchedulesLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token, activePage])

  useEffect(() => {
    if (!token) {
      return
    }

    let isMounted = true
    apiRequest('/api/cars', { token })
      .then((result) => {
        if (isMounted) {
          setCars(result.cars)
          setLoadErrors((current) => ({ ...current, cars: '' }))
        }
      })
      .catch((error) => {
        if (isMounted && error.status !== 401) {
          setLoadErrors((current) => ({
            ...current,
            cars: 'Không thể tải danh sách xe. Hãy kiểm tra backend rồi tải lại trang.',
          }))
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCarsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  function handleUserUpdated(updatedUser, updatedToken) {
    localStorage.setItem(TOKEN_KEY, updatedToken)
    setToken(updatedToken)
    setUser(updatedUser)
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', token })
    } catch {
      setNotice('Không thể thông báo đăng xuất tới máy chủ. Phiên đăng nhập đã được xóa khỏi trình duyệt.')
    }

    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setCars([])
    setSchedules([])
    setDashboard(null)
    setIsLoading(false)
    setIsCarsLoading(false)
    setIsSchedulesLoading(false)
    setIsDashboardLoading(false)
    setActivePage('dashboard')
  }

  if (isLoading) {
    return <main className="auth-page"><p role="status">Đang tải tài khoản...</p></main>
  }

  if (!user) {
    return (
      <>
        {notice && <p className="logout-notice" role="status">{notice}</p>}
        <AuthScreen />
      </>
    )
  }

  if (activePage === 'profile') {
    return (
      <div className="app-shell min-h-screen bg-[#f6f8f7] text-[#15221f]">
        <Sidebar
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onLogout={handleLogout}
          onProfile={() => setActivePage('profile')}
          user={user}
        />
        {notice && <p className="logout-notice" role="alert">{notice}</p>}
        <ProfilePage
          onDashboard={() => setActivePage('dashboard')}
          onLogout={handleLogout}
          onUserUpdated={handleUserUpdated}
          token={token}
          user={user}
        />
        <MobileNav
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onProfile={() => setActivePage('profile')}
        />
      </div>
    )
  }

  if (activePage === 'cars') {
    return (
      <div className="app-shell min-h-screen bg-[#f6f8f7] text-[#15221f]">
        <Sidebar
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onLogout={handleLogout}
          onProfile={() => setActivePage('profile')}
          user={user}
        />
        {notice && <p className="logout-notice" role="alert">{notice}</p>}
        {isCarsLoading ? (
          <main className="main-content"><p role="status">Đang tải danh sách xe...</p></main>
        ) : (
          <CarsPage cars={cars} loadError={loadErrors.cars} onCarsChanged={setCars} token={token} />
        )}
        <MobileNav
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onProfile={() => setActivePage('profile')}
        />
      </div>
    )
  }

  if (activePage === 'maintenance') {
    return (
      <div className="app-shell min-h-screen bg-[#f6f8f7] text-[#15221f]">
        <Sidebar
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onLogout={handleLogout}
          onProfile={() => setActivePage('profile')}
          user={user}
        />
        {notice && <p className="logout-notice" role="alert">{notice}</p>}
        {isCarsLoading ? (
          <main className="main-content"><p role="status">Đang tải danh sách xe...</p></main>
        ) : loadErrors.cars ? (
          <main className="main-content maintenance-page">
            <p className="form-error" role="alert">{loadErrors.cars}</p>
          </main>
        ) : (
          <MaintenancePage cars={cars} token={token} />
        )}
        <MobileNav
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onProfile={() => setActivePage('profile')}
        />
      </div>
    )
  }

  if (activePage === 'schedules') {
    return (
      <div className="app-shell min-h-screen bg-[#f6f8f7] text-[#15221f]">
        <Sidebar
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onLogout={handleLogout}
          onProfile={() => setActivePage('profile')}
          user={user}
        />
        {notice && <p className="logout-notice" role="alert">{notice}</p>}
        {isSchedulesLoading ? (
          <main className="main-content"><p role="status">Đang tải lịch nhắc...</p></main>
        ) : (
          <SchedulesPage
            cars={cars}
            loadError={loadErrors.cars || loadErrors.schedules}
            onSchedulesChanged={setSchedules}
            schedules={schedules}
            token={token}
          />
        )}
        <MobileNav
          activePage={activePage}
          onCars={() => setActivePage('cars')}
          onMaintenance={() => setActivePage('maintenance')}
          onSchedules={() => setActivePage('schedules')}
          onDashboard={() => setActivePage('dashboard')}
          onProfile={() => setActivePage('profile')}
        />
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-[#f6f8f7] text-[#15221f]">
      <Sidebar
        activePage={activePage}
        onCars={() => setActivePage('cars')}
        onMaintenance={() => setActivePage('maintenance')}
        onSchedules={() => setActivePage('schedules')}
        onDashboard={() => setActivePage('dashboard')}
        onLogout={handleLogout}
        onProfile={() => setActivePage('profile')}
        user={user}
      />
      {notice && <p className="logout-notice" role="alert">{notice}</p>}

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">BẢNG ĐIỀU KHIỂN</p>
            <h1>Chào mừng đến AutoCare <span aria-hidden="true">✦</span></h1>
            <p className="page-subtitle">Mọi thông tin chăm sóc xe của bạn, trong một nơi.</p>
          </div>
          <button
            className="icon-button notification-button"
            type="button"
            aria-label={`Thông báo lịch bảo dưỡng: ${attentionSchedules.length} lịch cần chú ý`}
            aria-expanded={isNotificationOpen}
            aria-controls="maintenance-notifications"
            onClick={() => setIsNotificationOpen((isOpen) => !isOpen)}
          >
            <Icon name="bell" />
            {attentionSchedules.length > 0 && <span className="notification-dot" />}
          </button>
          {isNotificationOpen && (
            <section className="notification-popover" id="maintenance-notifications" aria-label="Thông báo bảo dưỡng">
              <div className="notification-popover-heading">
                <strong>Nhắc lịch bảo dưỡng</strong>
                <span>{attentionSchedules.length}</span>
              </div>
              {loadErrors.schedules ? (
                <p className="notification-empty" role="alert">{loadErrors.schedules}</p>
              ) : isSchedulesLoading ? (
                <p className="notification-empty" role="status">Đang tải lịch nhắc...</p>
              ) : attentionSchedules.length === 0 ? (
                <p className="notification-empty">Hiện chưa có lịch nào cần chú ý.</p>
              ) : (
                <div className="notification-list">
                  {attentionSchedules.map((schedule) => (
                    <button
                      className="notification-item"
                      key={schedule.id}
                      type="button"
                      onClick={() => { setIsNotificationOpen(false); setActivePage('schedules') }}
                    >
                      <span className={`schedule-status ${schedule.due.status}`}>
                        {schedule.due.status === 'overdue' ? 'Đến hạn' : 'Sắp đến hạn'}
                      </span>
                      <span className="notification-item-copy">
                        <strong>{schedule.itemName}</strong>
                        <small>{schedule.make} {schedule.model} · {schedule.licensePlate}</small>
                        <small>
                          {schedule.due.daysUntilDue != null
                            ? schedule.due.daysUntilDue < 0
                              ? `Quá hạn ${Math.abs(schedule.due.daysUntilDue)} ngày`
                              : schedule.due.daysUntilDue === 0
                                ? 'Đến hạn hôm nay'
                                : `Còn ${schedule.due.daysUntilDue} ngày`
                            : schedule.due.kmRemaining != null
                              ? schedule.due.kmRemaining <= 0
                                ? `Quá mốc ${Math.abs(schedule.due.kmRemaining).toLocaleString('vi-VN')} km`
                                : `Còn ${schedule.due.kmRemaining.toLocaleString('vi-VN')} km`
                              : 'Đến kỳ bảo dưỡng'}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                className="notification-view-all"
                type="button"
                onClick={() => { setIsNotificationOpen(false); setActivePage('schedules') }}
              >Xem tất cả lịch nhắc</button>
            </section>
          )}
        </header>

        <section className="stats-grid" aria-label="Tổng quan">
          <article className="stat-card">
            <span className="stat-icon blue"><Icon name="car" /></span>
            <p className="stat-label">Tổng số xe</p>
            <strong className="stat-value">
              {isDashboardLoading || loadErrors.dashboard ? '—' : dashboard?.totalCars ?? 0} <span>xe</span>
            </strong>
            <p className="stat-hint">
              {loadErrors.dashboard
                ? 'Không tải được số liệu'
                : isDashboardLoading
                  ? 'Đang tải...'
                  : `${dashboard?.activeCars ?? 0} xe đang sử dụng`}
            </p>
          </article>
          <article className="stat-card">
            <span className="stat-icon green"><Icon name="wrench" /></span>
            <p className="stat-label">Lần bảo dưỡng gần nhất</p>
            <strong className="stat-value stat-placeholder">
              {loadErrors.dashboard
                ? 'Không tải được'
                : isDashboardLoading
                ? 'Đang tải...'
                : dashboard?.latestMaintenance?.itemName ?? 'Chưa có'}
            </strong>
            <p className="stat-hint">
              {loadErrors.dashboard
                ? 'Hãy tải lại trang để thử lại'
                : dashboard?.latestMaintenance
                ? `${dashboard.latestMaintenance.make} ${dashboard.latestMaintenance.model} · ${new Date(`${dashboard.latestMaintenance.performedAt}T00:00:00`).toLocaleDateString('vi-VN')}`
                : 'Lịch sử sẽ hiển thị tại đây'}
            </p>
          </article>
          <article className="stat-card">
            <span className="stat-icon green"><Icon name="wrench" /></span>
            <p className="stat-label">Tổng chi phí bảo dưỡng</p>
            <strong className="stat-value stat-placeholder">
              {loadErrors.dashboard
                ? '—'
                : isDashboardLoading
                ? 'Đang tải...'
                : `${Number(dashboard?.totalMaintenanceCost ?? 0).toLocaleString('vi-VN')} đ`}
            </strong>
            <p className="stat-hint">Tổng cộng các lần bảo dưỡng đã ghi</p>
          </article>
          <article className="stat-card">
            <span className="stat-icon orange"><Icon name="calendar" /></span>
            <p className="stat-label">Lịch cần chú ý</p>
            <strong className="stat-value">
              {loadErrors.schedules ? '—' : attentionSchedules.length} <span>nhắc nhở</span>
            </strong>
            <p className="stat-hint">Gần đến hạn hoặc đã đến hạn</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel welcome-panel">
            <div className="panel-heading">
              <div>
                <h2>Xe của bạn</h2>
                <p>Quản lý thông tin và theo dõi tình trạng xe.</p>
              </div>
              <button className="text-button" onClick={() => setActivePage('cars')} type="button">
                <Icon name="plus" size={18} />
                Thêm xe
              </button>
            </div>
            {loadErrors.cars ? (
              <div className="empty-state">
                <p className="form-error" role="alert">{loadErrors.cars}</p>
              </div>
            ) : cars.length === 0 ? (
              <div className="empty-state">
                <span className="empty-car"><Icon name="car" size={34} /></span>
                <h3>Chưa có xe nào</h3>
                <p>Thêm chiếc xe đầu tiên để bắt đầu theo dõi số km và lịch bảo dưỡng.</p>
                <button className="primary-button" onClick={() => setActivePage('cars')} type="button">
                  <Icon name="plus" size={18} />
                  Thêm xe đầu tiên
                </button>
              </div>
            ) : (
              <div className="dashboard-car-list">
                {cars.slice(0, 3).map((car) => (
                  <div className="dashboard-car-row" key={car.id}>
                    <span className="dashboard-car-icon"><Icon name="car" size={19} /></span>
                    <span className="dashboard-car-copy">
                      <strong>{car.make} {car.model}</strong>
                      <small>{car.licensePlate} · {car.currentMileage.toLocaleString('vi-VN')} km</small>
                    </span>
                  </div>
                ))}
                <button className="car-list-link" onClick={() => setActivePage('cars')} type="button">
                  {cars.length > 3 ? 'Quản lý tất cả xe' : 'Quản lý xe'}
                </button>
              </div>
            )}
          </article>

          <article className="panel reminder-panel">
            <div className="panel-heading">
              <div>
                <h2>Lịch bảo dưỡng</h2>
                <p>Lịch sắp đến hạn và đã đến hạn.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setActivePage('schedules')}
                type="button"
                aria-label="Mở lịch nhắc bảo dưỡng"
              >
                <Icon name="arrow" />
              </button>
            </div>
            {loadErrors.schedules ? (
              <div className="reminder-empty" role="alert">{loadErrors.schedules}</div>
            ) : attentionSchedules.length === 0 ? (
              <div className="reminder-empty">
                <span className="reminder-icon"><Icon name="calendar" size={23} /></span>
                <strong>Chưa có lịch cần chú ý</strong>
                <p>Tạo lịch để được nhắc khi xe gần đến hạn bảo dưỡng.</p>
                <button className="car-list-link" onClick={() => setActivePage('schedules')} type="button">
                  Mở lịch nhắc
                </button>
              </div>
            ) : (
              <div className="dashboard-schedule-list">
                {attentionSchedules.slice(0, 3).map((schedule) => (
                  <button
                    className="dashboard-schedule-row"
                    key={schedule.id}
                    onClick={() => setActivePage('schedules')}
                    type="button"
                  >
                    <span className={`schedule-status ${schedule.due.status}`}>
                      {schedule.due.status === 'overdue' ? 'Đến hạn' : 'Sắp đến hạn'}
                    </span>
                    <span className="dashboard-schedule-copy">
                      <strong>{schedule.itemName}</strong>
                      <small>{schedule.make} {schedule.model} · {schedule.licensePlate}</small>
                      {schedule.due.kmRemaining != null && (
                        <small>
                          {schedule.due.kmRemaining <= 0
                            ? 'Đã vượt mốc km'
                            : `Còn ${schedule.due.kmRemaining.toLocaleString('vi-VN')} km`}
                        </small>
                      )}
                      {schedule.due.daysUntilDue != null && (
                        <small>
                          {schedule.due.daysUntilDue < 0
                            ? 'Đã quá ngày hẹn'
                            : schedule.due.daysUntilDue === 0
                              ? 'Đến hạn hôm nay'
                              : `Còn ${schedule.due.daysUntilDue} ngày`}
                        </small>
                      )}
                    </span>
                  </button>
                ))}
                <button className="car-list-link" onClick={() => setActivePage('schedules')} type="button">
                  Xem tất cả lịch nhắc
                </button>
              </div>
            )}
            <div className="tip-box">
              <span className="tip-sparkle" aria-hidden="true">✦</span>
              <p><strong>Mẹo nhỏ</strong><br />Ghi lại số km sau mỗi chuyến đi để quản lý lịch bảo dưỡng chính xác hơn.</p>
            </div>
          </article>
        </section>

        <p className="demo-note">Giao diện khởi đầu · Các chức năng sẽ được bổ sung theo từng giai đoạn.</p>
      </main>

      <MobileNav
        activePage={activePage}
        onCars={() => setActivePage('cars')}
        onMaintenance={() => setActivePage('maintenance')}
        onSchedules={() => setActivePage('schedules')}
        onDashboard={() => setActivePage('dashboard')}
        onProfile={() => setActivePage('profile')}
      />
    </div>
  )
}

export default App
