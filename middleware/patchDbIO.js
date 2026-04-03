/**
 * patchDbIO — Monkey-patches fs.readFileSync and fs.writeFileSync
 * to transparently encrypt/decrypt JSON files in the server/db/ directory.
 * 
 * This must be required ONCE at server startup, BEFORE any models are loaded.
 * It ensures ALL existing models automatically get encryption support
 * without modifying each model file individually.
 */

const fs = require('fs');
const path = require('path');
const {
  getEncryptionConfig,
  shouldEncryptFile,
  isEncrypted,
  encryptData,
  decryptData
} = require('./encryption');

const dbDir = path.resolve(path.join(__dirname, '../db'));

// Store original functions
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;

// Patch readFileSync
// NOTE: readJsonDecrypted in encryption.js handles its own decryption.
// This patch handles models that use fs.readFileSync/writeFileSync directly
// (not through readJsonDecrypted/writeJsonEncrypted).
fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
  const result = originalReadFileSync.call(fs, filePath, ...args);
  
  try {
    const resolved = path.resolve(filePath.toString());
    const filename = path.basename(resolved);
    
    // Only process .json files in the db directory
    if (resolved.startsWith(dbDir) && filename.endsWith('.json') && shouldEncryptFile(filename)) {
      const strResult = typeof result === 'string' ? result : result.toString('utf8');
      
      if (isEncrypted(strResult)) {
        const config = getEncryptionConfig();
        if (config.enabled && config.key) {
          try {
            const decrypted = decryptData(strResult, config.key);
            // Validate decrypted data is valid JSON
            JSON.parse(decrypted);
            if (args[0] === 'utf8' || args[0] === 'utf-8' || (args[0] && args[0].encoding === 'utf8')) {
              return decrypted;
            }
            return Buffer.from(decrypted, 'utf8');
          } catch (e) {
            // Decryption or parse failed, return original
          }
        }
      }
    }
  } catch (e) {
    // If any error in decryption logic, return original result
  }
  
  return result;
};

// Patch writeFileSync
fs.writeFileSync = function patchedWriteFileSync(filePath, data, ...args) {
  try {
    const resolved = path.resolve(filePath.toString());
    const filename = path.basename(resolved);
    
    // Only process .json files in the db directory
    if (resolved.startsWith(dbDir) && filename.endsWith('.json') && shouldEncryptFile(filename)) {
      const config = getEncryptionConfig();
      if (config.enabled && config.key) {
        const strData = typeof data === 'string' ? data : data.toString('utf8');
        
        // Don't double-encrypt
        if (!isEncrypted(strData)) {
          // Validate it's valid JSON before encrypting
          try {
            JSON.parse(strData);
            const encrypted = encryptData(strData, config.key);
            return originalWriteFileSync.call(fs, filePath, encrypted, ...args);
          } catch (e) {
            // Not valid JSON, write as-is
          }
        }
      }
    }
  } catch (e) {
    // If any error in encryption logic, write original data
  }
  
  return originalWriteFileSync.call(fs, filePath, data, ...args);
};

// Also patch fs.promises for async models (like Commande.js)
const originalReadFile = fs.promises.readFile;
const originalWriteFile = fs.promises.writeFile;

fs.promises.readFile = async function patchedReadFile(filePath, ...args) {
  const result = await originalReadFile.call(fs.promises, filePath, ...args);
  
  try {
    const resolved = path.resolve(filePath.toString());
    const filename = path.basename(resolved);
    
    if (resolved.startsWith(dbDir) && filename.endsWith('.json') && shouldEncryptFile(filename)) {
      const strResult = typeof result === 'string' ? result : result.toString('utf8');
      
      if (isEncrypted(strResult)) {
        const config = getEncryptionConfig();
        if (config.enabled && config.key) {
          const decrypted = decryptData(strResult, config.key);
          if (args[0] === 'utf8' || args[0] === 'utf-8' || (args[0] && args[0].encoding === 'utf8')) {
            return decrypted;
          }
          return Buffer.from(decrypted, 'utf8');
        }
      }
    }
  } catch (e) {
    // Return original result on error
  }
  
  return result;
};

fs.promises.writeFile = async function patchedWriteFile(filePath, data, ...args) {
  try {
    const resolved = path.resolve(filePath.toString());
    const filename = path.basename(resolved);
    
    if (resolved.startsWith(dbDir) && filename.endsWith('.json') && shouldEncryptFile(filename)) {
      const config = getEncryptionConfig();
      if (config.enabled && config.key) {
        const strData = typeof data === 'string' ? data : data.toString('utf8');
        
        if (!isEncrypted(strData)) {
          try {
            JSON.parse(strData);
            const encrypted = encryptData(strData, config.key);
            return originalWriteFile.call(fs.promises, filePath, encrypted, ...args);
          } catch (e) {
            // Not valid JSON, write as-is
          }
        }
      }
    }
  } catch (e) {
    // Write original data on error
  }
  
  return originalWriteFile.call(fs.promises, filePath, data, ...args);
};

console.log('🔐 Database I/O patching active — encryption will be applied transparently');

module.exports = {};
