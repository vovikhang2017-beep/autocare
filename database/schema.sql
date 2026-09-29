CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  production_year INTEGER CHECK (
    production_year IS NULL OR production_year BETWEEN 1886 AND 2100
  ),
  license_plate VARCHAR(30) NOT NULL,
  current_mileage INTEGER NOT NULL DEFAULT 0 CHECK (current_mileage >= 0),
  purchase_date DATE NULL,
  image_url VARCHAR(2048) NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (license_plate),
  FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cars_user_id ON cars (user_id);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  performed_at DATE NOT NULL,
  mileage INTEGER NOT NULL CHECK (mileage >= 0),
  cost NUMERIC NOT NULL DEFAULT 0 CHECK (cost >= 0),
  garage VARCHAR(180) NULL,
  notes TEXT NULL,
  invoice_image_url VARCHAR(2048) NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id) REFERENCES cars (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_car_date
  ON maintenance_records (car_id, performed_at);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  next_due_mileage INTEGER CHECK (
    next_due_mileage IS NULL OR next_due_mileage >= 0
  ),
  next_due_date DATE NULL,
  reminder_before_km INTEGER CHECK (
    reminder_before_km IS NULL OR reminder_before_km >= 0
  ),
  reminder_before_days INTEGER CHECK (
    reminder_before_days IS NULL OR reminder_before_days >= 0
  ),
  notes TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id) REFERENCES cars (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_car_active
  ON maintenance_schedules (car_id, is_active);
