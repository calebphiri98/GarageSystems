-- ============================================================
-- UPTOWN GARAGE - Integrated Garage & Auto Parts Management
-- PostgreSQL schema (designed for Neon)
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'manager', 'mechanic');
CREATE TYPE appointment_status AS ENUM ('Pending','Confirmed','Arrived','Converted','Cancelled','No-show');
CREATE TYPE job_status AS ENUM (
  'Booked','Vehicle Checked In','Inspection','Awaiting Approval','Approved',
  'In Progress','Waiting for Parts','Completed','Ready for Collection','Collected'
);
CREATE TYPE approval_status AS ENUM ('Pending','Approved','Rejected');
CREATE TYPE movement_type AS ENUM ('in','used','sold','adjustment');
CREATE TYPE order_status AS ENUM ('Pending','Confirmed','Rejected','Ready for Collection','Completed');
CREATE TYPE invoice_source AS ENUM ('job','order','combined');
CREATE TYPE payment_status AS ENUM ('Unpaid','Partially Paid','Paid','Refunded','Cancelled');

-- ---------------- Users (all roles share one table -> one login) ----------------
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  specialty VARCHAR(100),         -- for mechanics e.g. 'Engine', 'Electrical'
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ---------------- Vehicles ----------------
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES users(id),
  make VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  year INT,
  plate_number VARCHAR(30) UNIQUE NOT NULL,
  vin VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ---------------- Appointments ----------------
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES users(id),
  vehicle_id INT NOT NULL REFERENCES vehicles(id),
  service_type VARCHAR(150) NOT NULL,
  requested_date TIMESTAMP NOT NULL,
  status appointment_status NOT NULL DEFAULT 'Pending',
  notes TEXT,
  confirmed_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ---------------- Job Cards ----------------
CREATE TABLE job_cards (
  id SERIAL PRIMARY KEY,
  job_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id INT NOT NULL REFERENCES users(id),
  vehicle_id INT NOT NULL REFERENCES vehicles(id),
  appointment_id INT REFERENCES appointments(id),
  assigned_mechanic_id INT REFERENCES users(id),
  reported_problem TEXT NOT NULL,
  diagnosis TEXT,
  work_performed TEXT,
  completion_notes TEXT,
  status job_status NOT NULL DEFAULT 'Booked',
  opened_at TIMESTAMP DEFAULT NOW(),
  verified_by INT REFERENCES users(id),
  closed_at TIMESTAMP
);

-- ---------------- Approval requests (extra work found during inspection) ----------------
CREATE TABLE job_approvals (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES job_cards(id),
  description TEXT NOT NULL,
  estimated_cost NUMERIC(12,2) DEFAULT 0,
  status approval_status NOT NULL DEFAULT 'Pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  decided_at TIMESTAMP
);

-- ---------------- Parts / Inventory ----------------
CREATE TABLE parts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_movements (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id),
  type movement_type NOT NULL,
  quantity INT NOT NULL,
  reference_job_id INT REFERENCES job_cards(id),
  reference_order_id INT,
  reason TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_parts (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES job_cards(id),
  part_id INT NOT NULL REFERENCES parts(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL
);

-- ---------------- Online Parts Orders ----------------
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES users(id),
  status order_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_by INT REFERENCES users(id)
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  part_id INT NOT NULL REFERENCES parts(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL
);

-- ---------------- Invoices & Payments ----------------
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  source_type invoice_source NOT NULL,
  job_id INT REFERENCES job_cards(id),
  order_id INT REFERENCES orders(id),
  customer_id INT NOT NULL REFERENCES users(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'Unpaid',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(50) DEFAULT 'Cash',
  paid_at TIMESTAMP DEFAULT NOW(),
  recorded_by INT REFERENCES users(id)
);

-- ---------------- Notifications ----------------
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ---------------- Audit Trail ----------------
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  role user_role,
  action VARCHAR(150) NOT NULL,
  affected_table VARCHAR(100),
  affected_id INT,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);


INSERT INTO users (name, email, password_hash, role) VALUES
('System Manager', 'calebphiri98@gmail.com', '#123456789', 'manager'),
('Garage Administrator', 'calebphiri918@gmail.com', '#123456789', 'admin');
