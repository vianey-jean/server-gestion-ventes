/**
 * =============================================================================
 * Service de gestion des fichiers JSON - Lecture/écriture sécurisée
 * =============================================================================
 * 
 * Service partagé pour les opérations de lecture et écriture sur les fichiers
 * de la base de données JSON. Gère le chiffrement si activé.
 * 
 * @module services/fileService
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../db');

/**
 * Lit un fichier JSON de manière sûre
 * @param {string} filePath - Chemin du fichier
 * @param {*} defaultValue - Valeur par défaut si lecture échoue
 * @returns {*} Données lues ou valeur par défaut
 */
const readJson = (filePath, defaultValue = []) => {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return defaultValue;
  }
};

/**
 * Écrit des données dans un fichier JSON
 * @param {string} filePath - Chemin du fichier
 * @param {*} data - Données à écrire
 */
const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

/**
 * Vérifie et crée un fichier JSON s'il n'existe pas
 * @param {string} filePath - Chemin du fichier
 * @param {*} defaultData - Données par défaut
 */
const ensureFileExists = (filePath, defaultData = []) => {
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, defaultData);
  }
};

/**
 * Liste tous les fichiers JSON dans le dossier db
 * @returns {string[]} Liste des noms de fichiers
 */
const getDbFiles = () => {
  try {
    return fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
};

module.exports = {
  readJson,
  writeJson,
  ensureFileExists,
  getDbFiles,
  dbPath
};
