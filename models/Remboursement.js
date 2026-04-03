const fs = require('fs');
const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const remboursementPath = path.join(__dirname, '../db/remboursement.json');

const Remboursement = {
  getAll: () => {
    try {
      return readJsonDecrypted(remboursementPath) || [];
    } catch (error) {
      console.error("Error reading remboursements:", error);
      return [];
    }
  },

  getByMonthYear: (month, year) => {
    try {
      const remboursements = readJsonDecrypted(remboursementPath) || [];
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
      const remboursements = readJsonDecrypted(remboursementPath) || [];
      const newRemboursement = {
        id: Date.now().toString(),
        ...data,
        createdAt: new Date().toISOString()
      };
      remboursements.push(newRemboursement);
      writeJsonEncrypted(remboursementPath, remboursements);
      return newRemboursement;
    } catch (error) {
      console.error("Error creating remboursement:", error);
      return null;
    }
  },

  delete: (id) => {
    try {
      let remboursements = readJsonDecrypted(remboursementPath) || [];
      const index = remboursements.findIndex(r => r.id === id);
      if (index === -1) return false;
      remboursements.splice(index, 1);
      writeJsonEncrypted(remboursementPath, remboursements);
      return true;
    } catch (error) {
      console.error("Error deleting remboursement:", error);
      return false;
    }
  }
};

module.exports = Remboursement;
