const fs = require('fs');
const path = require('path');

const tachePath = path.join(__dirname, '../db/tache.json');
const rdvPath = path.join(__dirname, '../db/rdv.json');

const DAY_START_MINUTES = 4 * 60;
const DAY_END_MINUTES = 23 * 60 + 59;

const travailleurPath = path.join(__dirname, '../db/travailleur.json');

const readTaches = () => {
  try {
    const data = fs.readFileSync(tachePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const readRdvs = () => {
  try {
    const data = fs.readFileSync(rdvPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const readTravailleurs = () => {
  try {
    const data = fs.readFileSync(travailleurPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeTaches = (items) => {
  fs.writeFileSync(tachePath, JSON.stringify(items, null, 2));
};

const toMinutes = (time = '00:00') => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const toTimeString = (minutes) => {
  const safeMinutes = Math.max(0, Math.min(DAY_END_MINUTES, minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const sortByStartTime = (items) => [...items].sort((a, b) => toMinutes(a.heureDebut) - toMinutes(b.heureDebut));

const isAdmin = (name) => {
  if (!name) return false;
  const travailleurs = readTravailleurs();
  const nameLower = name.trim().toLowerCase();
  return travailleurs.some(t => {
    const fullName = `${t.prenom} ${t.nom}`.trim().toLowerCase();
    const fullNameReverse = `${t.nom} ${t.prenom}`.trim().toLowerCase();
    return (fullName === nameLower || fullNameReverse === nameLower) && t.role === 'administrateur';
  });
};

const getRelatedTaskIds = (taskId, items) => {
  const relatedIds = new Set();
  const stack = [taskId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || relatedIds.has(currentId)) continue;

    relatedIds.add(currentId);
    const currentTask = items.find(item => item.id === currentId);

    if (currentTask?.parentId && !relatedIds.has(currentTask.parentId)) {
      stack.push(currentTask.parentId);
    }

    items
      .filter(item => item.parentId === currentId)
      .forEach(item => {
        if (!relatedIds.has(item.id)) {
          stack.push(item.id);
        }
      });
  }

  return relatedIds;
};

const buildAvailableSlots = (items) => {
  const sortedItems = sortByStartTime(items);
  const slots = [];
  let cursor = DAY_START_MINUTES;

  sortedItems.forEach(item => {
    const start = toMinutes(item.heureDebut);
    const end = toMinutes(item.heureFin || item.heureDebut);

    if (start > cursor) {
      slots.push({
        start: toTimeString(cursor),
        end: toTimeString(start - 1)
      });
    }

    cursor = Math.max(cursor, end + 1);
  });

  if (cursor <= DAY_END_MINUTES) {
    slots.push({
      start: toTimeString(cursor),
      end: toTimeString(DAY_END_MINUTES)
    });
  }

  return slots.filter(slot => toMinutes(slot.start) <= toMinutes(slot.end));
};

/**
 * Validate time slot per person:
 * - For main user (RABEMANALINA): check taches by name+date+time AND rdv by date+time only
 * - For other persons: check taches by name+date+time ONLY
 */
const validateTimeSlot = ({ date, heureDebut, heureFin, excludeId = null, travailleurNom = '' }) => {
  const items = readTaches();
  const startMinutes = toMinutes(heureDebut);
  const endMinutes = toMinutes(heureFin || heureDebut);

  // Filter taches for THIS person only on this date
  const personTaches = sortByStartTime(
    items.filter(item => {
      if (item.id === excludeId) return false;
      if (item.date !== date) return false;
      // Only conflict with same person's tasks
      const itemName = (item.travailleurNom || '').trim().toLowerCase();
      const checkName = (travailleurNom || '').trim().toLowerCase();
      return itemName === checkName;
    })
  );

  // For admin users, also get RDV slots (date+time only, no name filter)
  let rdvSlots = [];
  if (isAdmin(travailleurNom)) {
    const rdvs = readRdvs();
    rdvSlots = rdvs
      .filter(r => r.date === date && r.statut !== 'annule' && r.statut !== 'termine')
      .map(r => ({
        heureDebut: r.heureDebut,
        heureFin: r.heureFin,
        description: r.titre || 'RDV',
        source: 'rdv'
      }));
  }

  // Combine all occupied slots for this person
  const allOccupied = [
    ...personTaches.map(t => ({
      heureDebut: t.heureDebut,
      heureFin: t.heureFin || t.heureDebut,
      description: t.description,
      source: 'tache'
    })),
    ...rdvSlots
  ];

  const sortedOccupied = sortByStartTime(allOccupied);

  if (!date || !heureDebut || !heureFin) {
    return {
      valid: false,
      error: 'Date, heure de début et heure de fin sont requis.',
      availableSlots: buildAvailableSlots(sortedOccupied)
    };
  }

  if (startMinutes < DAY_START_MINUTES || endMinutes > DAY_END_MINUTES) {
    return {
      valid: false,
      error: 'Les tâches doivent être planifiées entre 04:00 et 23:59.',
      availableSlots: buildAvailableSlots(sortedOccupied)
    };
  }

  if (endMinutes < startMinutes + 1) {
    return {
      valid: false,
      error: "L'heure de fin doit être au moins 1 minute après l'heure de début.",
      availableSlots: buildAvailableSlots(sortedOccupied)
    };
  }

  const conflict = sortedOccupied.find(item => {
    const itemStart = toMinutes(item.heureDebut);
    const itemEnd = toMinutes(item.heureFin || item.heureDebut);
    return startMinutes <= itemEnd && endMinutes >= itemStart;
  });

  if (conflict) {
    const sourceLabel = conflict.source === 'rdv' ? 'un rendez-vous' : 'une tâche';
    return {
      valid: false,
      error: `Cet horaire est déjà occupé par ${sourceLabel} : "${conflict.description}" (${conflict.heureDebut} - ${conflict.heureFin}). Choisissez un créneau libre.`,
      conflict,
      availableSlots: buildAvailableSlots(sortedOccupied)
    };
  }

  return {
    valid: true,
    availableSlots: buildAvailableSlots(sortedOccupied)
  };
};

const Tache = {
  getAll: () => readTaches(),

  getByDate: (date) => readTaches().filter(item => item.date === date),

  getByMonth: (year, month) => {
    return readTaches().filter(item => {
      const d = new Date(item.date);
      return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
    });
  },

  getByWeek: (startDate, endDate) => {
    return readTaches().filter(item => item.date >= startDate && item.date <= endDate);
  },

  getById: (id) => {
    return readTaches().find(item => item.id === id) || null;
  },

  isAdmin,
  validateTimeSlot,

  create: (itemData) => {
    try {
      const items = readTaches();
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        heureFin: itemData.heureFin || itemData.heureDebut,
        completed: itemData.completed ?? false,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      writeTaches(items);
      return newItem;
    } catch (error) {
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      let items = readTaches();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      const existing = items[index];

      if (itemData.completed !== undefined && Object.keys(itemData).length === 1) {
        const relatedIds = getRelatedTaskIds(id, items);
        items = items.map(item => (
          relatedIds.has(item.id)
            ? { ...item, completed: itemData.completed }
            : item
        ));
        writeTaches(items);
        return items.find(item => item.id === id) || null;
      }

      if (existing.importance === 'pertinent') {
        items[index] = { ...existing, description: itemData.description || existing.description };
      } else {
        items[index] = {
          ...existing,
          ...itemData,
          heureFin: itemData.heureFin || existing.heureFin
        };
        if (itemData.importance === 'pertinent') {
          items[index].importance = 'pertinent';
        }
      }

      writeTaches(items);
      return items[index];
    } catch (error) {
      return null;
    }
  },

  delete: (id) => {
    try {
      let items = readTaches();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      if (items[index].importance === 'pertinent') return false;
      items.splice(index, 1);
      writeTaches(items);
      return true;
    } catch (error) {
      return false;
    }
  }
};

module.exports = Tache;
