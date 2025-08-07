const express = require("express");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth");
const refundRoutes = require("./routes/refund");

const ipWhitelistMiddleware = require("./middleware/ipWhitelist");
const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(morgan("dev"));
app.use(express.json());
app.use(ipWhitelistMiddleware);

// Routes
app.use("/auth", authRoutes);
app.use("/refund", authMiddleware, refundRoutes);

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({ status: "OK", message: "Refund Automation Backend is live" });
});

// Error handler middleware
app.use(errorHandler);

// Process-level error logging
process.on("uncaughtException", (err) => {
  console.error("🧨 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🧨 Unhandled Rejection:", err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
