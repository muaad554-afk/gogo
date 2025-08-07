DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS audit_logs;

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  stripe_secret_key TEXT,
  paypal_client_id TEXT,
  paypal_client_secret TEXT,
  shopify_api_key TEXT,
  shopify_api_secret TEXT,
  shopify_access_token TEXT,
  slack_webhook_url TEXT,
  openai_api_key TEXT,
  encryption_iv TEXT NOT NULL,
  mock_mode INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  body TEXT NOT NULL,
  amount REAL NOT NULL,
  platform TEXT NOT NULL,
  order_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  auto_approved INTEGER DEFAULT 0,
  client_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
