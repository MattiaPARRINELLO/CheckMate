// =============================================
// Pointage Auto — Content Script (content.js)
// S'injecte sur https://cesar.emineo-informatique.fr/*
// Fournit les fonctions d'interaction avec le DOM
// =============================================

(() => {
  'use strict';

  // =============================================
  // UTILITAIRES — Délais et attentes
  // =============================================

  /**
   * Attendre un certain nombre de millisecondes
   * @param {number} ms - Durée en millisecondes
   * @returns {Promise<void>}
   */
  function attendre(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Attendre qu'un élément soit présent dans le DOM
   * Utilise un MutationObserver avec un fallback setTimeout
   * @param {string} selecteur - Sélecteur CSS de l'élément attendu
   * @param {number} timeout - Timeout maximal en millisecondes (défaut : 10000)
   * @returns {Promise<Element>} L'élément trouvé
   */
  function attendreElement(selecteur, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Vérifier si l'élément existe déjà
      const element = document.querySelector(selecteur);
      if (element) {
        resolve(element);
        return;
      }

      // Timer de timeout
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Élément introuvable après ${timeout}ms : ${selecteur}`));
      }, timeout);

      // Observer les mutations du DOM
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selecteur);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  // =============================================
  // REPLAY DE SIGNATURE SUR CANVAS DISTANT
  // =============================================

  /**
   * Rejoue une signature sur un canvas cible en simulant les événements souris
   * Calcule automatiquement le ratio entre le canvas du popup (320x150) et le canvas cible
   *
   * @param {string} canvasSelector - Sélecteur CSS du canvas cible
   * @param {Array<{x: number, y: number, type: string}>} signatureData - Coordonnées de la signature
   * @returns {Promise<boolean>} true si la signature a été rejouée avec succès
   */
  async function replaySignature(canvasSelector, signatureData) {
    try {
      // Récupérer le canvas cible
      const canvasCible = document.querySelector(canvasSelector);
      if (!canvasCible) {
        throw new Error(`Canvas cible introuvable : ${canvasSelector}`);
      }

      // Dimensions du canvas source (popup) et cible
      const SOURCE_WIDTH = 320;
      const SOURCE_HEIGHT = 150;
      const rect = canvasCible.getBoundingClientRect();

      // IMPORTANT : utiliser les dimensions CSS d'affichage (rect), pas la résolution
      // interne du canvas (canvasCible.width). Les coordonnées d'événements (clientX,
      // offsetX…) sont en pixels CSS — le navigateur/la librairie fait la conversion
      // vers la résolution interne si nécessaire.
      const displayWidth = rect.width;
      const displayHeight = rect.height;

      // Calculer les ratios de mise à l'échelle
      const ratioX = displayWidth / SOURCE_WIDTH;
      const ratioY = displayHeight / SOURCE_HEIGHT;

      console.log(`[Signature] Ratio X: ${ratioX}, Ratio Y: ${ratioY}`);
      console.log(`[Signature] Canvas cible (affichage CSS): ${displayWidth}x${displayHeight}`);
      console.log(`[Signature] Canvas cible (résolution interne): ${canvasCible.width}x${canvasCible.height}`);
      console.log(`[Signature] Nombre de points: ${signatureData.length}`);

      // Rejouer chaque point de la signature
      for (let i = 0; i < signatureData.length; i++) {
        const point = signatureData[i];
        const x = point.x * ratioX;
        const y = point.y * ratioY;

        // Coordonnées dans la page (pour clientX/clientY)
        const clientX = rect.left + x;
        const clientY = rect.top + y;

        // Options communes pour les événements
        const eventOptions = {
          bubbles: true,
          cancelable: true,
          clientX: clientX,
          clientY: clientY,
          screenX: clientX,
          screenY: clientY,
          offsetX: x,
          offsetY: y,
          button: 0,
          buttons: point.type === 'end' ? 0 : 1
        };

        if (point.type === 'start') {
          // --- Début du tracé ---
          // MouseEvent
          canvasCible.dispatchEvent(new MouseEvent('mousedown', eventOptions));
          // PointerEvent (fallback pour certains frameworks)
          try {
            canvasCible.dispatchEvent(new PointerEvent('pointerdown', {
              ...eventOptions,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true
            }));
          } catch (e) {
            // PointerEvent non supporté, on continue
          }
          // TouchEvent (fallback mobile/tactile)
          try {
            const touch = new Touch({
              identifier: 0,
              target: canvasCible,
              clientX: clientX,
              clientY: clientY,
              screenX: clientX,
              screenY: clientY
            });
            canvasCible.dispatchEvent(new TouchEvent('touchstart', {
              bubbles: true,
              cancelable: true,
              touches: [touch],
              targetTouches: [touch],
              changedTouches: [touch]
            }));
          } catch (e) {
            // TouchEvent non supporté, on continue
          }

        } else if (point.type === 'move') {
          // --- Mouvement du tracé ---
          // MouseEvent
          canvasCible.dispatchEvent(new MouseEvent('mousemove', eventOptions));
          // PointerEvent
          try {
            canvasCible.dispatchEvent(new PointerEvent('pointermove', {
              ...eventOptions,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true
            }));
          } catch (e) {
            // PointerEvent non supporté
          }
          // TouchEvent
          try {
            const touch = new Touch({
              identifier: 0,
              target: canvasCible,
              clientX: clientX,
              clientY: clientY,
              screenX: clientX,
              screenY: clientY
            });
            canvasCible.dispatchEvent(new TouchEvent('touchmove', {
              bubbles: true,
              cancelable: true,
              touches: [touch],
              targetTouches: [touch],
              changedTouches: [touch]
            }));
          } catch (e) {
            // TouchEvent non supporté
          }

          // Délai réaliste entre chaque mouvement (10-15ms)
          await attendre(10 + Math.random() * 5);

        } else if (point.type === 'end') {
          // --- Fin du tracé ---
          // MouseEvent
          canvasCible.dispatchEvent(new MouseEvent('mouseup', eventOptions));
          // PointerEvent
          try {
            canvasCible.dispatchEvent(new PointerEvent('pointerup', {
              ...eventOptions,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true
            }));
          } catch (e) {
            // PointerEvent non supporté
          }
          // TouchEvent
          try {
            const touch = new Touch({
              identifier: 0,
              target: canvasCible,
              clientX: clientX,
              clientY: clientY,
              screenX: clientX,
              screenY: clientY
            });
            canvasCible.dispatchEvent(new TouchEvent('touchend', {
              bubbles: true,
              cancelable: true,
              touches: [],
              targetTouches: [],
              changedTouches: [touch]
            }));
          } catch (e) {
            // TouchEvent non supporté
          }
        }
      }

      console.log('[Signature] Replay terminé avec succès');
      return true;

    } catch (erreur) {
      console.error('[Signature] Erreur lors du replay:', erreur.message);
      throw erreur;
    }
  }

  // =============================================
  // VALIDATION DU POINTAGE
  // =============================================

  /**
   * Clique sur le bouton de validation du pointage
   * @param {string} buttonSelector - Sélecteur CSS du bouton de validation
   * @returns {Promise<boolean>} true si le clic a réussi
   */
  async function clickValidation(buttonSelector) {
    try {
      const bouton = await attendreElement(buttonSelector, 5000);
      if (!bouton) {
        throw new Error(`Bouton de validation introuvable : ${buttonSelector}`);
      }

      // Simuler un survol puis un clic réaliste
      bouton.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await attendre(100);
      bouton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await attendre(50);
      bouton.click();
      bouton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      bouton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      console.log('[Validation] Bouton de validation cliqué');
      return true;

    } catch (erreur) {
      console.error('[Validation] Erreur:', erreur.message);
      throw erreur;
    }
  }

  // =============================================
  // ÉCOUTEUR DE MESSAGES DU BACKGROUND
  // =============================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // --- Action : lancerSignature — Flux complet de signature automatique ---
    if (message.action === 'lancerSignature') {
      (async () => {
        try {
          // Fonction de log horodaté locale
          const log = (msg) => {
            const t = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
            console.log(`[${t}][Signature] ${msg}`);
          };

          log('Message lancerSignature reçu — démarrage du flux');

          // 1. Chercher le bouton signature (timeout 30s — site lent)
          log('Étape 1/8 — Recherche du bouton signature (button.buttonPresent, timeout 30s)...');
          let boutonSignature;
          try {
            boutonSignature = await attendreElement('button.buttonPresent', 30000);
            log('Étape 1/8 — Bouton signature trouvé');
          } catch (e) {
            log('Étape 1/8 — Bouton signature introuvable après 30s, aucun cours à signer');
            sendResponse({ success: false, error: 'Aucun bouton de signature trouvé sur la page' });
            return;
          }

          // 2. Cliquer sur le bouton pour ouvrir le popup de signature
          boutonSignature.click();
          log('Étape 2/8 — Clic sur le bouton signature effectué, attente du canvas...');

          // 3. Attendre l'apparition du canvas de signature (timeout 15s — popup lent)
          const canvasSelector = 'canvas[data-written-signature-target="canvas"]';
          log('Étape 3/8 — Attente du canvas de signature (timeout 15s)...');
          await attendreElement(canvasSelector, 15000);
          log('Étape 3/8 — Canvas de signature détecté dans le DOM');

          // 4. Récupérer les données de signature depuis le storage
          log('Étape 4/8 — Récupération des données de signature depuis chrome.storage.local...');
          const result = await new Promise(resolve => {
            chrome.storage.local.get(['signatureData'], resolve);
          });

          if (!result.signatureData || result.signatureData.length === 0) {
            log('Étape 4/8 — ERREUR: aucune donnée de signature dans le storage');
            sendResponse({ success: false, error: 'Aucune donnée de signature enregistrée dans le storage' });
            return;
          }
          log(`Étape 4/8 — ${result.signatureData.length} points de signature récupérés`);

          // 5. Rejouer la signature sur le canvas
          log('Étape 5/8 — Replay de la signature sur le canvas...');
          await replaySignature(canvasSelector, result.signatureData);
          log('Étape 5/8 — Signature rejouée avec succès');

          // 6. Attendre que le canvas enregistre le tracé
          log('Étape 6/8 — Pause de 500ms pour laisser le canvas enregistrer le tracé...');
          await attendre(500);
          log('Étape 6/8 — Pause terminée');

          // 7. Cliquer sur le bouton "Enregistrer"
          log('Étape 7/8 — Clic sur le bouton Enregistrer (button[data-live-action-param="signed"])...');
          // Capturer le contenu actuel du swal2 AVANT le clic pour détecter le changement
          const swalAvant = document.querySelector('.swal2-html-container');
          const texteAvant = swalAvant ? swalAvant.textContent.trim() : '';
          log(`Étape 7/8 — Contenu swal2 avant clic: "${texteAvant.substring(0, 80)}..."`);
          await clickValidation('button[data-live-action-param="signed"]');
          log('Étape 7/8 — Bouton Enregistrer cliqué');

          // 8. Attendre que le popup de confirmation change (nouveau swal2 ou contenu différent)
          log('Étape 8/8 — Attente du changement de popup (timeout 15s)...');
          const POLL_INTERVAL = 300;
          const MAX_POLLS = 50; // 50 × 300ms = 15s
          let texteConfirmation = '';
          let confirmationTrouvee = false;

          for (let i = 0; i < MAX_POLLS; i++) {
            await attendre(POLL_INTERVAL);
            const swalActuel = document.querySelector('.swal2-html-container');
            if (!swalActuel) continue; // le popup a disparu, attendre le nouveau

            const texteCourant = swalActuel.textContent.trim();
            // Le contenu a changé → c'est le popup de confirmation
            if (texteCourant && texteCourant !== texteAvant) {
              texteConfirmation = texteCourant;
              confirmationTrouvee = true;
              log(`Étape 8/8 — Nouveau popup détecté (tentative ${i + 1}), contenu: "${texteCourant}"`);
              break;
            }
          }

          if (!confirmationTrouvee) {
            log('Étape 8/8 — Timeout: aucun changement de popup détecté après 15s');
            sendResponse({ success: false, error: 'Aucune confirmation reçue après la signature' });
            return;
          }

          if (texteConfirmation.includes('présence') || texteConfirmation.includes('prise en compte') || texteConfirmation.includes('présent')) {
            log('SUCCÈS — Présence confirmée !');
            sendResponse({ success: true });
          } else {
            log(`ÉCHEC — Texte de confirmation inattendu: "${texteConfirmation}"`);
            sendResponse({ success: false, error: `Confirmation inattendue : "${texteConfirmation}"` });
          }

        } catch (erreur) {
          const t = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          console.error(`[${t}][Signature] ERREUR FATALE: ${erreur.message}`);
          console.error(`[${t}][Signature] Stack:`, erreur.stack);
          sendResponse({ success: false, error: erreur.message });
        }
      })();
      return true; // Réponse asynchrone
    }

    // --- Action : ping — Vérification que le content script est bien chargé ---
    if (message.action === 'ping') {
      sendResponse({ success: true, message: 'Content script actif' });
      return false;
    }
  });

  // Log de chargement pour le debug
  console.log('[Pointage Auto] Content script chargé sur:', window.location.href);

})();
