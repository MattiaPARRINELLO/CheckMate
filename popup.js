// =============================================
// Pointage Auto — Script du popup
// Gestion de la configuration et du canvas signature
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // --- Références DOM ---
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const canvas = document.getElementById('signature-canvas');
  const ctx = canvas.getContext('2d');
  const placeholder = document.getElementById('canvas-placeholder');
  const btnClear = document.getElementById('btn-clear');
  const btnSave = document.getElementById('btn-save');
  const btnStart = document.getElementById('btn-start');
  const configStatus = document.getElementById('config-status');
  const statusBar = document.getElementById('status-bar');

  // --- État du dessin ---
  let isDrawing = false;
  let signatureData = []; // Tableau de coordonnées [{x, y, type}]
  let hasSignature = false;

  // =============================================
  // CANVAS — Gestion du dessin de signature
  // =============================================

  /**
   * Initialise le style de trait du canvas
   */
  function initCanvasStyle() {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  initCanvasStyle();

  /**
   * Récupère les coordonnées de la souris relativement au canvas
   */
  function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  /**
   * Début du tracé (mousedown)
   */
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const coords = getCanvasCoords(e);
    signatureData.push({ x: coords.x, y: coords.y, type: 'start' });
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    // Masquer le placeholder dès le premier tracé
    if (!hasSignature) {
      hasSignature = true;
      placeholder.classList.add('hidden');
    }
  });

  /**
   * Tracé en cours (mousemove)
   */
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    signatureData.push({ x: coords.x, y: coords.y, type: 'move' });
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  });

  /**
   * Fin du tracé (mouseup / mouseleave)
   */
  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    const coords = getCanvasCoords(e);
    signatureData.push({ x: coords.x, y: coords.y, type: 'end' });
    ctx.closePath();
  }

  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  /**
   * Efface le canvas et réinitialise les données de signature
   */
  btnClear.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signatureData = [];
    hasSignature = false;
    placeholder.classList.remove('hidden');
  });

  /**
   * Redessine une signature à partir d'un tableau de coordonnées
   * Utilisé lors du chargement de données sauvegardées
   */
  function redrawSignature(data) {
    if (!data || data.length === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    initCanvasStyle();

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      if (point.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      } else if (point.type === 'move') {
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else if (point.type === 'end') {
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.closePath();
      }
    }
  }

  // =============================================
  // STOCKAGE — Sauvegarde et chargement
  // =============================================

  /**
   * Met à jour l'indicateur de configuration visuel
   */
  function updateConfigStatus(isConfigured) {
    if (isConfigured) {
      configStatus.textContent = '✅ Configuration sauvegardée';
      configStatus.className = 'config-status configured';
      btnStart.disabled = false;
    } else {
      configStatus.textContent = '⚠️ Non configuré';
      configStatus.className = 'config-status not-configured';
      btnStart.disabled = true;
    }
  }

  /**
   * Met à jour la barre de statut avec un message et la date/heure
   */
  function updateStatusBar(message) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    statusBar.textContent = `${message} — ${dateStr} à ${timeStr}`;
  }

  /**
   * Charge les données sauvegardées depuis chrome.storage.local
   * et pré-remplit les champs du popup
   */
  function loadSavedData() {
    chrome.storage.local.get(['username', 'password', 'signatureData', 'lastAction'], (result) => {
      // Pré-remplir l'identifiant
      if (result.username) {
        usernameInput.value = result.username;
      }

      // Pré-remplir le mot de passe
      if (result.password) {
        passwordInput.value = result.password;
      }

      // Redessiner la signature si elle existe
      if (result.signatureData && result.signatureData.length > 0) {
        signatureData = result.signatureData;
        hasSignature = true;
        placeholder.classList.add('hidden');
        redrawSignature(signatureData);
      }

      // Vérifier si la configuration est complète
      const isConfigured = !!(result.username && result.password && result.signatureData && result.signatureData.length > 0);
      updateConfigStatus(isConfigured);

      // Afficher la dernière action si présente
      if (result.lastAction) {
        statusBar.textContent = result.lastAction;
      }
    });
  }

  // Charger les données au démarrage du popup
  loadSavedData();

  // =============================================
  // BOUTON SAUVEGARDER
  // =============================================

  btnSave.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Validation des champs
    if (!username) {
      updateStatusBar('❌ Veuillez saisir un identifiant');
      return;
    }
    if (!password) {
      updateStatusBar('❌ Veuillez saisir un mot de passe');
      return;
    }
    if (signatureData.length === 0) {
      updateStatusBar('❌ Veuillez dessiner votre signature');
      return;
    }

    // Sauvegarde dans chrome.storage.local
    const lastAction = `💾 Configuration sauvegardée — ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    chrome.storage.local.set({
      username: username,
      password: password,
      signatureData: signatureData,
      lastAction: lastAction
    }, () => {
      if (chrome.runtime.lastError) {
        updateStatusBar('❌ Erreur lors de la sauvegarde');
        console.error('Erreur de sauvegarde:', chrome.runtime.lastError);
        return;
      }
      updateConfigStatus(true);
      statusBar.textContent = lastAction;
    });
  });

  // =============================================
  // BOUTON LANCER LE POINTAGE
  // =============================================

  btnStart.addEventListener('click', () => {
    // Vérifier que la configuration est complète avant de lancer
    chrome.storage.local.get(['username', 'password', 'signatureData'], (result) => {
      if (!result.username || !result.password) {
        updateStatusBar('❌ Sauvegardez vos identifiants d\'abord');
        return;
      }
      if (!result.signatureData || result.signatureData.length === 0) {
        updateStatusBar('❌ Sauvegardez votre signature d\'abord');
        return;
      }

      // Désactiver le bouton pendant l'exécution
      btnStart.disabled = true;
      btnStart.textContent = '⏳ Pointage en cours...';
      updateStatusBar('⏳ Lancement du pointage...');

      // Envoyer le message au background.js pour démarrer le processus
      chrome.runtime.sendMessage({ action: 'lancerPointage' }, (response) => {
        // Réactiver le bouton
        btnStart.disabled = false;
        btnStart.textContent = '▶️ Pointer ma présence';

        if (chrome.runtime.lastError) {
          updateStatusBar('❌ Erreur de communication avec le service worker');
          console.error('Erreur:', chrome.runtime.lastError);
          return;
        }

        if (response && response.success) {
          const lastAction = `✅ ${response.message} — ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
          statusBar.textContent = lastAction;
          chrome.storage.local.set({ lastAction: lastAction });
        } else if (response && response.error) {
          updateStatusBar(`❌ ${response.error}`);
        }
      });
    });
  });
});
