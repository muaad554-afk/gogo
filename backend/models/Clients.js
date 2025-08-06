const { db } = require('../config/db');

function createClient({ name, email }, callback) {
  db.run('INSERT INTO clients (name, email) VALUES (?, ?)', [name, email], callback);
}

function getClientById(id, callback) {
  db.get('SELECT * FROM clients WHERE id = ?', [id], callback);
}

function getAllClients(callback) {
  db.all('SELECT * FROM clients', callback);
}

module.exports = { createClient, getClientById, getAllClients };
