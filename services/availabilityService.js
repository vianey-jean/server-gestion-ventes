/**
 * =============================================================================
 * Service de disponibilité - Vérifie les créneaux indisponibles
 * =============================================================================
 * 
 * Service partagé utilisé par les contrôleurs RDV, Commandes et Tâches
 * pour vérifier la disponibilité des créneaux horaires.
 * 
 * @module services/availabilityService
 */

const fs = require('fs');
const path = require('path');

const indispoPath = path.join(__dirname, '../db/indisponible.json');

/**
 * Lit un fichier JSON de manière sûre
 * @param {string} filePath - Chemin du fichier
 * @returns {Array} Données lues ou tableau vide
 */
const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
};

/**
 * Vérifie si un créneau horaire est disponible (pas d'indisponibilité)
 * @param {string} date - Date au format YYYY-MM-DD
 * @param {string} heureDebut - Heure de début (HH:MM)
 * @param {string} heureFin - Heure de fin (HH:MM)
 * @returns {{ disponible: boolean, message?: string }}
 */
const checkIndisponibilite = (date, heureDebut, heureFin) => {
  const indispos = readJson(indispoPath);
  const indispoForDate = indispos.filter(d => d.date === date);

  if (indispoForDate.length === 0) return { disponible: true };

  const conflicts = indispoForDate.filter(d => {
    if (d.journeeComplete) return true;
    if (!heureDebut || !heureFin) return true;
    return d.heureDebut < heureFin && d.heureFin > heureDebut;
  });

  if (conflicts.length > 0) {
    const c = conflicts[0];
    return {
      disponible: false,
      message: c.journeeComplete
        ? `Journée indisponible${c.motif ? ` (${c.motif})` : ''}`
        : `Créneau indisponible: ${c.heureDebut} - ${c.heureFin}${c.motif ? ` (${c.motif})` : ''}`
    };
  }

  return { disponible: true };
};

module.exports = { checkIndisponibilite, readJson };
