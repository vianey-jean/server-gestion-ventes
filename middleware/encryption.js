/**
 * Middleware de cryptage/décryptage transparent des données JSON
 * 
 * Utilise AES-256-CBC pour chiffrer toutes les données stockées dans les fichiers JSON.
 * La clé de cryptage est stockée dans server/db/encryption.json
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const SALT = 'riziky-encryption-salt-2024';
const encryptionConfigPath = path.join(__dirname, '../db/encryption.json');
let cachedConfig = null;
let cachedConfigMtimeMs = 0;
const derivedKeyCache = new Map();

// Files to exclude from encryption (system files)
const EXCLUDED_FILES = ['encryption.json', 'auto-sauvegarde.json', 'settings.json', 'moduleSettings.json'];

/**
 * Get the current encryption config
 */
function getEncryptionConfig() {
  try {
    if (!fs.existsSync(encryptionConfigPath)) return { enabled: false, key: null };
    const stats = fs.statSync(encryptionConfigPath);
    if (cachedConfig && cachedConfigMtimeMs === stats.mtimeMs) {
      return cachedConfig;
    }

    const data = JSON.parse(fs.readFileSync(encryptionConfigPath, 'utf8'));
    cachedConfig = data;
    cachedConfigMtimeMs = stats.mtimeMs;
    return data;
  } catch {
    return { enabled: false, key: null };
  }
}

/**
 * Save encryption config
 */
function saveEncryptionConfig(config) {
  fs.writeFileSync(encryptionConfigPath, JSON.stringify(config, null, 2));
  cachedConfig = config;
  try {
    cachedConfigMtimeMs = fs.statSync(encryptionConfigPath).mtimeMs;
  } catch {
    cachedConfigMtimeMs = Date.now();
  }
  derivedKeyCache.clear();
}

/**
 * Derive a 32-byte key from the encryption key string
 */
function deriveKey(keyString) {
  if (derivedKeyCache.has(keyString)) {
    return derivedKeyCache.get(keyString);
  }

  const derivedKey = crypto.scryptSync(keyString, SALT, 32);
  derivedKeyCache.set(keyString, derivedKey);
  return derivedKey;
}

/**
 * Encrypt data string
 */
function encryptData(plainText, keyString) {
  const key = deriveKey(keyString);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return JSON.stringify({
    __encrypted: true,
    iv: iv.toString('hex'),
    data: encrypted
  });
}

/**
 * Decrypt data string
 */
function decryptData(encryptedJson, keyString) {
  try {
    const parsed = typeof encryptedJson === 'string' ? JSON.parse(encryptedJson) : encryptedJson;
    if (!parsed || !parsed.__encrypted) return encryptedJson;
    
    const key = deriveKey(keyString);
    const iv = Buffer.from(parsed.iv, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption error:', e.message);
    return encryptedJson;
  }
}

/**
 * Check if data is encrypted
 */
function isEncrypted(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return parsed && parsed.__encrypted === true;
  } catch {
    return false;
  }
}

/**
 * Check if a file should be encrypted
 */
function shouldEncryptFile(filename) {
  return !EXCLUDED_FILES.includes(filename);
}

/**
 * Read a JSON file with automatic decryption
 */
function readJsonDecrypted(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const config = getEncryptionConfig();
    const filename = path.basename(filePath);
    
    if (config.enabled && config.key && shouldEncryptFile(filename) && isEncrypted(raw)) {
      const decrypted = decryptData(raw, config.key);
      return JSON.parse(decrypted);
    }
    
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return null;
  }
}

/**
 * Write a JSON file with automatic encryption
 */
function writeJsonEncrypted(filePath, data) {
  const config = getEncryptionConfig();
  const filename = path.basename(filePath);
  const jsonStr = JSON.stringify(data, null, 2);
  
  if (config.enabled && config.key && shouldEncryptFile(filename)) {
    const encrypted = encryptData(jsonStr, config.key);
    fs.writeFileSync(filePath, encrypted);
  } else {
    fs.writeFileSync(filePath, jsonStr);
  }
}

/**
 * Encrypt all existing data files with the given key
 */
function encryptAllData(keyString) {
  const dbPath = path.join(__dirname, '../db');
  const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
  let encryptedCount = 0;
  
  for (const file of files) {
    if (!shouldEncryptFile(file)) continue;
    
    const filePath = path.join(dbPath, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      
      // Skip if already encrypted
      if (isEncrypted(raw)) continue;
      
      // Validate it's valid JSON before encrypting
      JSON.parse(raw);
      
      const encrypted = encryptData(raw, keyString);
      fs.writeFileSync(filePath, encrypted);
      encryptedCount++;
    } catch (e) {
      console.error(`Error encrypting ${file}:`, e.message);
    }
  }
  
  return encryptedCount;
}

/**
 * Decrypt all data files with the given key
 */
function decryptAllData(keyString) {
  const dbPath = path.join(__dirname, '../db');
  const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
  let decryptedCount = 0;
  
  for (const file of files) {
    if (!shouldEncryptFile(file)) continue;
    
    const filePath = path.join(dbPath, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      
      if (!isEncrypted(raw)) continue;
      
      const decrypted = decryptData(raw, keyString);
      // Validate decrypted data is valid JSON
      JSON.parse(decrypted);
      
      fs.writeFileSync(filePath, decrypted);
      decryptedCount++;
    } catch (e) {
      console.error(`Error decrypting ${file}:`, e.message);
    }
  }
  
  return decryptedCount;
}

/**
 * Re-encrypt all data with a new key (decrypt with old, encrypt with new)
 */
function reEncryptAllData(oldKey, newKey) {
  const dbPath = path.join(__dirname, '../db');
  const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
  let count = 0;
  
  for (const file of files) {
    if (!shouldEncryptFile(file)) continue;
    
    const filePath = path.join(dbPath, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      let plainText;
      
      if (isEncrypted(raw)) {
        plainText = decryptData(raw, oldKey);
      } else {
        plainText = raw;
      }
      
      // Validate
      JSON.parse(plainText);
      
      const encrypted = encryptData(plainText, newKey);
      fs.writeFileSync(filePath, encrypted);
      count++;
    } catch (e) {
      console.error(`Error re-encrypting ${file}:`, e.message);
    }
  }
  
  return count;
}

module.exports = {
  getEncryptionConfig,
  saveEncryptionConfig,
  encryptData,
  decryptData,
  isEncrypted,
  shouldEncryptFile,
  readJsonDecrypted,
  writeJsonEncrypted,
  encryptAllData,
  decryptAllData,
  reEncryptAllData,
  deriveKey,
  EXCLUDED_FILES
};
