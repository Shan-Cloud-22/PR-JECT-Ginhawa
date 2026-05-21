import { supabase } from './supabase-config.js';

// ── DOM REFS ──────────────────────────────────────────────
const loginForm    = document.getElementById('loginForm');
const emailInput   = document.getElementById('emailInput');
const pwdInput     = document.getElementById('pwdInput');
const pwdToggle    = document.getElementById('pwdToggle');
const rememberMe   = document.getElementById('rememberMe');
const loginBtn     = document.getElementById('loginBtn');
const btnText      = document.getElementById('btnText');
const btnSpinner   = document.getElementById('btnSpinner');
const clearBtn     = document.getElementById('clearBtn');
const errorAlert   = document.getElementById('errorAlert');
const errorMsg     = document.getElementById('errorMsg');
const successState = document.getElementById('successState');
const welcomeName  = document.getElementById('welcomeName');
const redirectFill = document.getElementById('redirectFill');

// ── AUTO-FILL IF REMEMBERED ───────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('ginhawa_email');
  if (saved && emailInput) {
    emailInput.value = saved;
    rememberMe.checked = true;
  }
});

// ── PASSWORD TOGGLE ───────────────────────────────────────
pwdToggle?.addEventListener('click', () => {
  const show = pwdInput.type === 'password';
  pwdInput.type = show ? 'text' : 'password';
  pwdToggle.textContent = show ? '🙈' : '👁️';
});

// ── CLEAR ─────────────────────────────────────────────────
clearBtn?.addEventListener('click', () => {
  loginForm.reset();
  hideError();
});

// ── HELPERS ───────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorAlert.classList.add('show');
  loginForm.classList.add('shake');
  setTimeout(() => loginForm.classList.remove('shake'), 450);
}
function hideError() { errorAlert.classList.remove('show'); }
function setLoading(on) {
  loginBtn.disabled   = on;
  btnText.textContent = on ? 'Logging in...' : 'Log In';
  btnSpinner.classList.toggle('show', on);
}

// ── SUBMIT ────────────────────────────────────────────────
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email    = emailInput.value.trim();
  const password = pwdInput.value;

  if (!email || !password) return showError('Please fill in both fields.');

  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Remember-me: persist email to localStorage
    if (rememberMe.checked) {
      localStorage.setItem('ginhawa_email', email);
    } else {
      localStorage.removeItem('ginhawa_email');
    }

    // Fetch profile for the welcome name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', data.user.id)
      .single();

    const firstName = profile?.full_name?.split(' ')[0] ?? 'Kabsuhenyo';

    // Show success card
    loginForm.style.display  = 'none';
    document.querySelector('.form-logo')?.remove();
    document.querySelector('.form-heading')?.remove();
    document.querySelector('.form-subtext')?.remove();
    welcomeName.textContent  = firstName;
    successState.classList.add('show');

    setTimeout(() => { redirectFill.style.width = '100%'; }, 50);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2700);

  } catch (err) {
    const msg =
      err.message.toLowerCase().includes('invalid')
        ? 'Incorrect email or password. Please try again.'
        : err.message || 'Login failed. Please try again.';
    showError(msg);
    setLoading(false);
  }
});

// ── REDIRECT IF ALREADY LOGGED IN ─────────────────────────
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'dashboard.html';
});


// ── REALTIME STATS (info panel) ───────────────────────────
async function loadLoginStats() {
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

    animateCount('login-stat-items',    totalItems ?? 0);
    animateCount('login-stat-resolved', resolved   ?? 0);
    animateCount('login-stat-members',  members    ?? 0);

  } catch (err) {
    console.warn('Stats fetch failed:', err.message);
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1400;
  const start    = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(target * eased);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

window.addEventListener('DOMContentLoaded', () => loadLoginStats());