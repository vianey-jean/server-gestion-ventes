/**
 * dbHelper — Centralized JSON database read/write with encryption support
 * 
 * All models should use these functions instead of direct fs.readFileSync/writeFileSync
 * for JSON files in the db/ directory.
 */

const fs = require('fs');
const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('./encryption');

const dbPath = path.join(__dirname, '../db');

/**
 * Read a JSON file from the db directory with automatic decryption
 * @param {string} filePathOrName - Full path or just filename (e.g., 'clients.json')
 * @returns {any} Parsed JSON data or null
 */
function readDb(filePathOrName) {
  const fullPath = filePathOrName.includes(path.sep) || filePathOrName.includes('/')
    ? filePathOrName
    : path.join(dbPath, filePathOrName);
  return readJsonDecrypted(fullPath);
}

/**
 * Write data to a JSON file in the db directory with automatic encryption
 * @param {string} filePathOrName - Full path or just filename
 * @param {any} data - Data to write
 */
function writeDb(filePathOrName, data) {
  const fullPath = filePathOrName.includes(path.sep) || filePathOrName.includes('/')
    ? filePathOrName
    : path.join(dbPath, filePathOrName);
  writeJsonEncrypted(fullPath, data);
}

module.exports = { readDb, writeDb };
