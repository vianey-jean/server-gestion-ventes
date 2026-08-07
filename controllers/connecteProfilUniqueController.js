/**
 * =============================================================================
 * Controller — ConnecteProfilUnique (session unique par profil)
 * =============================================================================
 *
 * Couche CONTROLLER (MVC) : toute la logique métier de la connexion unique.
 *
 * Règles métier :
 *  - Chaque connexion (profil + IP + navigateur) est historisée dans
 *    db/connecte-profil-unique.json (date/heure de connexion + déconnexion).
 *  - Un profil NON administrateur principal ne peut être connecté qu'à un seul
 *    endroit : une 2ᵉ connexion doit demander la déconnexion (auto ou manuelle).
 *  - Déconnexion automatique : le poste distant est déconnecté immédiatement.
 *  - Déconnexion manuelle : le poste distant reçoit une notification toutes les
 *    5 secondes ; s'il accepte → déconnexion immédiate ; s'il refuse → la
 *    demande est refusée ; sans réponse pendant 5 minutes → déconnexion forcée.
 *  - Administrateur principal : connexions multiples autorisées, et chaque
 *    nouvelle connexion notifie toutes ses autres sessions actives.
 *
 * @module controllers/connecteProfilUniqueController
 */

const M = require('../models/ConnecteProfilUnique');

/**
 * Envoie une notification à TOUTES les sessions actives d'administrateurs
 * principaux (sauf l'entrée exclue).
 */
const notifyPrincipals = (data, notif, excludeEntryId = null) => {
  data.forEach((adm) => {
    if (!M.isPrincipal(adm.role)) return;
    if (excludeEntryId && adm.id === excludeEntryId) return;
    if (!M.isEntryActive(adm)) return;
    adm.notifications = Array.isArray(adm.notifications) ? adm.notifications : [];
    adm.notifications.push({ id: M.newId('notif'), delivered: false, ...notif });
    if (adm.notifications.length > 200) adm.notifications = adm.notifications.slice(-200);
  });
};

/** Notification verte / rouge décrivant une entrée de session */
const sessionNotif = (entry, type) => {
  const { iso, date, heure } = M.nowParts();
  return {
    type,
    message:
      type === 'user_login'
        ? `${entry.nom || entry.email || 'Un profil'} vient de se connecter`
        : `${entry.nom || entry.email || 'Un profil'} vient de se déconnecter`,
    details: {
      nom: entry.nom || '',
      email: entry.email || '',
      role: entry.role || '',
      ip: entry.ip || '',
      browser: entry.browser || '',
      os: entry.os || '',
      device: entry.device || '',
      timezone: entry.timezone || '',
      date,
      heure,
    },
    createdAt: iso,
  };
};

/** Applique les expirations (demandes manuelles > 5 min, sessions mortes) */
const processExpirations = (data) => {
  let changed = false;
  const now = Date.now();

  data.forEach((entry) => {
    // Demande manuelle sans réponse => déconnexion forcée
    const req = entry.logoutRequest;
    if (req && req.status === 'pending' && req.expiresAt && now >= new Date(req.expiresAt).getTime()) {
      req.status = 'granted_timeout';
      req.respondedAt = new Date().toISOString();
      entry.forceLogout = true;
      entry.forceLogoutReason = 'Déconnexion automatique après 5 minutes sans réponse';
      M.closeSession(entry, 'déconnexion automatique (délai 5 min dépassé)');
      notifyPrincipals(data, sessionNotif(entry, 'user_logout'), entry.id);
      changed = true;
    }
    // Session sans heartbeat => considérée fermée
    if (entry.active && !M.isEntryActive(entry)) {
      M.closeSession(entry, 'session inactive (navigateur fermé)');
      notifyPrincipals(data, sessionNotif(entry, 'user_logout'), entry.id);
      changed = true;
    }
  });

  return changed;
};

/**
 * Résumé des connexions / déconnexions du jour (00:00 → 23:59)
 * survenues AVANT l'instant donné.
 */
const buildDailySummary = (data, beforeIso) => {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(beforeIso).getTime();
  let connexions = 0;
  let deconnexions = 0;
  data.forEach((e) => {
    (e.historique || []).forEach((s) => {
      if (s.connecteAt && s.dateConnexion === today && new Date(s.connecteAt).getTime() < limit) connexions += 1;
      if (s.deconnecteAt && s.dateDeconnexion === today && new Date(s.deconnecteAt).getTime() < limit) deconnexions += 1;
    });
  });
  return { connexions, deconnexions };
};


const publicEntry = (e) => ({
  id: e.id,
  userId: e.userId,
  email: e.email,
  nom: e.nom,
  role: e.role,
  ip: e.ip,
  browser: e.browser,
  os: e.os,
  device: e.device,
  timezone: e.timezone,
  active: e.active,
  lastSeenAt: e.lastSeenAt,
  derniereConnexion: (e.historique || [])[(e.historique || []).length - 1] || null,
});

/**
 * POST /check — Vérifie si le profil peut se connecter ici
 */
exports.check = (req, res) => {
  try {
    const { userId, role } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId requis' });

    const data = M.readAll();
    if (processExpirations(data)) M.writeAll(data);

    const ctx = M.buildContext(req, req.body || {});

    // Administrateur principal : multi-connexions autorisées
    if (M.isPrincipal(role)) {
      return res.json({ allowed: true, principal: true, context: ctx });
    }

    const conflict = data.find(
      (e) => String(e.userId) === String(userId) && e.deviceKey !== ctx.deviceKey && M.isEntryActive(e)
    );

    if (!conflict) return res.json({ allowed: true, principal: false, context: ctx });

    const last = (conflict.historique || [])[(conflict.historique || []).length - 1] || {};
    return res.json({
      allowed: false,
      principal: false,
      context: ctx,
      conflict: {
        entryId: conflict.id,
        ip: conflict.ip,
        browser: conflict.browser,
        os: conflict.os,
        device: conflict.device,
        timezone: conflict.timezone,
        dateConnexion: last.dateConnexion || '',
        heureConnexion: last.heureConnexion || '',
      },
    });
  } catch (error) {
    console.error('check session unique error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /register-login — Enregistre une connexion réussie
 */
exports.registerLogin = (req, res) => {
  try {
    const { userId, email, nom, role } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId requis' });

    const data = M.readAll();
    processExpirations(data);

    const ctx = M.buildContext(req, req.body || {});
    const { iso, date, heure } = M.nowParts();
    const sessionId = M.newId('sess');

    let entry = M.findEntry(data, userId, ctx.deviceKey);

    if (!entry) {
      entry = {
        id: M.newId('cpu'),
        userId: String(userId),
        email: email || '',
        nom: nom || '',
        role: role || '',
        ...ctx,
        firstSeenAt: iso,
        historique: [],
        logoutRequest: null,
        notifications: [],
      };
      data.push(entry);
    } else {
      // Même profil, même IP + même navigateur => on ajoute juste l'heure de connexion
      entry.email = email || entry.email;
      entry.nom = nom || entry.nom;
      entry.role = role || entry.role;
      entry.timezone = ctx.timezone || entry.timezone;
      entry.userAgent = ctx.userAgent;
      if (entry.active && entry.currentSessionId) {
        M.closeSession(entry, 'nouvelle connexion sur le même appareil');
      }
    }

    entry.historique = Array.isArray(entry.historique) ? entry.historique : [];
    entry.historique.push({
      sessionId,
      dateConnexion: date,
      heureConnexion: heure,
      connecteAt: iso,
      ip: ctx.ip,
      browser: ctx.browser,
      os: ctx.os,
      device: ctx.device,
      timezone: ctx.timezone,
      dateDeconnexion: null,
      heureDeconnexion: null,
      deconnecteAt: null,
      motif: null,
    });
    entry.active = true;
    entry.currentSessionId = sessionId;
    entry.forceLogout = false;
    entry.forceLogoutReason = '';
    entry.logoutRequest = null;
    entry.lastSeenAt = iso;

    // Administrateur principal : notifier ses autres sessions actives
    if (M.isPrincipal(entry.role)) {
      data.forEach((other) => {
        if (other.id === entry.id) return;
        if (String(other.userId) !== String(entry.userId)) return;
        if (!M.isEntryActive(other)) return;
        other.notifications = Array.isArray(other.notifications) ? other.notifications : [];
        other.notifications.push({
          id: M.newId('notif'),
          type: 'principal_login',
          message: `Votre profil vient de se connecter depuis ${ctx.browser} (${ctx.ip})`,
          details: {
            ip: ctx.ip,
            browser: ctx.browser,
            os: ctx.os,
            device: ctx.device,
            timezone: ctx.timezone,
            dateConnexion: date,
            heureConnexion: heure,
          },
          createdAt: iso,
          delivered: false,
        });
      });
    }

    // Notification VERTE aux administrateurs principaux connectés
    notifyPrincipals(data, sessionNotif(entry, 'user_login'), entry.id);

    // L'administrateur principal qui vient de se connecter reçoit le résumé
    // des connexions / déconnexions du jour survenues avant son arrivée.
    if (M.isPrincipal(entry.role)) {
      const summary = buildDailySummary(data, iso);
      if (summary.connexions > 0 || summary.deconnexions > 0) {
        entry.notifications = Array.isArray(entry.notifications) ? entry.notifications : [];
        entry.notifications.push({
          id: M.newId('notif'),
          type: 'daily_summary',
          message: `${summary.connexions} connexion(s) et ${summary.deconnexions} déconnexion(s) aujourd'hui avant votre arrivée`,
          details: {
            connexions: String(summary.connexions),
            deconnexions: String(summary.deconnexions),
            date,
            heure,
          },
          createdAt: iso,
          delivered: false,
        });
      }
    }

    M.writeAll(data);

    res.json({ success: true, sessionId, entryId: entry.id, principal: M.isPrincipal(entry.role) });
  } catch (error) {
    console.error('registerLogin error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /logout — Enregistre l'heure de déconnexion
 */
exports.logout = (req, res) => {
  try {
    const { sessionId, motif } = req.body || {};
    if (!sessionId) return res.status(400).json({ message: 'sessionId requis' });

    const data = M.readAll();
    const entry = data.find((e) => e.currentSessionId === sessionId);

    if (entry) {
      // Une demande manuelle en attente est validée par la déconnexion réelle
      if (entry.logoutRequest && entry.logoutRequest.status === 'pending') {
        entry.logoutRequest.status = 'granted';
        entry.logoutRequest.respondedAt = new Date().toISOString();
      }
      M.closeSession(entry, motif || 'déconnexion manuelle');
      notifyPrincipals(data, sessionNotif(entry, 'user_logout'), entry.id);
      M.writeAll(data);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('logout session unique error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /request-logout — Demande de déconnexion (mode 'auto' ou 'manuel')
 */
exports.requestLogout = (req, res) => {
  try {
    const { targetEntryId, mode } = req.body || {};
    if (!targetEntryId) return res.status(400).json({ message: 'targetEntryId requis' });

    const data = M.readAll();
    processExpirations(data);

    const target = data.find((e) => e.id === targetEntryId);
    if (!target) return res.status(404).json({ message: 'Session distante introuvable' });

    const ctx = M.buildContext(req, req.body || {});
    const iso = new Date().toISOString();
    const requestId = M.newId('req');

    if (!M.isEntryActive(target)) {
      target.logoutRequest = {
        requestId,
        mode: mode === 'manuel' ? 'manuel' : 'auto',
        status: 'granted',
        requestedAt: iso,
        respondedAt: iso,
        fromIp: ctx.ip,
        fromBrowser: ctx.browser,
      };
      M.closeSession(target, 'session déjà fermée');
      M.writeAll(data);
      return res.json({ requestId, status: 'granted' });
    }

    if (mode === 'manuel') {
      target.logoutRequest = {
        requestId,
        mode: 'manuel',
        status: 'pending',
        requestedAt: iso,
        expiresAt: new Date(Date.now() + M.MANUAL_REQUEST_TIMEOUT_MS).toISOString(),
        fromIp: ctx.ip,
        fromBrowser: ctx.browser,
      };
      M.writeAll(data);
      return res.json({ requestId, status: 'pending', expiresAt: target.logoutRequest.expiresAt });
    }

    // Mode automatique : déconnexion immédiate du poste distant
    target.logoutRequest = {
      requestId,
      mode: 'auto',
      status: 'granted',
      requestedAt: iso,
      respondedAt: iso,
      fromIp: ctx.ip,
      fromBrowser: ctx.browser,
    };
    target.forceLogout = true;
    target.forceLogoutReason = 'Déconnexion automatique demandée depuis un autre appareil';
    M.closeSession(target, 'déconnexion automatique demandée à distance');
    notifyPrincipals(data, sessionNotif(target, 'user_logout'), target.id);
    M.writeAll(data);
    res.json({ requestId, status: 'granted' });
  } catch (error) {
    console.error('requestLogout error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * GET /request-status/:requestId — État d'une demande (côté demandeur)
 */
exports.requestStatus = (req, res) => {
  try {
    const { requestId } = req.params;
    const data = M.readAll();
    if (processExpirations(data)) M.writeAll(data);

    const target = data.find((e) => e.logoutRequest && e.logoutRequest.requestId === requestId);
    if (!target) return res.json({ status: 'unknown' });

    const r = target.logoutRequest;
    res.json({
      status: r.status,
      mode: r.mode,
      expiresAt: r.expiresAt || null,
      targetActive: M.isEntryActive(target),
    });
  } catch (error) {
    console.error('requestStatus error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /respond-logout — Réponse du poste distant (accepter / refuser)
 */
exports.respondLogout = (req, res) => {
  try {
    const { sessionId, requestId, accept } = req.body || {};
    const data = M.readAll();

    const entry = data.find(
      (e) => (sessionId && e.currentSessionId === sessionId) ||
             (requestId && e.logoutRequest && e.logoutRequest.requestId === requestId)
    );
    if (!entry || !entry.logoutRequest) return res.status(404).json({ message: 'Demande introuvable' });

    const iso = new Date().toISOString();
    if (accept) {
      entry.logoutRequest.status = 'granted';
      entry.logoutRequest.respondedAt = iso;
      entry.forceLogout = true;
      entry.forceLogoutReason = 'Vous avez accepté la demande de déconnexion';
      M.closeSession(entry, 'déconnexion confirmée par l\'utilisateur');
      notifyPrincipals(data, sessionNotif(entry, 'user_logout'), entry.id);
    } else {
      entry.logoutRequest.status = 'refused';
      entry.logoutRequest.respondedAt = iso;
      entry.lastSeenAt = iso;
    }

    M.writeAll(data);
    res.json({ success: true, status: entry.logoutRequest.status });
  } catch (error) {
    console.error('respondLogout error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /poll — Heartbeat + récupération des demandes/notifications
 */
exports.poll = (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.json({ known: false });

    const data = M.readAll();
    processExpirations(data);

    const entry = data.find((e) => e.currentSessionId === sessionId) ||
                  data.find((e) => (e.historique || []).some((s) => s.sessionId === sessionId));

    if (!entry) {
      M.writeAll(data);
      return res.json({ known: false });
    }

    const isCurrent = entry.currentSessionId === sessionId;
    const forceLogout = !isCurrent || !!entry.forceLogout;
    const reason = entry.forceLogoutReason || (!isCurrent ? 'Session fermée à distance' : '');

    if (forceLogout) {
      entry.forceLogout = false;
      entry.forceLogoutReason = '';
      if (isCurrent) {
        M.closeSession(entry, 'déconnexion forcée');
        notifyPrincipals(data, sessionNotif(entry, 'user_logout'), entry.id);
      }
    } else {
      entry.lastSeenAt = new Date().toISOString();
    }

    const pending = entry.logoutRequest && entry.logoutRequest.status === 'pending'
      ? {
          requestId: entry.logoutRequest.requestId,
          fromIp: entry.logoutRequest.fromIp,
          fromBrowser: entry.logoutRequest.fromBrowser,
          requestedAt: entry.logoutRequest.requestedAt,
          expiresAt: entry.logoutRequest.expiresAt,
        }
      : null;

    const notifications = (entry.notifications || []).filter((n) => !n.delivered);
    notifications.forEach((n) => { n.delivered = true; });

    M.writeAll(data);

    res.json({
      known: true,
      forceLogout,
      reason,
      logoutRequest: pending,
      notifications,
    });
  } catch (error) {
    console.error('poll session unique error:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/** GET / — Liste complète (historique de connexion) */
exports.list = (_req, res) => {
  try {
    const data = M.readAll();
    res.json(data);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/** GET /actives — Sessions actuellement connectées */
exports.actives = (_req, res) => {
  try {
    const data = M.readAll();
    if (processExpirations(data)) M.writeAll(data);
    res.json(data.filter(M.isEntryActive).map(publicEntry));
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/** DELETE / — Réinitialise l'historique */
exports.reset = (_req, res) => {
  try {
    M.writeAll([]);
    res.json({ success: true, message: 'Historique des connexions réinitialisé' });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
