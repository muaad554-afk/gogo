// app.js — Express app with AI refund automation logic

const express = require('express');
const dotenv = require('dotenv');
const refundHandler = require('./routes'); // handles /process-refund route

// Catch unexpected crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

dotenv.config(); // load .env vars

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('Refund Automation Backend is live');
});

// Refund route
app.post('/process-refund', refundHandler);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
