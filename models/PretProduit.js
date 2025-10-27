
const fs = require('fs');
const path = require('path');

const pretProduitsPath = path.join(__dirname, '../db/pretproduits.json');

// Fonction pour lire tous les prêts produits
const getAllPretProduits = () => {
  try {
    if (!fs.existsSync(pretProduitsPath)) {
      return [];
    }
    const data = fs.readFileSync(pretProduitsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture des prêts produits:', error);
    return [];
  }
};

// Fonction pour obtenir un prêt produit par ID
const getPretProduitById = (id) => {
  const pretProduits = getAllPretProduits();
  return pretProduits.find(pretProduit => pretProduit.id === id);
};

// Fonction pour créer un nouveau prêt produit
const createPretProduit = (pretProduit) => {
  try {
    const pretProduits = getAllPretProduits();
    
    // Générer un nouvel ID
    const newId = pretProduits.length > 0 
      ? (Math.max(...pretProduits.map(p => parseInt(p.id))) + 1).toString() 
      : '1';
    
    const newPretProduit = {
      id: newId,
      ...pretProduit
    };
    
    pretProduits.push(newPretProduit);
    fs.writeFileSync(pretProduitsPath, JSON.stringify(pretProduits, null, 2));
    
    return newPretProduit;
  } catch (error) {
    console.error('Erreur lors de la création d\'un prêt produit:', error);
    throw error;
  }
};

// Fonction pour mettre à jour un prêt produit
const updatePretProduit = (id, updatedPretProduit) => {
  try {
    let pretProduits = getAllPretProduits();
    const index = pretProduits.findIndex(pretProduit => pretProduit.id === id);
    
    if (index === -1) {
      throw new Error('Prêt produit non trouvé');
    }
    
    pretProduits[index] = {
      ...pretProduits[index],
      ...updatedPretProduit,
      id // S'assurer que l'ID reste inchangé
    };
    
    fs.writeFileSync(pretProduitsPath, JSON.stringify(pretProduits, null, 2));
    
    return pretProduits[index];
  } catch (error) {
    console.error('Erreur lors de la mise à jour d\'un prêt produit:', error);
    throw error;
  }
};

// Fonction pour supprimer un prêt produit
const deletePretProduit = (id) => {
  try {
    let pretProduits = getAllPretProduits();
    const index = pretProduits.findIndex(pretProduit => pretProduit.id === id);
    
    if (index === -1) {
      throw new Error('Prêt produit non trouvé');
    }
    
    pretProduits.splice(index, 1);
    fs.writeFileSync(pretProduitsPath, JSON.stringify(pretProduits, null, 2));
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression d\'un prêt produit:', error);
    throw error;
  }
};

// Fonction pour transférer des prêts d'une personne vers une autre
const transferPrets = (fromName, toName, pretIds) => {
  try {
    let pretProduits = getAllPretProduits();
    
    // Trouver les prêts à transférer
    const pretsToTransfer = pretProduits.filter(pret => 
      pretIds.includes(pret.id) && pret.nom === fromName
    );
    
    if (pretsToTransfer.length === 0) {
      throw new Error('Aucun prêt trouvé pour le transfert');
    }
    
    // Mettre à jour le nom et le téléphone pour tous les prêts transférés
    // On prend le téléphone du premier prêt de la personne cible si elle existe
    const targetPret = pretProduits.find(pret => pret.nom === toName);
    const targetPhone = targetPret ? targetPret.phone : '';
    
    pretProduits = pretProduits.map(pret => {
      if (pretIds.includes(pret.id) && pret.nom === fromName) {
        return {
          ...pret,
          nom: toName,
          phone: targetPhone || pret.phone
        };
      }
      return pret;
    });
    
    fs.writeFileSync(pretProduitsPath, JSON.stringify(pretProduits, null, 2));
    
    return pretsToTransfer.length;
  } catch (error) {
    console.error('Erreur lors du transfert des prêts produits:', error);
    throw error;
  }
};

module.exports = {
  getAllPretProduits,
  getPretProduitById,
  createPretProduit,
  updatePretProduit,
  deletePretProduit,
  transferPrets
};
