CREATE TABLE external_products (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL UNIQUE,
    search_text TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    body TEXT NOT NULL
);

CREATE TABLE personal_products (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    barcode TEXT,
    search_text TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    body TEXT NOT NULL
);
CREATE INDEX personal_products_owner ON personal_products(owner, updated_at, id);
CREATE UNIQUE INDEX personal_products_barcode ON personal_products(owner, barcode) WHERE barcode IS NOT NULL;

CREATE TABLE preferences (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (owner, id)
);

CREATE TABLE assessments (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    assessed_at TEXT NOT NULL,
    body TEXT NOT NULL
);
CREATE INDEX assessments_owner_time ON assessments(owner, assessed_at);

CREATE TABLE favorites (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (owner, id)
);

CREATE TABLE meal_plans (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    version INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (owner, id)
);
CREATE INDEX meal_plans_schedule ON meal_plans(owner, deleted, date, slot);

CREATE TABLE consumption_records (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    consumed_at TEXT NOT NULL,
    plan_id TEXT,
    version INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (owner, id)
);
CREATE INDEX consumption_history ON consumption_records(owner, deleted, consumed_at);
CREATE UNIQUE INDEX consumption_per_plan ON consumption_records(owner, plan_id)
    WHERE plan_id IS NOT NULL AND deleted = 0;

CREATE TABLE sync_operations (
    owner TEXT NOT NULL,
    op_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    result TEXT NOT NULL,
    PRIMARY KEY (owner, op_id)
);
