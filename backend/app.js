const express = require('express');
const dotenv = require('dotenv');
const routes = require('./routes');

if (typeof routes === 'function') {
  // routes.js exports a function, treat as middleware/handler
  app.post('/process-refund', routes);
} else if (typeof routes === 'object' && routes !== null) {
  // routes.js exports object with handlers
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

// Use router (this contains your /process-refund route inside)
app.use('/', refundRouter);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
