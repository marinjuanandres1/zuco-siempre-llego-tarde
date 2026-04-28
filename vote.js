/* ─────────────────────────────────────────────────────────
   Zuco — Outfit Voting
   Transport : fetch (Supabase REST API)
   Backend   : Supabase + PostgreSQL
   ───────────────────────────────────────────────────────── */

const SUPABASE_URL = 'https://nuozfrqpdadgkwtwvbgx.supabase.co';   // e.g. https://xxxx.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b3pmcnFwZGFkZ2t3dHd2Ymd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDU5NDQsImV4cCI6MjA5Mjk4MTk0NH0.YujZyyAFcRmcZ4N2YaO9HGyD-XL76DDS24Nb_4sxW_k';
const POLL_INTERVAL_MS = 10000;

/* ── State ─────────────────────────────────────────────── */
let voterId      = null;
let votedFit     = null;
let selectedFit  = null;
let pollTimer    = null;
let currentSlide = 0;
const TOTAL_SLIDES = 3;

/* ── DOM refs ──────────────────────────────────────────── */
const phaseVote     = document.getElementById('phase-vote');
const phaseResults  = document.getElementById('phase-results');
const btnVotar      = document.getElementById('btn-votar');
const voteError     = document.getElementById('vote-error');
const resultsTitle  = document.getElementById('results-title');
const cards         = document.querySelectorAll('.outfit-card');
const barRows       = document.querySelectorAll('.bar-row');
const carouselTrack = document.querySelector('.carousel-track');
const prevBtn       = document.querySelector('.carousel-prev');
const nextBtn       = document.querySelector('.carousel-next');
const dots          = document.querySelectorAll('.carousel-dot');

/* ── Boot ──────────────────────────────────────────────── */
function init() {
  voterId  = getOrCreateVoterId();
  votedFit = localStorage.getItem('zuco_voted_fit');

  initCarousel();

  if (votedFit) {
    showResults(false);
    startPolling();
  } else {
    wireCards();
    wireSubmit();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
}

/* ── Voter ID ──────────────────────────────────────────── */
function getOrCreateVoterId() {
  var id = localStorage.getItem('zuco_voter_id');
  if (!id) {
    id = generateUUID();
    localStorage.setItem('zuco_voter_id', id);
  }
  return id;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Carousel ──────────────────────────────────────────── */
function initCarousel() {
  prevBtn.addEventListener('click', function() { goToSlide(currentSlide - 1); });
  nextBtn.addEventListener('click', function() { goToSlide(currentSlide + 1); });

  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      goToSlide(parseInt(dot.dataset.index, 10));
    });
  });

  var touchStartX = 0;
  carouselTrack.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  carouselTrack.addEventListener('touchend', function(e) {
    var diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 48) {
      goToSlide(diff > 0 ? currentSlide + 1 : currentSlide - 1);
    }
  }, { passive: true });

  goToSlide(0);
}

function goToSlide(index) {
  currentSlide = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
  carouselTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';

  dots.forEach(function(dot, i) {
    dot.classList.toggle('is-active', i === currentSlide);
    dot.setAttribute('aria-selected', i === currentSlide ? 'true' : 'false');
  });

  prevBtn.disabled = currentSlide === 0;
  nextBtn.disabled = currentSlide === TOTAL_SLIDES - 1;
}

/* ── Card selection ────────────────────────────────────── */
function wireCards() {
  cards.forEach(function(card) {
    card.addEventListener('click', function() { selectCard(card); });
    card.addEventListener('keydown', function(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectCard(card);
      }
    });
  });
}

function selectCard(card) {
  cards.forEach(function(c) {
    c.classList.remove('is-selected');
    c.setAttribute('aria-pressed', 'false');
    c.querySelector('.outfit-hint').textContent = 'Toca para elegir';
  });
  card.classList.add('is-selected');
  card.setAttribute('aria-pressed', 'true');
  card.querySelector('.outfit-hint').textContent = '✓ Elegido';
  selectedFit = card.closest('.carousel-slide').dataset.fit;

  var slideIndex = Array.from(document.querySelectorAll('.carousel-slide'))
    .findIndex(function(s) { return s.dataset.fit === selectedFit; });
  dots.forEach(function(dot, i) {
    dot.classList.toggle('is-selected-fit', i === slideIndex);
  });

  btnVotar.disabled = false;
  btnVotar.removeAttribute('aria-disabled');
}

/* ── Submit vote ───────────────────────────────────────── */
function wireSubmit() {
  btnVotar.addEventListener('click', function() {
    if (!selectedFit || btnVotar.disabled) return;
    submitVote(selectedFit);
  });
}

function submitVote(fit) {
  setButtonLoading(true);
  hideError();

  fetch(SUPABASE_URL + '/rest/v1/votes', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ voter_id: voterId, fit: fit })
  })
  .then(function(res) {
    if (res.status === 201) {
      onVoteSuccess(fit);
    } else if (res.status === 409) {
      // Unique constraint hit — already voted from another device
      localStorage.setItem('zuco_voted_fit', 'unknown');
      votedFit = 'unknown';
      showResults(false);
      startPolling();
    } else {
      onVoteError('No se pudo registrar el voto. Intenta de nuevo.');
    }
  })
  .catch(function() {
    onVoteError('Error de conexión. Revisa tu red e intenta de nuevo.');
  });
}

function onVoteSuccess(fit) {
  localStorage.setItem('zuco_voted_fit', fit);
  votedFit = fit;
  showResults(true);
  startPolling();
}

function onVoteError(msg) {
  setButtonLoading(false);
  showError(msg);
}

/* ── Phase transition ──────────────────────────────────── */
function showResults(isNewVote) {
  if (!isNewVote) {
    resultsTitle.innerHTML = 'Resultados<br>en vivo.';
  }

  renderResults({ fit1: 0, fit2: 0, fit3: 0 });

  phaseVote.classList.add('phase--hidden');
  phaseResults.classList.remove('phase--hidden');
  phaseResults.classList.add('phase--fade-in');
}

/* ── Results polling ───────────────────────────────────── */
function startPolling() {
  fetchResults();
  pollTimer = setInterval(fetchResults, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function onVisibilityChange() {
  if (document.hidden) {
    stopPolling();
  } else if (votedFit) {
    fetchResults();
    pollTimer = setInterval(fetchResults, POLL_INTERVAL_MS);
  }
}

function fetchResults() {
  fetch(SUPABASE_URL + '/rest/v1/votes?select=fit', {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(rows) {
    var counts = { fit1: 0, fit2: 0, fit3: 0 };
    rows.forEach(function(row) {
      if (counts[row.fit] !== undefined) counts[row.fit]++;
    });
    renderResults(counts);
  })
  .catch(function() { /* silent retry on next poll */ });
}

function renderResults(data) {
  var fit1  = Number(data.fit1)  || 0;
  var fit2  = Number(data.fit2)  || 0;
  var fit3  = Number(data.fit3)  || 0;
  var total = fit1 + fit2 + fit3;
  var counts = { fit1: fit1, fit2: fit2, fit3: fit3 };
  var maxCount = Math.max(fit1, fit2, fit3);

  barRows.forEach(function(row) {
    var fit   = row.dataset.fit;
    var count = counts[fit] || 0;
    var pct   = total > 0 ? Math.round((count / total) * 100) : 0;

    row.querySelector('.bar-fill').style.width = pct + '%';
    row.querySelector('.bar-pct').textContent  = pct + '%';
    row.querySelector('.bar-track').setAttribute('aria-valuenow', pct);

    row.classList.toggle('is-winner', total > 0 && count === maxCount && maxCount > 0);
    row.classList.toggle('is-mine',   fit === votedFit);
  });
}

/* ── UI helpers ────────────────────────────────────────── */
function setButtonLoading(loading) {
  btnVotar.disabled = loading;
  btnVotar.classList.toggle('is-loading', loading);
  btnVotar.setAttribute('aria-disabled', String(loading));
}

function showError(msg) {
  voteError.textContent = msg;
  voteError.hidden = false;
}

function hideError() { voteError.hidden = true; }

/* ── Start ─────────────────────────────────────────────── */
init();
