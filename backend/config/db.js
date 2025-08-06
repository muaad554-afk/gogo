const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

// Encryption config - from env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16; // AES block size

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be set in .env and be 32 characters long");
}

// Encryption helpers
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encrypted) {
  const [ivHex, encryptedText] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// DB path setup
const dbPath = process.env.DATABASE_URL || path.join(__dirname, "..", "refunds.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to DB:", err.message);
  } else {
    console.log(`Connected to SQLite DB at ${dbPath}`);
    runMigrations(); // Run migrations on startup
  }
});

// Promisify DB methods
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Migration system
async function runMigrations() {
  try {
    await run(`CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      run_on DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Check applied migrations
    const applied = await all(`SELECT name FROM migrations`);
    const appliedNames = applied.map(m => m.name);

    // List of migration scripts to run (add new here when needed)
    const migrations = [
      {
        name: "init_tables",
        up: async () => {
          await run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`);

          await run(`CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER UNIQUE,
            stripe_key TEXT,
            paypal_key TEXT,
            slack_url TEXT,
            openai_key TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id)
          )`);

          await run(`CREATE TABLE IF NOT EXISTS refunds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            order_id TEXT,
            refund_amount REAL,
            status TEXT,
            customer_name TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES clients(id)
          )`);

          await run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            action TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES clients(id)
          )`);

          await run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            twofa_secret TEXT,
            is_admin BOOLEAN DEFAULT 0
          )`);
        }
      },

      // Future migrations here, e.g.,
      // {
      //   name: "add_new_column_to_clients",
      //   up: async () => { await run("ALTER TABLE clients ADD COLUMN new_col TEXT"); }
      // },
    ];

    for (const migration of migrations) {
      if (!appliedNames.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        await migration.up();
        await run(`INSERT INTO migrations (name) VALUES (?)`, [migration.name]);
        console.log(`Migration ${migration.name} applied`);
      }
    }
  } catch (err) {
    console.error("Migration error:", err);
  }
}

// Users
exports.createUser = (username, passwordHash, isAdmin = false) =>
  run(
    "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)",
    [username, passwordHash, isAdmin ? 1 : 0]
  ).then((result) => result.lastID);

exports.getUserByUsername = (username) =>
  get("SELECT * FROM users WHERE username = ?", [username]);

exports.setUser2FASecret = (userId, secret) =>
  run("UPDATE users SET twofa_secret = ? WHERE id = ?", [secret, userId]);

exports.getUser2FASecret = (userId) =>
  get("SELECT twofa_secret FROM users WHERE id = ?", [userId]).then((row) =>
    row ? row.twofa_secret : null
  );

// Clients
exports.createClient = ({ name, email }) =>
  run("INSERT INTO clients (name, email) VALUES (?, ?)", [name, email]).then(
    (result) => result.lastID
  );

exports.getAllClients = () => all("SELECT * FROM clients");

// Credentials - encrypted storage & retrieval
exports.saveEncryptedCredentials = async ({
  client_id,
  stripe_key,
  paypal_key,
  slack_url,
  openai_key,
}) => {
  const encStripeKey = stripe_key ? encrypt(stripe_key) : null;
  const encPaypalKey = paypal_key ? encrypt(paypal_key) : null;
  const encSlackUrl = slack_url ? encrypt(slack_url) : null;
  const encOpenAiKey = openai_key ? encrypt(openai_key) : null;

  await run(
    `INSERT INTO credentials (client_id, stripe_key, paypal_key, slack_url, openai_key)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(client_id) DO UPDATE SET
       stripe_key=excluded.stripe_key,
       paypal_key=excluded.paypal_key,
       slack_url=excluded.slack_url,
       openai_key=excluded.openai_key`,
    [client_id, encStripeKey, encPaypalKey, encSlackUrl, encOpenAiKey]
  );
};

exports.getDecryptedCredentials = async (client_id) => {
  const record = await get("SELECT * FROM credentials WHERE client_id = ?", [
    client_id,
  ]);
  if (!record) return null;

  return {
    stripeKey: record.stripe_key ? decrypt(record.stripe_key) : null,
    paypalKey: record.paypal_key ? decrypt(record.paypal_key) : null,
    slackUrl: record.slack_url ? decrypt(record.slack_url) : null,
    openAiKey: record.openai_key ? decrypt(record.openai_key) : null,
  };
};

// Refunds
exports.logRefund = ({
  client_id,
  order_id,
  refund_amount,
  status,
  customer_name,
}) =>
  run(
    "INSERT INTO refunds (client_id, order_id, refund_amount, status, customer_name) VALUES (?, ?, ?, ?, ?)",
    [client_id, order_id, refund_amount, status, customer_name]
  ).then((result) => result.lastID);

// Audit logs
exports.logAudit = ({ client_id, action }) =>
  run("INSERT INTO audit_logs (client_id, action) VALUES (?, ?)", [
    client_id,
    action,
  ]).then((result) => result.lastID);

exports.db = db;
