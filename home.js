import { supabase } from './supabase-config.js';

window.addEventListener('DOMContentLoaded', async () => {
  await updateNavForAuth();
  bindCTAButtons();
  bindCategoryCards();
  loadImpactStats();
});

// ── AUTH-AWARE NAV ────────────────────────────────────────
async function updateNavForAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  const navAuth = document.querySelector('.nav-auth');
  if (!navAuth) return;

  if (user) {
    // Replace Log In / Sign Up with Dashboard link
    navAuth.innerHTML = `
      <a href="dashboard.html" class="btn-solid">My Dashboard →</a>`;
  }
}

// ── CTA BUTTONS ───────────────────────────────────────────
function bindCTAButtons() {
  // Browse Lost & Found → always goes to items page
  document.querySelector('.cta-lost')?.addEventListener('click', () => {
    window.location.href = 'items.html';
  });

  // Join the Community → always goes to sign up
  document.querySelector('.cta-found')?.addEventListener('click', () => {
    window.location.href = 'signin.html';
  });
}

// ── CATEGORY CARDS ────────────────────────────────────────
function bindCategoryCards() {
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.querySelector('.cat-name')?.textContent || '';
      window.location.href = `pages/all-items.html?category=${encodeURIComponent(cat)}`;
    });
    card.style.cursor = 'pointer';
  });
}


// ── REALTIME IMPACT STATS ─────────────────────────────────
async function loadImpactStats() {
  try {
    const [
      { count: totalItems },
      { count: resolved },
      { count: members }
    ] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'Resolved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    animateCount('stat-items',    totalItems ?? 0);
    animateCount('stat-resolved', resolved   ?? 0);
    animateCount('stat-members',  members    ?? 0);

    // Trust score = resolved / total as percentage
    const trustEl = document.getElementById('stat-trust');
    if (trustEl) {
      const pct = totalItems > 0 ? Math.round((resolved / totalItems) * 100) : 0;
      trustEl.textContent = pct + '%';
    }

  } catch (err) {
    console.warn('Stats fetch failed:', err.message);
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1400;
  const start    = performance.now();
  const from     = 0;

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}


  const btn  = document.getElementById('hamburgerBtn');
  const menu = document.getElementById('mobileMenu');
  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    menu.classList.toggle('open');
  });
