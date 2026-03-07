const fs = require('fs');
const path = require('path');

const notesPath = path.join(__dirname, '..', 'db', 'notes.json');
const columnsPath = path.join(__dirname, '..', 'db', 'noteColumns.json');

const readJSON = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
    const note = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      title: data.title || '',
      content: data.content || '',
      columnId: data.columnId || 'col-1',
      order: data.order || notes.filter(n => n.columnId === (data.columnId || 'col-1')).length,
      color: data.color || '#ffffff',
      bold: data.bold || false,
      boldLines: data.boldLines || [],
      underlineLines: data.underlineLines || [],
      drawing: data.drawing || null,
      voiceText: data.voiceText || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notes.push(note);
    writeJSON(notesPath, notes);
    return note;
  },

  update: (id, data) => {
    const notes = readJSON(notesPath);
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    notes[index] = { ...notes[index], ...data, updatedAt: new Date().toISOString() };
    writeJSON(notesPath, notes);
    return notes[index];
  },

  delete: (id) => {
    let notes = readJSON(notesPath);
    const note = notes.find(n => n.id === id);
    if (!note) return false;
    notes = notes.filter(n => n.id !== id);
    writeJSON(notesPath, notes);
    return true;
  },

  moveToColumn: (id, columnId, order) => {
    const notes = readJSON(notesPath);
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    notes[index].columnId = columnId;
    notes[index].order = order;
    notes[index].updatedAt = new Date().toISOString();
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
    // Move notes from deleted column to first column
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
