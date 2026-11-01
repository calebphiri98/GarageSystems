CREATE TABLE IF NOT EXISTS job_services (
    id BIGSERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES job_cards(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    recorded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_services_job ON job_services(job_id);
