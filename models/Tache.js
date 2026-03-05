const fs = require('fs');
const path = require('path');

const tachePath = path.join(__dirname, '../db/tache.json');

const DAY_START_MINUTES = 4 * 60;
const DAY_END_MINUTES = 23 * 60 + 59;

const readTaches = () => {
  try {
    const data = fs.readFileSync(tachePath, 'utf8');
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

const validateTimeSlot = ({ date, heureDebut, heureFin, excludeId = null }) => {
  const items = readTaches();
  const startMinutes = toMinutes(heureDebut);
  const endMinutes = toMinutes(heureFin || heureDebut);
  const sameDayItems = sortByStartTime(
    items.filter(item => item.date === date && item.id !== excludeId)
  );

  if (!date || !heureDebut || !heureFin) {
    return {
      valid: false,
      error: 'Date, heure de début et heure de fin sont requis.',
      availableSlots: buildAvailableSlots(sameDayItems)
    };
  }

  if (startMinutes < DAY_START_MINUTES || endMinutes > DAY_END_MINUTES) {
    return {
      valid: false,
      error: 'Les tâches doivent être planifiées entre 04:00 et 23:59.',
      availableSlots: buildAvailableSlots(sameDayItems)
    };
  }

  if (endMinutes < startMinutes + 1) {
    return {
      valid: false,
      error: "L'heure de fin doit être au moins 1 minute après l'heure de début.",
      availableSlots: buildAvailableSlots(sameDayItems)
    };
  }

  const conflict = sameDayItems.find(item => {
    const itemStart = toMinutes(item.heureDebut);
    const itemEnd = toMinutes(item.heureFin || item.heureDebut);
    return startMinutes <= itemEnd && endMinutes >= itemStart;
  });

  if (conflict) {
    return {
      valid: false,
      error: `Cet horaire est déjà occupé par "${conflict.description}" (${conflict.heureDebut} - ${conflict.heureFin}). Choisissez un créneau libre, idéalement au moins 30 minutes avant ou après.`,
      conflict,
      availableSlots: buildAvailableSlots(sameDayItems)
    };
  }

  return {
    valid: true,
    availableSlots: buildAvailableSlots(sameDayItems)
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
      console.error('Error creating tache:', error);
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
      console.error('Error updating tache:', error);
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
      console.error('Error deleting tache:', error);
      return false;
    }
  }
};

module.exports = Tache;