/**
 * =============================================================================
 * Contrôleur Bénéfices - Logique métier des calculs de bénéfices
 * =============================================================================
 * @module controllers/beneficeController
 */

const Benefice = require('../models/Benefice');

exports.getAll = async (req, res) => {
  try { res.json(await Benefice.getAll()); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.getByProductId = async (req, res) => {
  try {
    const benefice = await Benefice.getByProductId(req.params.productId);
    if (!benefice) return res.status(404).json({ message: 'Bénéfice non trouvé' });
    res.json(benefice);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.create = async (req, res) => {
  try {
    const { productId, productDescription, prixAchat } = req.body;
    if (!productId || !productDescription || prixAchat === undefined) {
      return res.status(400).json({ message: 'ProductId, productDescription and prixAchat are required' });
    }
    const data = {
      productId, productDescription,
      prixAchat: Number(prixAchat), taxeDouane: Number(req.body.taxeDouane || 0),
      tva: Number(req.body.tva || 20), autresFrais: Number(req.body.autresFrais || 0),
      coutTotal: Number(req.body.coutTotal), margeDesire: Number(req.body.margeDesire || 30),
      prixVenteRecommande: Number(req.body.prixVenteRecommande),
      beneficeNet: Number(req.body.beneficeNet), tauxMarge: Number(req.body.tauxMarge)
    };
    const newBenefice = await Benefice.create(data);
    if (!newBenefice) return res.status(500).json({ message: 'Error creating benefit calculation' });
    res.status(201).json(newBenefice);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  try {
    const data = {
      productId: req.body.productId, productDescription: req.body.productDescription,
      prixAchat: Number(req.body.prixAchat), taxeDouane: Number(req.body.taxeDouane || 0),
      tva: Number(req.body.tva || 20), autresFrais: Number(req.body.autresFrais || 0),
      coutTotal: Number(req.body.coutTotal), margeDesire: Number(req.body.margeDesire || 30),
      prixVenteRecommande: Number(req.body.prixVenteRecommande),
      beneficeNet: Number(req.body.beneficeNet), tauxMarge: Number(req.body.tauxMarge)
    };
    const updated = await Benefice.update(req.params.id, data);
    if (!updated) return res.status(404).json({ message: 'Benefit calculation not found' });
    res.json(updated);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.delete = async (req, res) => {
  try {
    const success = await Benefice.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Benefit calculation not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
