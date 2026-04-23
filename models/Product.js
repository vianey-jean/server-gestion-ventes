
const fs = require('fs');
const path = require('path');

const productsPath = path.join(__dirname, '../db/products.json');

// ============================================
// CARACTERISTIQUE : extraction + obfuscation du code-barre
// ============================================

/**
 * Extrait le "numero" (taille) à partir d'une description.
 * Ex: "Perruque 26 pouces" -> "26"
 * Renvoie "" si rien de pertinent trouvé.
 */
const extractNumeroFromDescription = (description = '') => {
  if (!description) return '';
  const re = /(\d{1,3})\s*("|''|pouces?|inch(?:es)?|po\b)/i;
  const m = description.match(re);
  if (m) return m[1];
  const m2 = description.match(/\b(\d{1,2})\b/);
  if (m2) {
    const n = parseInt(m2[1], 10);
    if (n >= 6 && n <= 40) return m2[1];
  }
  return '';
};

/**
 * Génère une valeur brute de code-barre (ex: "223fsdq231321") :
 * 6 chiffres + 6 caractères alphanum + 1 chiffre.
 */
const generateBarcodeRaw = () => {
  const digits = '0123456789';
  const alphanum = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let part1 = '';
  for (let i = 0; i < 3; i++) part1 += digits.charAt(Math.floor(Math.random() * digits.length));
  let part2 = '';
  for (let i = 0; i < 6; i++) part2 += alphanum.charAt(Math.floor(Math.random() * alphanum.length));
  let part3 = '';
  for (let i = 0; i < 6; i++) part3 += digits.charAt(Math.floor(Math.random() * digits.length));
  return `${part1}${part2}${part3}`;
};

/**
 * Obfusque le code-barre : on le découpe en segments avec un sel et un checksum.
 * Forme stockée : { v: 1, s: salt, p: [seg1, seg2, seg3, seg4], c: checksum }
 * Seul le frontend qui connaît le format peut recomposer la valeur réelle.
 */
const encodeBarcode = (raw) => {
  const salt = Math.random().toString(36).slice(2, 8);
  // Découper en 4 segments quasi égaux
  const len = raw.length;
  const cuts = [
    Math.floor(len * 0.25),
    Math.floor(len * 0.50),
    Math.floor(len * 0.75),
  ];
  const segs = [
    raw.slice(0, cuts[0]),
    raw.slice(cuts[0], cuts[1]),
    raw.slice(cuts[1], cuts[2]),
    raw.slice(cuts[2]),
  ];
  // Encoder chaque segment en base64 préfixé par 1 char du sel (rotation simple)
  const parts = segs.map((seg, i) => {
    const tag = salt.charAt(i % salt.length);
    return tag + Buffer.from(seg, 'utf8').toString('base64').replace(/=+$/, '');
  });
  // Checksum = somme des codes ASCII modulo 9973
  let sum = 0;
  for (let i = 0; i < raw.length; i++) sum = (sum + raw.charCodeAt(i) * (i + 1)) % 9973;
  return { v: 1, s: salt, p: parts, c: sum };
};

/**
 * Construit l'objet caracteristique pour un produit.
 */
const buildCaracteristique = (product) => {
  const nom = product.description || '';
  const numero = extractNumeroFromDescription(nom);
  const raw = generateBarcodeRaw();
  return {
    nom,
    numero,
    codeBarre: encodeBarcode(raw),
    code: product.code || '',
  };
};

// ============================================
// FONCTION DE GÉNÉRATION DE CODE UNIQUE
// ============================================
/**
 * Génère un code unique de 7 caractères pour un produit
 * - Commence par P si c'est une perruque, T si tissage, X sinon
 * - Inclut les chiffres trouvés dans la description (ex: 20 pouces → 20)
 * - Complète avec des lettres majuscules aléatoires
 * @param {string} description - Description du produit
 * @param {string[]} existingCodes - Codes déjà utilisés pour éviter les doublons
 * @returns {string} Code unique de 7 caractères
 */
const generateProductCode = (description, existingCodes = []) => {
  const descLower = description.toLowerCase();
  
  // Déterminer la première lettre selon le type de produit
  let firstChar = 'X';

if (descLower.includes('perruque')) {
  firstChar = 'P';
} else if (descLower.includes('tissage')) {
  firstChar = 'T';
} else if (descLower.includes('extension')) {
  firstChar = 'E';
}

  
  // Extraire les chiffres de la description (ex: "20 pouces" → "20")
  const numbers = description.match(/\d+/g);
  let numberPart = '';
  if (numbers && numbers.length > 0) {
    // Prendre le premier nombre trouvé (généralement la taille en pouces)
    numberPart = numbers[0].substring(0, 2); // Max 2 chiffres
  }
  
  // Lettres pour compléter le code
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  // Générer un code unique
  let code = '';
  let attempts = 0;
  const maxAttempts = 100;
  
 do {
  // Partie 1 : lettre initiale (P, T, E ou X)
  const part1 = firstChar;

  // Partie 2 : nombre ou "XC" si vide
  const part2 = numberPart && numberPart.length > 0 ? numberPart : "XC";

  // Partie 3 : 6 lettres aléatoires
  let part3 = "";
  while (part3.length < 6) {
    part3 += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  // Assemblage du code final
  code = `${part1}-${part2}-${part3}`;

  attempts++;
} while (existingCodes.includes(code) && attempts < maxAttempts);
  
  return code;
};

/**
 * Récupère tous les codes existants des produits
 * @returns {string[]} Liste des codes existants
 */
const getAllExistingCodes = () => {
  try {
    const data = fs.readFileSync(productsPath, 'utf8');
    const products = JSON.parse(data);
    return products.filter(p => p.code).map(p => p.code);
  } catch (error) {
    return [];
  }
};

const Product = {
  // Get all products
  getAll: () => {
    try {
      const data = fs.readFileSync(productsPath, 'utf8');
      const products = JSON.parse(data);
      // Guard: always return an array even if file contains an object
      if (!Array.isArray(products)) {
        console.warn('⚠️ products.json contains non-array data, returning empty array');
        return [];
      }
      console.log(`📦 Retrieved ${products.length} products from database`);
      return products;
    } catch (error) {
      console.error("❌ Error reading products:", error);
      return [];
    }
  },

  // Get product by ID
  getById: (id) => {
    try {
      const data = fs.readFileSync(productsPath, 'utf8');
      const products = JSON.parse(data);
      const product = products.find(product => product.id === id) || null;
      console.log(`🔍 Retrieved product by ID ${id}:`, product ? 'Found' : 'Not found');
      return product;
    } catch (error) {
      console.error("❌ Error finding product by id:", error);
      return null;
    }
  },

  // Search products by description
  search: (query) => {
    try {
      const data = fs.readFileSync(productsPath, 'utf8');
      const products = JSON.parse(data);
      if (!query || query.length < 3) return [];
      
      const results = products.filter(product => 
        product.description.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log(`🔍 Search query "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error("❌ Error searching products:", error);
      return [];
    }
  },

  // Create new product
  create: (productData) => {
    try {
      console.log('📝 Creating new product:', productData);
      
      const data = fs.readFileSync(productsPath, 'utf8');
      const products = JSON.parse(data);
      
      // Récupérer les codes existants pour éviter les doublons
      const existingCodes = products.filter(p => p.code).map(p => p.code);
      
      // Générer un code unique pour le nouveau produit
      const uniqueCode = generateProductCode(productData.description || '', existingCodes);
      
      // Create new product object with unique code
      const newProduct = {
        id: Date.now().toString(),
        code: uniqueCode,
        ...productData
      };

      // Construire la caractéristique (nom, numero, codeBarre obfusqué, code)
      // Si productData fournit déjà une caractéristique partielle, on la fusionne.
      const baseCarac = buildCaracteristique(newProduct);
      newProduct.caracteristique = {
        ...baseCarac,
        ...(productData.caracteristique || {}),
        nom: (productData.caracteristique && productData.caracteristique.nom) || baseCarac.nom,
        code: newProduct.code,
      };

      // Add to products array
      products.push(newProduct);
      
      // Write back to file with proper formatting
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      console.log('✅ Product created successfully with code:', newProduct.code, newProduct);
      console.log(`📊 Total products in database: ${products.length}`);
      
      return newProduct;
    } catch (error) {
      console.error("❌ Error creating product:", error);
      return null;
    }
  },

  // Update product
  update: (id, productData) => {
    try {
      console.log(`📝 Updating product ${id}:`, productData);
      
      const data = fs.readFileSync(productsPath, 'utf8');
      let products = JSON.parse(data);
      
      // Find product index
      const productIndex = products.findIndex(product => product.id === id);
      if (productIndex === -1) {
        console.log(`❌ Product not found for update: ${id}`);
        return null;
      }

      // Update product data
      const merged = { ...products[productIndex], ...productData };

      // Si pas encore de caractéristique, la créer maintenant
      if (!merged.caracteristique || typeof merged.caracteristique !== 'object') {
        merged.caracteristique = buildCaracteristique(merged);
      } else {
        // Si la description ou le code change, on met à jour nom + code de la caractéristique
        // mais on conserve le code-barre déjà généré (immuable).
        if (productData.description !== undefined) {
          merged.caracteristique.nom = productData.description;
          merged.caracteristique.numero = extractNumeroFromDescription(productData.description);
        }
        if (merged.code) {
          merged.caracteristique.code = merged.code;
        }
      }

      products[productIndex] = merged;
      
      // Write back to file with proper formatting
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      console.log('✅ Product updated successfully:', products[productIndex]);
      return products[productIndex];
    } catch (error) {
      console.error("❌ Error updating product:", error);
      return null;
    }
  },

  // Delete product and its photos from disk
  delete: (id) => {
    try {
      console.log(`🗑️ Deleting product ${id}`);
      
      const data = fs.readFileSync(productsPath, 'utf8');
      let products = JSON.parse(data);
      
      // Find product index
      const productIndex = products.findIndex(product => product.id === id);
      if (productIndex === -1) {
        console.log(`❌ Product not found for deletion: ${id}`);
        return false;
      }
      
      // Store product info for logging
      const deletedProduct = products[productIndex];
      
      // Delete all photo files from disk
      const photos = deletedProduct.photos || [];
      if (deletedProduct.mainPhoto && !photos.includes(deletedProduct.mainPhoto)) {
        photos.push(deletedProduct.mainPhoto);
      }
      photos.forEach(photoUrl => {
        try {
          const filename = photoUrl.replace('/uploads/', '');
          const filePath = path.join(__dirname, '../uploads', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted photo file: ${filename}`);
          }
        } catch (e) {
          console.warn(`⚠️ Could not delete photo file: ${photoUrl}`, e.message);
        }
      });
      
      // Remove product from array
      products.splice(productIndex, 1);
      
      // Write back to file with proper formatting
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      console.log('✅ Product deleted successfully:', deletedProduct.description);
      console.log(`📊 Remaining products in database: ${products.length}`);
      
      return true;
    } catch (error) {
      console.error("❌ Error deleting product:", error);
      return false;
    }
  },

  // Update product quantity
  updateQuantity: (id, quantityChange) => {
    try {
      console.log(`📦 Updating quantity for product ${id} by ${quantityChange}`);
      
      const data = fs.readFileSync(productsPath, 'utf8');
      let products = JSON.parse(data);
      
      // Find product index
      const productIndex = products.findIndex(product => product.id === id);
      if (productIndex === -1) {
        console.log(`❌ Product not found for quantity update: ${id}`);
        return null;
      }
      
      // Check if enough quantity is available
      if (products[productIndex].quantity + quantityChange < 0) {
        console.log(`❌ Not enough quantity available for product ${id}`);
        return { error: "Not enough quantity available" };
      }
      
      // Update quantity
      products[productIndex].quantity += quantityChange;
      
      // Write back to file with proper formatting
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      console.log('✅ Product quantity updated successfully:', products[productIndex]);
      return products[productIndex];
    } catch (error) {
      console.error("❌ Error updating product quantity:", error);
      return null;
    }
  },

  // Ajouter des codes uniques à tous les produits existants qui n'en ont pas
  generateCodesForExistingProducts: () => {
    try {
      console.log('🔧 Generating codes for existing products without codes...');
      
      const data = fs.readFileSync(productsPath, 'utf8');
      let products = JSON.parse(data);
      
      // Récupérer tous les codes existants
      const existingCodes = products.filter(p => p.code).map(p => p.code);
      let updatedCount = 0;
      
      // Parcourir tous les produits et générer un code pour ceux qui n'en ont pas
      products = products.map(product => {
        let updated = product;
        if (!updated.code) {
          const newCode = generateProductCode(product.description || '', existingCodes);
          existingCodes.push(newCode); // Ajouter le nouveau code pour éviter les doublons
          updatedCount++;
          console.log(`  ✅ Generated code ${newCode} for: ${product.description}`);
          updated = { ...updated, code: newCode };
        }
        // Générer la caractéristique si manquante
        if (!updated.caracteristique || typeof updated.caracteristique !== 'object') {
          updated = { ...updated, caracteristique: buildCaracteristique(updated) };
          console.log(`  🏷️ Generated caracteristique for: ${updated.description}`);
        }
        return updated;
      });
      
      // Sauvegarder les modifications
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      console.log(`✅ Generated codes for ${updatedCount} products`);
      return { success: true, updatedCount, products };
    } catch (error) {
      console.error("❌ Error generating codes for existing products:", error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = Product;
