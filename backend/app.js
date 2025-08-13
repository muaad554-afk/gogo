require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const ipWhitelist = require("./utils/ipWhitelist");
const twoFAMiddleware = require("./utils/2fa");
const logger = require("./utils/logs");

// Routes
const authRoutes = require("./routes/auth");
const setupCredentialsRoutes = require("./routes/setupCredentials");
const shopifyOAuthRoutes = require("./routes/oauth");
const adminRoutes = require("./routes/admin");
const twoFaRoutes = require("./routes/twofa");
const credentialsRoutes = require("./routes/credentials");
const fraudRoutes = require("./routes/fraud");
const ipRoutes = require("./routes/ip");
const refundsRoutes = require("./routes/refunds");
const platformsRoutes = require("./routes/platforms");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("combined", { stream: logger.stream }));

// JWT Authentication Middleware
app.use((req, res, next) => {
  // Public routes that do not require auth
  if (
    req.path.startsWith("/auth") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/public")
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "JWT token missing" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired JWT token" });
  }
});

// Two-Factor Authentication Middleware (can be stub or real)
app.use(twoFAMiddleware);

// Route mounting
app.use("/auth", authRoutes);
app.use("/setup-credentials", setupCredentialsRoutes);
app.use("/shopify", shopifyOAuthRoutes);
app.use("/admin", adminRoutes);
app.use("/twofa", twoFaRoutes);
app.use("/credentials", credentialsRoutes);
app.use("/fraud", fraudRoutes);
app.use("/ip", ipRoutes);
app.use("/refunds", refundsRoutes);
app.use("/platforms", platformsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error with clientId if available, fallback to unknown
  const clientId = req.user?.clientId || req.user?.id || "unknown";
  logger.error(err.message || "Unknown error", clientId);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Refund Automator backend listening on port ${PORT}`);
});
