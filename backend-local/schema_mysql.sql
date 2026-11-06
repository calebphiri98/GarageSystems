-- ============================================================
-- UPTOWN GARAGE - Local MySQL / MariaDB schema (XAMPP)
-- Use this with backend-local. The production schema for Neon
-- lives in ../backend/schema.sql (PostgreSQL).
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------- Users ----------------
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','admin','manager','mechanic') NOT NULL DEFAULT 'customer',
  specialty VARCHAR(100) NULL,
  is_active TINYINT(1) NULL DEFAULT 1,
  created_by INT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_key (email),
  KEY fk_users_created_by (created_by),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Password reset tokens ----------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_reset_token_hash (token_hash),
  KEY idx_password_reset_user_id (user_id),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Vehicles ----------------
CREATE TABLE IF NOT EXISTS vehicles (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  make VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  year INT NULL,
  plate_number VARCHAR(30) NOT NULL,
  vin VARCHAR(50) NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY vehicles_plate_number_key (plate_number),
  KEY idx_vehicles_customer (customer_id),
  CONSTRAINT fk_vehicles_customer FOREIGN KEY (customer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Services catalog ----------------
CREATE TABLE IF NOT EXISTS services (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  estimated_price DECIMAL(12,2) NULL,
  is_active TINYINT(1) NULL DEFAULT 1,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  image_url VARCHAR(500) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Appointments ----------------
CREATE TABLE IF NOT EXISTS appointments (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  service_type VARCHAR(150) NOT NULL,
  requested_date DATETIME NOT NULL,
  status ENUM('Pending','Confirmed','Arrived','Converted','Cancelled','No-show') NOT NULL DEFAULT 'Pending',
  notes TEXT NULL,
  confirmed_by INT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_status (status, requested_date),
  KEY fk_appointments_customer (customer_id),
  KEY fk_appointments_vehicle (vehicle_id),
  KEY fk_appointments_confirmed_by (confirmed_by),
  CONSTRAINT fk_appointments_customer FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT fk_appointments_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
  CONSTRAINT fk_appointments_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Job cards ----------------
CREATE TABLE IF NOT EXISTS job_cards (
  id INT NOT NULL AUTO_INCREMENT,
  job_number VARCHAR(30) NOT NULL,
  customer_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  appointment_id INT NULL,
  assigned_mechanic_id INT NULL,
  reported_problem TEXT NOT NULL,
  diagnosis TEXT NULL,
  work_performed TEXT NULL,
  completion_notes TEXT NULL,
  status ENUM(
    'Booked','Vehicle Checked In','Inspection','Awaiting Approval','Approved',
    'In Progress','Waiting for Parts','Completed','Ready for Collection','Collected'
  ) NOT NULL DEFAULT 'Booked',
  opened_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by INT NULL,
  closed_at DATETIME NULL,
  scheduled_start DATETIME NULL,
  scheduled_end DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY job_cards_job_number_key (job_number),
  KEY idx_job_cards_status (status),
  KEY idx_job_cards_mechanic_schedule (assigned_mechanic_id, scheduled_start, scheduled_end),
  KEY fk_job_cards_customer (customer_id),
  KEY fk_job_cards_vehicle (vehicle_id),
  KEY fk_job_cards_appointment (appointment_id),
  KEY fk_job_cards_verified_by (verified_by),
  CONSTRAINT fk_job_cards_customer FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT fk_job_cards_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
  CONSTRAINT fk_job_cards_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id),
  CONSTRAINT fk_job_cards_mechanic FOREIGN KEY (assigned_mechanic_id) REFERENCES users (id),
  CONSTRAINT fk_job_cards_verified_by FOREIGN KEY (verified_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Approval requests ----------------
CREATE TABLE IF NOT EXISTS job_approvals (
  id INT NOT NULL AUTO_INCREMENT,
  job_id INT NOT NULL,
  description TEXT NOT NULL,
  estimated_cost DECIMAL(12,2) NULL DEFAULT 0,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  requested_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY fk_job_approvals_job (job_id),
  CONSTRAINT fk_job_approvals_job FOREIGN KEY (job_id) REFERENCES job_cards (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Parts / inventory ----------------
CREATE TABLE IF NOT EXISTS parts (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50) NOT NULL,
  description TEXT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NULL DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 5,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  image_url VARCHAR(500) NULL,
  category VARCHAR(80) NULL,
  serial_number VARCHAR(100) NULL,
  brand VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY parts_sku_key (sku),
  KEY idx_parts_name (name),
  KEY idx_parts_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS filter_types (
  id INT NOT NULL AUTO_INCREMENT,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY filter_types_category_name_key (category, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS filter_options (
  id INT NOT NULL AUTO_INCREMENT,
  filter_type_id INT NOT NULL,
  value VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY filter_options_filter_type_id_value_key (filter_type_id, value),
  CONSTRAINT fk_filter_options_type FOREIGN KEY (filter_type_id) REFERENCES filter_types (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS part_filter_options (
  part_id INT NOT NULL,
  option_id INT NOT NULL,
  PRIMARY KEY (part_id, option_id),
  KEY idx_pfo_option (option_id),
  CONSTRAINT fk_pfo_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT fk_pfo_option FOREIGN KEY (option_id) REFERENCES filter_options (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS part_images (
  id INT NOT NULL AUTO_INCREMENT,
  part_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  sort_order INT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY fk_part_images_part (part_id),
  CONSTRAINT fk_part_images_part FOREIGN KEY (part_id) REFERENCES parts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT NOT NULL AUTO_INCREMENT,
  part_id INT NOT NULL,
  type ENUM('in','used','sold','adjustment') NOT NULL,
  quantity INT NOT NULL,
  reference_job_id INT NULL,
  reference_order_id INT NULL,
  reason TEXT NULL,
  created_by INT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_stock_movements_part (part_id),
  KEY fk_stock_movements_job (reference_job_id),
  KEY fk_stock_movements_created_by (created_by),
  CONSTRAINT fk_stock_movements_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT fk_stock_movements_job FOREIGN KEY (reference_job_id) REFERENCES job_cards (id),
  CONSTRAINT fk_stock_movements_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS job_parts (
  id INT NOT NULL AUTO_INCREMENT,
  job_id INT NOT NULL,
  part_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY fk_job_parts_job (job_id),
  KEY fk_job_parts_part (part_id),
  CONSTRAINT fk_job_parts_job FOREIGN KEY (job_id) REFERENCES job_cards (id),
  CONSTRAINT fk_job_parts_part FOREIGN KEY (part_id) REFERENCES parts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Orders ----------------
CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  status ENUM('Pending','Confirmed','Rejected','Ready for Collection','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_status (status),
  KEY fk_orders_customer (customer_id),
  KEY fk_orders_reviewed_by (reviewed_by),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT fk_orders_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  part_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY fk_order_items_order (order_id),
  KEY fk_order_items_part (part_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_order_items_part FOREIGN KEY (part_id) REFERENCES parts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Invoices & payments ----------------
CREATE TABLE IF NOT EXISTS invoices (
  id INT NOT NULL AUTO_INCREMENT,
  invoice_number VARCHAR(30) NOT NULL,
  source_type ENUM('job','order','combined') NOT NULL,
  job_id INT NULL,
  order_id INT NULL,
  customer_id INT NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('Unpaid','Partially Paid','Paid','Refunded','Cancelled') NOT NULL DEFAULT 'Unpaid',
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY invoices_invoice_number_key (invoice_number),
  UNIQUE KEY uq_invoices_order (order_id),
  KEY idx_invoices_status (status),
  KEY fk_invoices_job (job_id),
  KEY fk_invoices_customer (customer_id),
  CONSTRAINT fk_invoices_job FOREIGN KEY (job_id) REFERENCES job_cards (id),
  CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT NOT NULL AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(50) NULL DEFAULT 'Cash',
  paid_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by INT NULL,
  reference VARCHAR(100) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY fk_payments_invoice (invoice_id),
  KEY fk_payments_recorded_by (recorded_by),
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
  CONSTRAINT fk_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS payment_attempts (
  id INT NOT NULL AUTO_INCREMENT,
  tx_ref VARCHAR(100) NOT NULL,
  invoice_id INT NOT NULL,
  customer_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MWK',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  gateway_response JSON NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY payment_attempts_tx_ref_key (tx_ref),
  KEY idx_payment_attempts_invoice (invoice_id),
  KEY fk_payment_attempts_customer (customer_id),
  CONSTRAINT fk_payment_attempts_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
  CONSTRAINT fk_payment_attempts_customer FOREIGN KEY (customer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Notifications ----------------
CREATE TABLE IF NOT EXISTS notifications (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NULL DEFAULT 0,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_notifications_user (user_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Audit trail ----------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  role ENUM('customer','admin','manager','mechanic') NULL,
  action VARCHAR(150) NOT NULL,
  affected_table VARCHAR(100) NULL,
  affected_id INT NULL,
  previous_value TEXT NULL,
  new_value TEXT NULL,
  reason TEXT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_audit_logs_user (user_id),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Services recorded on jobs ----------------
CREATE TABLE IF NOT EXISTS job_services (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_id INT NOT NULL,
  service_id INT NOT NULL,
  description TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  recorded_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_services_job (job_id),
  KEY fk_job_services_service (service_id),
  KEY fk_job_services_recorded_by (recorded_by),
  CONSTRAINT fk_job_services_job FOREIGN KEY (job_id) REFERENCES job_cards (id),
  CONSTRAINT fk_job_services_service FOREIGN KEY (service_id) REFERENCES services (id),
  CONSTRAINT fk_job_services_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Vehicle edit history ----------------
CREATE TABLE IF NOT EXISTS vehicle_edit_history (
  id INT NOT NULL AUTO_INCREMENT,
  vehicle_id INT NOT NULL,
  edited_by INT NULL,
  previous_value JSON NOT NULL,
  new_value JSON NOT NULL,
  edited_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vehicle_edit_history_vehicle (vehicle_id, edited_at),
  KEY fk_vehicle_edit_history_editor (edited_by),
  CONSTRAINT fk_vehicle_edit_history_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
  CONSTRAINT fk_vehicle_edit_history_editor FOREIGN KEY (edited_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------- Seed login accounts (password: Passw0rd!) ----------------
INSERT INTO users (name, email, password_hash, role) VALUES
('System Manager', 'calebphiri98@gmail.com', '$2y$10$nFUwXD1bTvuv4oMRXiMNsevZkLSOBi7NBatfPEnCDum9mmYNoGLCG', 'manager'),
('Garage Administrator', 'calebphiri918@gmail.com', '$2y$10$nFUwXD1bTvuv4oMRXiMNsevZkLSOBi7NBatfPEnCDum9mmYNoGLCG', 'admin');
