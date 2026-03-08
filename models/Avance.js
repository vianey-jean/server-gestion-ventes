const fs = require('fs');
const path = require('path');

const avancePath = path.join(__dirname, '..', 'db', 'avance.json');

const readJSON = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const Avance = {
  getAll: () => readJSON(avancePath),

  getByTravailleur: (travailleurId, month, year) => {
    const avances = readJSON(avancePath);
    return avances.filter(a => {
      const d = new Date(a.date);
      return a.travailleurId === travailleurId &&
        (d.getMonth() + 1) === month &&
        d.getFullYear() === year;
    });
  },

  create: (data) => {
    const avances = readJSON(avancePath);
    const avance = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      travailleurId: data.travailleurId,
      travailleurNom: data.travailleurNom || '',
      entrepriseId: data.entrepriseId || '',
      entrepriseNom: data.entrepriseNom || '',
      montant: data.montant || 0,
      totalPointage: data.totalPointage || 0,
      resteApresAvance: data.resteApresAvance || 0,
      date: data.date || new Date().toISOString(),
      mois: data.mois || new Date().getMonth() + 1,
      annee: data.annee || new Date().getFullYear(),
      createdAt: new Date().toISOString()
    };
    avances.push(avance);
    writeJSON(avancePath, avances);
    return avance;
  },

  delete: (id) => {
    let avances = readJSON(avancePath);
    avances = avances.filter(a => a.id !== id);
    writeJSON(avancePath, avances);
    return true;
  }
};

module.exports = Avance;
