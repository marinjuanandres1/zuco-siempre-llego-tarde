/**
 * Zuco OMG — Siempre Llego Tarde
 * Landing page — 3-step registration flow
 *
 * Replace APPS_SCRIPT_URL with your deployed Google Apps Script Web App URL.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────────────────── */
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwUPcBJt2ixx6r0euEG0I_qUVFjlx8jV2GHjW1Oko9lpHQbQSh1rJZ8QBQU7P2ETOmiCA/exec';

  /* ─────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────── */
  const state = {
    currentStep: 1,
    formData: {
      nombre:    '',
      whatsapp:  '',
      email:     '',
      cancion:   '',
      timestamp: ''
    }
  };

  /* ─────────────────────────────────────────────────────────
     ELEMENT REFS
  ───────────────────────────────────────────────────────── */
  const progressBar   = document.getElementById('step-progress');
  const progressNodes = document.querySelectorAll('.progress-node');
  const progressLines = document.querySelectorAll('.progress-line');

  const form         = document.getElementById('registro-form');
  const inputNombre  = document.getElementById('nombre');
  const inputWa      = document.getElementById('whatsapp');
  const inputEmail   = document.getElementById('email');
  const btnRegistro  = document.getElementById('btn-registro');

  const lyricCards   = document.querySelectorAll('.lyric-card');
  const btnLyric     = document.getElementById('btn-lyric');

  const spotifyCheck = document.getElementById('spotify-check');
  const btnSpotify   = document.getElementById('btn-spotify-link');
  const btnConfirmar = document.getElementById('btn-confirmar');

  /* ─────────────────────────────────────────────────────────
     STEP ENGINE
  ───────────────────────────────────────────────────────── */
  function goToStep(target) {
    const currentEl = document.querySelector('.flow-step.active');

    // Fade out current
    currentEl.classList.remove('entering');

    setTimeout(function () {
      currentEl.classList.remove('active');

      const id = target === 'success' ? 'step-success' : 'step-' + target;
      const nextEl = document.getElementById(id);

      if (!nextEl) return;

      nextEl.classList.add('active');

      // Double rAF to trigger CSS transition
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          nextEl.classList.add('entering');
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      if (typeof target === 'number') {
        state.currentStep = target;
        updateProgress(target);
        showProgressBar();
      } else {
        hideProgressBar();
      }
    }, 280);
  }

  function updateProgress(step) {
    progressNodes.forEach(function (node) {
      const n = parseInt(node.dataset.step, 10);
      node.classList.toggle('done', n < step);
      node.classList.toggle('active', n === step);
    });

    progressLines.forEach(function (line, i) {
      // Line i connects node i+1 to node i+2; fill it when step > i+1
      line.classList.toggle('filled', step > i + 1);
    });
  }

  function showProgressBar() {
    progressBar.classList.add('visible');
  }

  function hideProgressBar() {
    progressBar.classList.remove('visible');
  }

  /* ─────────────────────────────────────────────────────────
     FORM VALIDATION (STEP 1)
  ───────────────────────────────────────────────────────── */
  function showError(field, msg) {
    const errEl  = document.getElementById('error-' + field);
    const input  = document.getElementById(field);
    if (errEl)  errEl.textContent = msg;
    if (input)  input.classList.add('has-error');
  }

  function clearError(field) {
    const errEl = document.getElementById('error-' + field);
    const input = document.getElementById(field);
    if (errEl)  errEl.textContent = '';
    if (input)  input.classList.remove('has-error');
  }

  function validateForm() {
    let valid = true;

    // Nombre: at least 2 words
    const nombre = inputNombre.value.trim();
    if (nombre.split(/\s+/).filter(Boolean).length < 2) {
      showError('nombre', 'Por favor escribe tu nombre y apellido.');
      valid = false;
    } else {
      clearError('nombre');
    }

    // WhatsApp: Colombian mobile, 10 digits or with +57 prefix
    const waRaw  = inputWa.value.trim();
    const waClean = waRaw.replace(/[\s\-\(\)\.]/g, '');
    if (!/^(\+57)?3\d{9}$/.test(waClean)) {
      showError('whatsapp', 'Ingresa un número colombiano válido (ej: 3XX XXX XXXX).');
      valid = false;
    } else {
      clearError('whatsapp');
    }

    // Email: basic format
    const email = inputEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('email', 'Revisa que el email esté bien escrito.');
      valid = false;
    } else {
      clearError('email');
    }

    return valid;
  }

  // Clear errors on input
  [inputNombre, inputWa, inputEmail].forEach(function (el) {
    el.addEventListener('input', function () {
      clearError(el.id);
    });
  });

  /* ─────────────────────────────────────────────────────────
     STEP 1 — SUBMIT
  ───────────────────────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!validateForm()) return;

    // Save to state
    state.formData.nombre    = inputNombre.value.trim();
    state.formData.whatsapp  = inputWa.value.trim();
    state.formData.email     = inputEmail.value.trim();
    state.formData.timestamp = new Date().toISOString();

    // Show loading and submit to Sheets immediately
    var btnText    = btnRegistro.querySelector('.btn-text');
    var btnLoading = btnRegistro.querySelector('.btn-loading');
    btnText.hidden    = true;
    btnLoading.hidden = false;
    btnRegistro.disabled = true;

    // Submit now — don't wait for step 3
    submitToSheets(state.formData).catch(function (err) {
      console.error('[Zuco] Sheets submission error:', err);
    });

    setTimeout(function () {
      btnText.hidden    = false;
      btnLoading.hidden = true;
      btnRegistro.disabled = false;
      goToStep(2);
    }, 600);
  });

  /* ─────────────────────────────────────────────────────────
     STEP 2 — LYRIC CARD SELECTION
  ───────────────────────────────────────────────────────── */
  lyricCards.forEach(function (card) {
    card.addEventListener('click', function () {
      selectCard(card);
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectCard(card);
      }
    });
  });

  function selectCard(card) {
    lyricCards.forEach(function (c) {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });

    card.classList.add('selected');
    card.setAttribute('aria-checked', 'true');
    state.formData.cancion = card.dataset.song;

    btnLyric.disabled = false;
    btnLyric.setAttribute('aria-disabled', 'false');
  }

  btnLyric.addEventListener('click', function () {
    if (state.formData.cancion) {
      goToStep(3);
    }
  });

  /* ─────────────────────────────────────────────────────────
     STEP 3 — SPOTIFY CHECK + CONFIRM
  ───────────────────────────────────────────────────────── */
  // Open Spotify in new tab (native <a> handles this) and visually
  // mark that the user has interacted with the button
  btnSpotify.addEventListener('click', function () {
    setTimeout(function () {
      btnSpotify.style.opacity = '0.7';
      btnSpotify.textContent = '';
      // Rebuild content after style change
      btnSpotify.innerHTML =
        '<svg class="spotify-icon-svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
        '<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>' +
        '</svg>' +
        'Abierto en Spotify ✓';
    }, 300);
  });

  spotifyCheck.addEventListener('change', function () {
    var checked = spotifyCheck.checked;
    btnConfirmar.disabled = !checked;
    btnConfirmar.setAttribute('aria-disabled', String(!checked));
  });

  btnConfirmar.addEventListener('click', function () {
    if (spotifyCheck.checked) {
      submitAndConfirm();
    }
  });

  /* ─────────────────────────────────────────────────────────
     GOOGLE APPS SCRIPT SUBMISSION
  ───────────────────────────────────────────────────────── */
  function submitAndConfirm() {
    var btnText    = btnConfirmar.querySelector('.btn-text');
    var btnLoading = btnConfirmar.querySelector('.btn-loading');
    btnText.hidden    = true;
    btnLoading.hidden = false;
    btnConfirmar.disabled = true;

    // Data was already submitted at step 1. Go straight to success.
    goToStep('success');
  }

  async function submitToSheets(data) {
    if (APPS_SCRIPT_URL === 'REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL') {
      // Dev mode: log and skip actual request
      console.log('[Zuco] Dev mode — would submit:', data);
      return;
    }

    var params = [
      'nombre='    + encodeURIComponent(data.nombre    || ''),
      'whatsapp='  + encodeURIComponent(data.whatsapp  || ''),
      'email='     + encodeURIComponent(data.email     || ''),
      'cancion='   + encodeURIComponent(data.cancion   || ''),
      'timestamp=' + encodeURIComponent(data.timestamp || new Date().toISOString())
    ].join('&');

    var fullUrl = APPS_SCRIPT_URL + '?' + params;
    console.log('[Zuco] Submitting to:', fullUrl);
    console.log('[Zuco] Data:', data);

    await new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        console.log('[Zuco] Image loaded OK');
        resolve();
      };
      img.onerror = function () {
        console.log('[Zuco] Image error (expected — not a real image, but request was sent)');
        resolve();
      };
      img.src = fullUrl;
    });
    console.log('[Zuco] Submit complete');
  }

  /* ─────────────────────────────────────────────────────────
     INIT — trigger first step entrance animation
  ───────────────────────────────────────────────────────── */
  (function init() {
    var firstStep = document.getElementById('step-1');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        firstStep.classList.add('entering');
      });
    });
  })();

})();
