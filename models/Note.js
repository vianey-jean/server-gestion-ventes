const fs = require('fs');
const path = require('path');

const notesPath = path.join(__dirname, '..', 'db', 'notes.json');
const columnsPath = path.join(__dirname, '..', 'db', 'noteColumns.json');
const uploadsRoot = path.join(__dirname, '..');

const readJSON = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Safely delete a file stored under /uploads/... (relative URL from DB)
const deleteFileByUrl = (urlPath) => {
  try {
    if (!urlPath || typeof urlPath !== 'string') return;
    if (!urlPath.startsWith('/uploads/')) return;
    const safe = path.normalize(urlPath).replace(/^[\\/]+/, '');
    const full = path.join(uploadsRoot, safe);
    // Ensure we stay inside uploads directory
    if (!full.startsWith(path.join(uploadsRoot, 'uploads'))) return;
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    console.warn('deleteFileByUrl error:', e.message);
  }
};

// Normalize fichiers to an array (backward compat with single fichier)
const normalizeFichiers = (data) => {
  const arr = Array.isArray(data.fichiers) ? [...data.fichiers] : [];
  if (data.fichier && data.fichier.url && !arr.find(f => f && f.url === data.fichier.url)) {
    arr.unshift(data.fichier);
  }
  return arr.filter(Boolean);
};

const Note = {
  // Notes CRUD
  getAll: () => readJSON(notesPath),

  getById: (id) => {
    const notes = readJSON(notesPath);
    return notes.find(n => n.id === id) || null;
  },

  create: (data) => {
    const notes = readJSON(notesPath);
    const columns = readJSON(columnsPath);
    const colId = data.columnId || 'col-1';
    const col = columns.find(c => c.id === colId);
    const now = new Date().toISOString();
    const fichiers = Array.isArray(data.fichiers) ? data.fichiers.filter(Boolean) : [];
    // Backward compat: if a single fichier is provided, merge it in
    if (data.fichier && data.fichier.url && !fichiers.find(f => f.url === data.fichier.url)) {
      fichiers.unshift(data.fichier);
    }
    const note = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      title: data.title || '',
      content: data.content || '',
      columnId: colId,
      order: data.order || notes.filter(n => n.columnId === colId).length,
      color: data.color || '#ffffff',
      bold: data.bold || false,
      boldLines: data.boldLines || [],
      underlineLines: data.underlineLines || [],
      drawing: data.drawing || null,
      voiceText: data.voiceText || '',
      fichier: null, // legacy field, no longer used as primary storage
      fichiers,
      history: [{ columnId: colId, columnTitle: col ? col.title : colId, movedAt: now }],
      createdAt: now,
      updatedAt: now
    };
    notes.push(note);
    writeJSON(notesPath, notes);
    return note;
  },

  update: (id, data) => {
    const notes = readJSON(notesPath);
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    const old = notes[index];

    // Build new fichiers list (merging any legacy single fichier provided)
    let newFichiers;
    if (Array.isArray(data.fichiers)) {
      newFichiers = data.fichiers.filter(Boolean);
    } else if (Array.isArray(old.fichiers)) {
      newFichiers = [...old.fichiers];
    } else {
      newFichiers = [];
    }
    // If client still posts single 'fichier' as the new full state, merge it
    if (data.fichier !== undefined) {
      if (data.fichier && data.fichier.url && !newFichiers.find(f => f && f.url === data.fichier.url)) {
        newFichiers.unshift(data.fichier);
      }
    }

    // Compute removed files (old fichiers + legacy old.fichier) that are not in newFichiers
    const oldFichiers = Array.isArray(old.fichiers) ? [...old.fichiers] : [];
    if (old.fichier && old.fichier.url && !oldFichiers.find(f => f && f.url === old.fichier.url)) {
      oldFichiers.unshift(old.fichier);
    }
    const newUrls = new Set(newFichiers.map(f => f.url));
    oldFichiers.forEach(f => {
      if (f && f.url && !newUrls.has(f.url)) deleteFileByUrl(f.url);
    });

    // Handle drawing removal
    const newDrawing = data.drawing !== undefined ? data.drawing : old.drawing;
    if (old.drawing && old.drawing !== newDrawing) {
      deleteFileByUrl(old.drawing);
    }

    notes[index] = {
      ...old,
      ...data,
      fichier: null,
      fichiers: newFichiers,
      drawing: newDrawing,
      updatedAt: new Date().toISOString()
    };
    writeJSON(notesPath, notes);
    return notes[index];
  },

  delete: (id) => {
    let notes = readJSON(notesPath);
    const note = notes.find(n => n.id === id);
    if (!note) return false;
    // Delete attached files from disk
    if (note.drawing) deleteFileByUrl(note.drawing);
    if (note.fichier && note.fichier.url) deleteFileByUrl(note.fichier.url);
    if (Array.isArray(note.fichiers)) {
      note.fichiers.forEach(f => f && f.url && deleteFileByUrl(f.url));
    }
    notes = notes.filter(n => n.id !== id);
    writeJSON(notesPath, notes);
    return true;
  },

  moveToColumn: (id, columnId, order) => {
    const notes = readJSON(notesPath);
    const columns = readJSON(columnsPath);
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    const col = columns.find(c => c.id === columnId);
    const now = new Date().toISOString();
    notes[index].columnId = columnId;
    notes[index].order = order;
    notes[index].updatedAt = now;
    if (!notes[index].history) notes[index].history = [];
    notes[index].history.push({ columnId, columnTitle: col ? col.title : columnId, movedAt: now });
    writeJSON(notesPath, notes);
    return notes[index];
  },

  reorder: (updates) => {
    const notes = readJSON(notesPath);
    updates.forEach(({ id, columnId, order }) => {
      const note = notes.find(n => n.id === id);
      if (note) {
        note.columnId = columnId;
        note.order = order;
        note.updatedAt = new Date().toISOString();
      }
    });
    writeJSON(notesPath, notes);
    return notes;
  },

  // Columns CRUD
  getColumns: () => readJSON(columnsPath),

  createColumn: (data) => {
    const columns = readJSON(columnsPath);
    const column = {
      id: 'col-' + Date.now(),
      title: data.title || 'Nouvelle colonne',
      color: data.color || '#6b7280',
      order: columns.length
    };
    columns.push(column);
    writeJSON(columnsPath, columns);
    return column;
  },

  updateColumn: (id, data) => {
    const columns = readJSON(columnsPath);
    const index = columns.findIndex(c => c.id === id);
    if (index === -1) return null;
    columns[index] = { ...columns[index], ...data };
    writeJSON(columnsPath, columns);
    return columns[index];
  },

  deleteColumn: (id) => {
    let columns = readJSON(columnsPath);
    columns = columns.filter(c => c.id !== id);
    writeJSON(columnsPath, columns);
    const notes = readJSON(notesPath);
    const firstCol = columns[0];
    if (firstCol) {
      notes.forEach(n => {
        if (n.columnId === id) n.columnId = firstCol.id;
      });
      writeJSON(notesPath, notes);
    }
    return true;
  }
};

module.exports = Note;
