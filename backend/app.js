const express = require('express');
const dotenv = require('dotenv');
const routes = require('./routes');

dotenv.config(); // Load environment variables early

const app = express();
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.send('Refund Automation Backend is live');
});

// Use routes
app.use('/', routes);

// Global error handling for crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
