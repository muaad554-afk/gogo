const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { getCredentials } = require("./credentials");

const LOG_DIR = path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

// Write log message to file
function writeLogFile(level, message) {
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  const logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error("Failed to write log file:", err);
  });
}

// Core logger object
const logger = {
  info: async (message, clientId = null) => {
    const prefix = clientId ? `[Client:${clientId}] ` : "";
    const logMessage = prefix + message;
    writeLogFile("info", logMessage);
    console.info(logMessage);
    await maybeSendSlackAlert("info", message, clientId);
  },
  warn: async (message, clientId = null) => {
    const prefix = clientId ? `[Client:${clientId}] ` : "";
    const logMessage = prefix + message;
    writeLogFile("warn", logMessage);
    console.warn(logMessage);
    await maybeSendSlackAlert("warn", message, clientId);
  },
  error: async (message, clientId = null) => {
    const prefix = clientId ? `[Client:${clientId}] ` : "";
    const logMessage = prefix + message;
    writeLogFile("error", logMessage);
    console.error(logMessage);
    await maybeSendSlackAlert("error", message, clientId);
  },
  stream: {
    write: (message) => {
      writeLogFile("info", message.trim());
      console.log(message.trim());
    },
  },
};

// Send slack alert if client has a Slack webhook configured
async function maybeSendSlackAlert(level, message, clientId) {
  if (!clientId) return;
  try {
    const creds = await getCredentials(clientId);
    if (!creds?.slackUrl) return;
    await axios.post(creds.slackUrl, {
      text: `*[${level.toUpperCase()}]* ${message}`,
    });
  } catch (err) {
    console.error("Failed to send Slack alert:", err.message);
  }
}

module.exports = logger;
