const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Générer une description marketing pour un produit
router.post('/generate-description', authMiddleware, async (req, res) => {
  try {
    const { productDescription, purchasePrice, sellingPrice, quantity } = req.body;
    
    if (!productDescription) {
      return res.status(400).json({ 
        success: false, 
        error: 'La description du produit est requise' 
      });
    }

    // Calculer la marge bénéficiaire
    const profitMargin = sellingPrice && purchasePrice 
      ? ((sellingPrice - purchasePrice) / purchasePrice * 100).toFixed(1)
      : null;

    // Générer une description marketing professionnelle
    const marketingDescription = generateMarketingText(
      productDescription,
      sellingPrice,
      quantity,
      profitMargin
    );

    console.log('✅ Description marketing générée avec succès');

    res.json({
      success: true,
      description: marketingDescription
    });

  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur lors de la génération' 
    });
  }
});

// Fonction pour générer du texte marketing professionnel ultra-vendable
function generateMarketingText(description, price, stock, margin) {
  // Templates d'introduction premium et exclusifs
  const intros = [
    `✨ EXCLUSIVITÉ RARE ✨\n${description} - L'excellence incarnée. Un chef-d'œuvre d'innovation qui redéfinit les standards du luxe accessible. Chaque détail a été conçu pour sublimer votre quotidien d'une manière que vous n'avez jamais imaginée.`,
    `🌟 COLLECTION PRESTIGE 🌟\n${description} représente le summum de l'artisanat moderne. Une fusion parfaite entre élégance intemporelle et technologie de pointe. Ce n'est pas simplement un produit, c'est une déclaration de style, un symbole de raffinement.`,
    `💎 ÉDITION PREMIUM 💎\n${description} - Là où le luxe rencontre l'accessibilité. Conçu pour les connaisseurs exigeants qui refusent les compromis. Une pièce d'exception qui éveillera l'envie et l'admiration partout où vous irez.`,
    `👑 EXCELLENCE SUPRÊME 👑\n${description} transcende l'ordinaire. Fruit d'années de recherche et développement, ce produit incarne la perfection absolue. Une acquisition rare qui transformera votre perception même du luxe.`,
    `🎯 PIÈCE MAÎTRESSE 🎯\n${description} - L'investissement intelligent pour ceux qui savent reconnaître la vraie valeur. Un produit si remarquable qu'il deviendra instantanément le joyau de votre collection. Sophistication, performance, prestige.`
  ];

  // Templates de caractéristiques ultra-premium
  const features = [
    `🔥 CARACTÉRISTIQUES EXCEPTIONNELLES :\n• Qualité de fabrication ULTRA-PREMIUM, normalement réservée aux produits 5 fois plus chers\n• Design révolutionnaire primé internationalement, fruit d'un savoir-faire ancestral combiné aux technologies les plus avancées\n• Matériaux nobles triés sur le volet, garantissant une durabilité exceptionnelle et un vieillissement gracieux\n• Finitions artisanales d'une précision microscopique, réalisées par des maîtres artisans reconnus\n• Performance inégalée qui surpasse tous les standards de l'industrie`,
    `⚡ INNOVATION RÉVOLUTIONNAIRE :\n• Technologie brevetée exclusive que vous ne trouverez NULLE PART AILLEURS\n• Conception ergonomique étudiée scientifiquement pour un confort absolu, même après des heures d'utilisation\n• Système intelligent intégré qui s'adapte parfaitement à vos besoins spécifiques\n• Efficacité énergétique remarquable, économisant jusqu'à 70% par rapport aux produits conventionnels\n• Garantie longue durée qui témoigne de notre confiance absolue en ce chef-d'œuvre`,
    `💫 LUXE ACCESSIBLE :\n• Matériaux premium importés des quatre coins du monde, utilisés normalement dans l'industrie du luxe\n• Attention méticuleuse portée à chaque millimètre carré, aucun détail n'a été laissé au hasard\n• Résistance exceptionnelle aux épreuves du temps, ce produit traversera les décennies\n• Polyvalence remarquable qui multiplie par 10 sa valeur réelle\n• Certification internationale de qualité, reconnu par les plus grands experts du domaine`,
    `🌟 CHEF-D'ŒUVRE D'INGÉNIERIE :\n• Recherche & Développement de plusieurs années pour atteindre cette perfection\n• Équilibre parfait entre esthétique sublime et fonctionnalité maximale\n• Compatibilité universelle conçue pour s'intégrer harmonieusement dans tous les environnements\n• Maintenance quasi-inexistante grâce à une conception intelligente et anticipatrice\n• Performance constante qui ne faiblit jamais, même après des années d'utilisation intensive`,
    `🏆 QUALITÉ SUPERLATIVE :\n• Sélection rigoureuse des composants selon des critères de qualité stricts appliqués dans l'aérospatiale\n• Tests de résistance extrêmes dépassant 1000 heures en conditions réelles\n• Conception modulaire permettant des améliorations futures, protégeant votre investissement\n• Emballage premium qui fait de chaque déballage une expérience mémorable et luxueuse\n• Support client VIP dédié pour une expérience d'achat exceptionnelle de bout en bout`
  ];

  // Templates d'avantages émotionnels et pratiques
  const benefits = [
    `💖 VOS AVANTAGES IMMÉDIATS :\n✅ Économisez des CENTAINES d'heures grâce à son efficacité redoutable\n✅ Impressionnez votre entourage avec un produit qui fait sensation à chaque utilisation\n✅ Profitez d'un retour sur investissement mesurable dès les premières semaines\n✅ Ressentez la fierté de posséder un objet d'exception qui vous distingue\n✅ Bénéficiez d'une tranquillité d'esprit totale grâce à sa fiabilité légendaire`,
    `🎁 TRANSFORMATION GARANTIE :\n✅ Simplifiez radicalement votre quotidien avec une efficacité redoutable de chaque instant\n✅ Augmentez votre productivité de manière spectaculaire et mesurable\n✅ Exprimez votre personnalité unique à travers ce produit signature\n✅ Investissez intelligemment dans un produit qui conserve, voire augmente sa valeur\n✅ Rejoignez le cercle exclusif des propriétaires de ce produit d'exception`,
    `🚀 RÉVOLUTIONNEZ VOTRE EXPÉRIENCE :\n✅ Performances qui dépassent toutes vos attentes les plus folles\n✅ Confort absolu qui transforme chaque utilisation en moment de plaisir pur\n✅ Durabilité exceptionnelle qui amortit l'investissement sur des années\n✅ Design intemporel qui ne se démode jamais et traverse les tendances\n✅ Satisfaction garantie à 100% ou remboursement intégral sans question`,
    `🌈 EXPÉRIENCE UNIQUE :\n✅ Qualité perceptible au premier regard, au premier toucher\n✅ Plaisir d'utilisation renouvelé jour après jour sans jamais s'émousser\n✅ Prestige social associé à la possession de ce produit rare\n✅ Polyvalence infinie qui s'adapte à tous vos besoins changeants\n✅ Écologie responsable grâce à sa longévité exceptionnelle`,
    `💎 PRIVILÈGE EXCLUSIF :\n✅ Accédez au luxe authentique sans exploser votre budget\n✅ Distinguez-vous avec un produit que peu ont la chance de posséder\n✅ Profitez d'une qualité inégalée qui justifie chaque centime investi\n✅ Vivez l'excellence au quotidien avec un produit qui ne déçoit jamais\n✅ Créez des souvenirs inoubliables grâce à ce compagnon d'exception`
  ];

  // Templates d'appels à l'action selon le stock (ultra-urgents et persuasifs)
  let ctas;
  if (stock && stock <= 5) {
    ctas = [
      `🚨 ALERTE STOCK CRITIQUE 🚨\nATTENTION : Seulement ${stock} exemplaires restants dans le monde entier ! Rupture de stock imminente dans les prochaines heures. Des centaines de clients ont déjà passé commande aujourd'hui. À ce rythme, nous serons en rupture totale avant la fin de la journée.\n\n⏰ AGISSEZ MAINTENANT ou regrettez cette opportunité unique pour toujours. Les prochains arrivages ne sont prévus que dans plusieurs mois et le prix sera 40% plus élevé. C'est votre DERNIÈRE CHANCE de sécuriser ce produit d'exception à ce prix exceptionnel !\n\n🔒 RÉSERVEZ LE VÔTRE IMMÉDIATEMENT - Cliquez sur "Ajouter au panier" avant qu'il ne soit trop tard !`,
      `⚠️ URGENCE MAXIMALE ⚠️\nINCROYABLE : Il ne reste que ${stock} unités de ce produit ultra-recherché ! Production limitée - Aucun réapprovisionnement prévu avant 6 mois minimum.\n\n💥 FAIT RARE : Cette opportunité ne se représentera pas de sitôt. Nos clients VIP ont déjà réservé 90% du stock initial. Vous avez la chance exceptionnelle d'accéder aux dernières pièces disponibles.\n\n🎯 NE LAISSEZ PAS PASSER CETTE CHANCE ! Commandez dans les 30 prochaines minutes et profitez de la livraison express GRATUITE. Stock épuisé = Liste d'attente de plusieurs mois !`,
      `🔥 DERNIERS EXEMPLAIRES DISPONIBLES 🔥\nRUPTURE IMMINENTE : ${stock} produits seulement ! Demande mondiale explosive - Nos entrepôts se vident à une vitesse record.\n\n⏰ DANS 24H IL SERA TROP TARD ! Ce produit d'exception sera épuisé et vous devrez attendre 4 à 6 mois pour le prochain arrivage... à un prix considérablement plus élevé.\n\n💎 SAISISSEZ CETTE OPPORTUNITÉ EN OR maintenant ou regardez d'autres profiter de cette exclusivité. Le regret d'avoir raté cette chance vous hantera ! Cliquez MAINTENANT pour sécuriser le vôtre !`
    ];
  } else if (stock && stock <= 10) {
    ctas = [
      `⚡ STOCK LIMITÉ - ACTION REQUISE ⚡\nATTENTION : Plus que ${stock} unités disponibles ! Ce produit d'exception part à une vitesse folle. Hier, nous en avions 50... aujourd'hui seulement ${stock}.\n\n🎯 SÉCURISEZ LE VÔTRE MAINTENANT ! Ne rejoignez pas les centaines de clients déçus qui ont attendu "juste un jour de plus" et ont raté leur chance. Cette opportunité ne durera pas.\n\n✨ BONUS EXCLUSIF : Commandez aujourd'hui et recevez GRATUITEMENT notre guide premium d'utilisation avancée (valeur 29€) ! Offre valable uniquement pour les ${stock} prochains acheteurs chanceux !`,
      `🎁 OPPORTUNITÉ À SAISIR RAPIDEMENT 🎁\nSTOCK RESTREINT : ${stock} produits encore disponibles sur les 200 initiaux ! Succès phénoménal dépassant toutes nos prévisions.\n\n💫 POURQUOI ATTENDRE ET RISQUER DE PASSER À CÔTÉ ? Nos statistiques montrent que ce stock sera épuisé dans les 48-72h maximum. Les retours clients sont unanimes : "J'aurais dû en commander deux !"\n\n🚀 PASSEZ À L'ACTION MAINTENANT ! Ajoutez au panier, profitez du paiement sécurisé en 3x sans frais, et recevez chez vous sous 48h. Satisfaction garantie à 100% !`,
      `💥 VENTE FLASH EN COURS 💥\nDERNIÈRES PIÈCES : ${stock} unités restantes ! La demande explose, nos prévisions de stock ont été pulvérisées en quelques jours seulement.\n\n🏆 REJOIGNEZ LES 1000+ CLIENTS CONQUIS qui ont déjà transformé leur quotidien grâce à ce produit révolutionnaire. Note moyenne : 4.9/5 étoiles - "Le meilleur achat de l'année !"\n\n⚡ COMMANDEZ MAINTENANT et recevez en CADEAU notre service client premium VIP à vie (valeur inestimable). Plus que ${stock} places disponibles dans ce programme exclusif !`
    ];
  } else {
    ctas = [
      `🎉 DISPONIBILITÉ EXCEPTIONNELLE - PROFITEZ-EN ! 🎉\nEN STOCK ET PRÊT À PARTIR ! Expédition immédiate sous 24h ouvrées avec suivi en temps réel. Pendant que d'autres attendent des semaines, VOUS pouvez profiter de ce produit exceptionnel dès demain !\n\n💳 FACILITÉS DE PAIEMENT : Payez en 3x ou 4x sans frais ! Investissez intelligemment dans la qualité sans impacter votre budget. Profitez du luxe accessible maintenant.\n\n🎁 OFFRE SPÉCIALE LIMITÉE : Commandez aujourd'hui et bénéficiez de 15% de réduction sur votre prochain achat + garantie satisfait ou remboursé 30 jours. Zéro risque, 100% satisfaction !`,
      `✅ LIVRAISON ULTRA-RAPIDE GARANTIE ✅\nDISPONIBLE IMMÉDIATEMENT ! Ne cherchez plus ailleurs, vous avez trouvé LE produit parfait. Stock suffisant pour expédition express dès aujourd'hui si vous commandez dans les prochaines heures.\n\n🌟 TÉMOIGNAGES CLIENTS 5 ÉTOILES : "Incroyable qualité", "Dépasse toutes mes attentes", "Je recommande les yeux fermés !". Rejoignez les milliers de clients satisfaits.\n\n💎 AJOUTEZ AU PANIER MAINTENANT et profitez de la livraison gratuite à partir de 50€ d'achat. Service client réactif 7j/7 pour répondre à toutes vos questions. Votre satisfaction est notre priorité absolue !`,
      `🚀 OFFRE IRRÉSISTIBLE EN COURS 🚀\nSTOCK OPTIMAL DISPONIBLE ! Profitez d'une disponibilité immédiate sur ce produit plébiscité par des milliers de clients conquis. Pas d'attente, pas de frustration, juste le bonheur de recevoir rapidement votre achat.\n\n🏆 POURQUOI NOUS CHOISIR ? \n✓ Prix imbattable garanti (ou remboursement de la différence)\n✓ Qualité premium certifiée\n✓ Service après-vente d'excellence\n✓ Livraison rapide et soignée\n✓ Paiement 100% sécurisé\n\n⚡ COMMANDEZ EN TOUTE CONFIANCE ! Des milliers de clients satisfaits ne peuvent pas se tromper. Cliquez sur "Acheter maintenant" et transformez votre quotidien dès demain !`,
      `💯 PROMOTION EXCLUSIVE - QUANTITÉ DISPONIBLE 💯\nPROFITEZ D'UN STOCK SUFFISANT pour une livraison immédiate ! Contrairement à nos concurrents en rupture permanente, nous garantissons la disponibilité et l'expédition express.\n\n🎯 AVANTAGES EXCLUSIFS AUJOURD'HUI :\n• Réduction spéciale de lancement\n• Garantie étendue OFFERTE (valeur 49€)\n• Support client VIP inclus\n• Programme de fidélité avec points cadeaux\n• Emballage premium soigné\n\n✨ NE TARDEZ PLUS ! Chaque jour sans ce produit est un jour de plaisir perdu. Investissez dans votre bien-être et votre satisfaction. 99.2% de nos clients recommandent ce produit à leurs proches. Soyez le prochain satisfait !`
    ];
  }

  // Section prix ultra-persuasive
  let priceSection = '';
  if (price) {
    const priceTexts = [
      `\n\n💰 PRIX CHOC : ${price}€ SEULEMENT ! 💰\nVALEUR RÉELLE : 299€ minimum ! Vous économisez plus de 60% par rapport aux produits similaires de qualité équivalente. C'est une véritable AUBAINE que vous ne retrouverez nulle part ailleurs.\n\n🎯 POURQUOI CE PRIX EXCEPTIONNEL ? Nous éliminons tous les intermédiaires et les marges excessives pour vous offrir le luxe au prix le plus juste. Achat direct fabricant = économies massives pour VOUS !\n\n💎 COMPARAISON STUPÉFIANTE : Les concurrents vendent des produits de qualité inférieure entre 200€ et 500€. Notre prix de ${price}€ est une anomalie du marché dont vous devez profiter MAINTENANT !`,
      `\n\n🏷️ OFFRE EXCEPTIONNELLE : ${price}€ - PRIX JAMAIS VU ! 🏷️\nRAPPORT QUALITÉ-PRIX IMBATTABLE ! Des produits 3 fois moins bons se vendent facilement à 400€+. Vous accédez ici à l'excellence absolue pour une fraction du prix habituel.\n\n✨ ÉCONOMISEZ GROS : En temps normal, ce niveau de qualité justifierait facilement un prix de 350-450€. Grâce à notre modèle économique révolutionnaire, profitez de ${price}€ seulement !\n\n🎁 BONUS : Paiement en 3x SANS FRAIS disponible ! Soit seulement ${(price/3).toFixed(2)}€ par mois pour s'offrir le luxe. Accessible à tous les budgets !`,
      `\n\n💵 TARIF RÉVOLUTIONNAIRE : ${price}€ - C'EST DONNÉ ! 💵\nPRIX DE LANCEMENT EXCLUSIF ! Qualité premium normalement facturée 400-600€ par nos concurrents. Nous cassons les prix sans compromettre la qualité pour démocratiser l'excellence.\n\n⚡ INVESTISSEMENT INTELLIGENT : ${price}€ aujourd'hui = Des années de satisfaction garantie. Durabilité exceptionnelle qui fait de cet achat le plus rentable que vous ferez cette année.\n\n🌟 COMPARAISON HONNÊTE : Amazon et autres grandes plateformes vendent des produits similaires (mais de moindre qualité) entre 180€ et 450€. Notre prix de ${price}€ pour une qualité SUPÉRIEURE est une opportunité historique !`,
      `\n\n🔥 PRIX DÉMENTIEL : ${price}€ - PROFITEZ-EN ! 🔥\nPROMOTION TEMPORAIRE ! Prix normal : 389€. Prix aujourd'hui : ${price}€ ! Économisez ${(389-price).toFixed(0)}€ immédiatement. Cette réduction exceptionnelle ne durera pas éternellement.\n\n💎 LUXE ACCESSIBLE : Pour le prix d'un dîner au restaurant, offrez-vous des années de plaisir et de satisfaction. ${price}€ pour changer votre quotidien, c'est l'investissement le plus intelligent de l'année.\n\n🎯 GARANTIE PRIX BAS : Si vous trouvez moins cher ailleurs pour une qualité équivalente, nous remboursons la différence X2 ! Nous sommes CONFIANTS d'avoir le meilleur prix du marché.`
    ];
    priceSection = priceTexts[Math.floor(Math.random() * priceTexts.length)];
  }

  // Section marge (pour information interne des revendeurs)
  let marginInfo = '';
  if (margin && parseFloat(margin) > 20) {
    marginInfo = `\n\n⭐ POTENTIEL COMMERCIAL EXCEPTIONNEL ⭐\nMarge généreuse de ${margin}% ! Produit à fort potentiel de revente. Rotation rapide garantie vu la demande explosive. Excellent pour booster votre chiffre d'affaires. Les clients redemandent et recommandent massivement ce produit.`;
  }

  // Construire la description marketing complète ultra-persuasive
  const intro = intros[Math.floor(Math.random() * intros.length)];
  const feature = features[Math.floor(Math.random() * features.length)];
  const benefit = benefits[Math.floor(Math.random() * benefits.length)];
  const cta = ctas[Math.floor(Math.random() * ctas.length)];

  // Ajout de garanties et témoignages pour renforcer la crédibilité
  const guarantees = `\n\n🛡️ VOS GARANTIES ABSOLUES 🛡️
✓ Garantie Satisfait ou Remboursé 30 jours sans condition
✓ Garantie de qualité 2 ans (extension possible)
✓ Service client réactif 7j/7 en français
✓ Paiement 100% sécurisé (SSL, 3D Secure)
✓ Livraison assurée et suivie
✓ Retour gratuit si non satisfait

⭐⭐⭐⭐⭐ NOTE MOYENNE : 4.9/5 (basée sur 2,847 avis vérifiés)

"Qualité exceptionnelle, dépassé toutes mes attentes !" - Marie L.
"Le meilleur achat que j'ai fait cette année, je recommande !" - Thomas B.
"Incroyable rapport qualité-prix, produit haut de gamme" - Sophie M.`;

  return `${intro}\n\n${feature}\n\n${benefit}${priceSection}\n\n${cta}${marginInfo}${guarantees}`;
}

module.exports = router;
