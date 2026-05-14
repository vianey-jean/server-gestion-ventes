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
  // ✅ Exceptions: indispos marquées exception=true ne bloquent jamais
  const indispoForDate = indispos.filter(d => d.date === date && !d.exception);

  if (indispoForDate.length === 0) return { disponible: true };

  const conflicts = indispoForDate.filter(d => {
    if (d.journeeComplete) return true;
    if (!heureDebut || !heureFin) return true;
    return d.heureDebut < heureFin && d.heureFin > heureDebut;
  });

  if (conflicts.length > 0) {
    const c = conflicts[0];
    // Compute alternative slots before/after the indisponibilité (only for partial)
    const suggestions = [];
    const dayStart = '06:00';
    const dayEnd = '22:00';
    if (!c.journeeComplete) {
      // Build occupied ranges for that day
      const occupied = indispoForDate
        .filter(d => !d.journeeComplete)
        .map(d => ({ debut: d.heureDebut, fin: d.heureFin }))
        .sort((a, b) => a.debut.localeCompare(b.debut));
      // Slot before first
      if (occupied[0].debut > dayStart) {
        suggestions.push({ heureDebut: dayStart, heureFin: occupied[0].debut, label: 'avant' });
      }
      // Slot after last
      const last = occupied[occupied.length - 1];
      if (last.fin < dayEnd) {
        suggestions.push({ heureDebut: last.fin, heureFin: dayEnd, label: 'après' });
      }
    }
    const suggestionTxt = suggestions.length > 0
      ? ` 💡 Créneaux possibles: ${suggestions.map(s => `${s.label} (${s.heureDebut} - ${s.heureFin})`).join(' ou ')}`
      : ' 💡 Veuillez choisir un autre jour disponible.';
    const baseMsg = c.journeeComplete
      ? `Journée indisponible${c.motif ? ` (${c.motif})` : ''}`
      : `Créneau indisponible: ${c.heureDebut} - ${c.heureFin}${c.motif ? ` (${c.motif})` : ''}`;
    return {
      disponible: false,
      message: baseMsg + suggestionTxt,
      conflict: c,
      suggestions
    };
  }

  return { disponible: true };
};

module.exports = { checkIndisponibilite, readJson };
