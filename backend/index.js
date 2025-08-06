require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const logger = require("./middleware/logger");
const rateLimiter = require("./middleware/rateLimiter");
const ipWhitelist = require("./middleware/ipWhitelist");

const authRoutes = require("./routes/auth");
const refundRoutes = require("./routes/refund");
const twofaRoutes = require("./routes/twofa");
const credentialsRoutes = require("./routes/setupCredentials");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("combined", { stream: logger.stream }));

// Apply global rate limiter
app.use(rateLimiter);

// IP Whitelist for all routes
app.use(ipWhitelist);

// Routes
app.use("/auth", authRoutes);
app.use("/refund", refundRoutes);
app.use("/2fa", twofaRoutes);
app.use("/setup-credentials", credentialsRoutes);
app.use("/admin", adminRoutes);

// Health check endpoint
app.get("/", (req, res) => res.send("AI Refund Automator Backend is running"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error: %o", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
