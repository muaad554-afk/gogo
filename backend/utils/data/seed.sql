-- Dummy audit log entry
INSERT INTO audit_logs (clientId, orderId, amount, status, fraudRisk)
VALUES ('testClient', 'ORDER1234', 49.99, 'auto_approved', 0.12);
