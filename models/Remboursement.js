const fs = require('fs');
const path = require('path');

const remboursementPath = path.join(__dirname, '../db/remboursement.json');

const Remboursement = {
  getAll: () => {
    try {
      const data = fs.readFileSync(remboursementPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error("Error reading remboursements:", error);
      return [];
    }
  },

  getByMonthYear: (month, year) => {
    try {
      const data = fs.readFileSync(remboursementPath, 'utf8');
      const remboursements = JSON.parse(data);
      return remboursements.filter(r => {
        const d = new Date(r.date);
        return (d.getMonth() + 1) === Number(month) && d.getFullYear() === Number(year);
      });
    } catch (error) {
      console.error("Error filtering remboursements:", error);
      return [];
    }
  },

  create: (data) => {
    try {
      const remboursements = JSON.parse(fs.readFileSync(remboursementPath, 'utf8'));
      const newRemboursement = {
        id: Date.now().toString(),
        ...data,
        createdAt: new Date().toISOString()
      };
      remboursements.push(newRemboursement);
      fs.writeFileSync(remboursementPath, JSON.stringify(remboursements, null, 2));
      return newRemboursement;
    } catch (error) {
      console.error("Error creating remboursement:", error);
      return null;
    }
  },

  delete: (id) => {
    try {
      let remboursements = JSON.parse(fs.readFileSync(remboursementPath, 'utf8'));
      const index = remboursements.findIndex(r => r.id === id);
      if (index === -1) return false;
      remboursements.splice(index, 1);
      fs.writeFileSync(remboursementPath, JSON.stringify(remboursements, null, 2));
      return true;
    } catch (error) {
      console.error("Error deleting remboursement:", error);
      return false;
    }
  }
};

module.exports = Remboursement;
