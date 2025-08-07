const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { getCredentials } = require("./credentials");
const { maskCredential } = require("./security");

const LOG_DIR = path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

function writeLogFile(level, message) {
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  const logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error("Failed to write log file:", err);
  });
}

const logger = {
  info: async (message, clientId = null) => {
    await logWithLevel("info", message, clientId);
  },
  warn: async (message, clientId = null) => {
    await logWithLevel("warn", message, clientId);
  },
  error: async (message, clientId = null) => {
    await logWithLevel("error", message, clientId);
  },
  stream: {
    write: (message) => {
      writeLogFile("info", message.trim());
      console.log(message.trim());
    },
  },
};

async function logWithLevel(level, message, clientId) {
  const prefix = clientId ? `[Client:${clientId}] ` : "";
  const logMessage = prefix + message;
  writeLogFile(level, logMessage);
  console[level](logMessage);
  await maybeSendSlackAlert(level, message, clientId);
}

async function maybeSendSlackAlert(level, message, clientId) {
  if (!clientId) return;
  try {
    const creds = await getCredentials(clientId);
    if (!creds?.slackUrl) return;

    await axios.post(creds.slackUrl, {
      text: `*[${level.toUpperCase()}]* ${message}`,
    });
  } catch (err) {
    console.error("Slack alert failed:", err.message);
  }
}

module.exports = logger;
