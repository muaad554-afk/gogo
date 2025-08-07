const fs = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "..", "logs", "audit.log");

exports.logAudit = async ({ clientId, orderId, amount, status, fraudRisk }) => {
  const entry = `${new Date().toISOString()} | Client: ${clientId} | Order: ${orderId} | Amount: $${amount} | Status: ${status} | Risk: ${fraudRisk}\n`;
  fs.appendFile(logFile, entry, (err) => {
    if (err) console.error("Failed to write audit log:", err);
  });
};
