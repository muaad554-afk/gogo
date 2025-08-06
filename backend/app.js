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

// Dynamically set up route handlers based on what routes exports
if (typeof routes === 'function') {
  // routes.js exports a single function (handler)
  app.post('/process-refund', routes);
} else if (typeof routes === 'object' && routes !== null) {
  // routes.js exports an object
  if (routes.processRefund) {
    app.post('/process-refund', routes.processRefund);
  } else if (routes.router) {
    app.use('/', routes.router);
  } else {
    console.error('routes.js exports an object but no recognizable handlers found');
  }
} else {
  console.error('routes.js export format not recognized');
}

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
