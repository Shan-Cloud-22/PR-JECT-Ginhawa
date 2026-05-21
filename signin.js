import { supabase } from './supabase-config.js';

// ── DOM REFS ──────────────────────────────────────────────
const form        = document.getElementById('registerForm');
const btnText     = document.getElementById('btnText');
const btnSpinner  = document.getElementById('btnSpinner');
const registerBtn = document.getElementById('registerBtn');
const clearBtn    = document.getElementById('clearBtn');
const pwdToggle   = document.getElementById('pwdToggle');
const pwdInput    = document.getElementById('password');
const pwdFill     = document.getElementById('pwdFill');
const pwdLabel    = document.getElementById('pwdLabel');
const errorAlert  = document.getElementById('errorAlert');
const errorMsg    = document.getElementById('errorMsg');
const successState = document.getElementById('successState');
const successName  = document.getElementById('successName');
const redirectFill = document.getElementById('redirectFill');

// ── PASSWORD STRENGTH ─────────────────────────────────────
pwdInput?.addEventListener('input', () => {
  const val = pwdInput.value;
  let strength = 0;
  if (val.length >= 6) strength++;
  if (val.length >= 10) strength++;
  if (/[A-Z]/.test(val)) strength++;
  if (/[0-9]/.test(val)) strength++;
  if (/[^A-Za-z0-9]/.test(val)) strength++;

  const pct = (strength / 5) * 100;
  pwdFill.style.width = pct + '%';
  const colors = ['#EF4444','#F97316','#EAB308','#22C55E','#16A34A'];
  const labels = ['Too weak','Weak','Fair','Strong','Very strong'];
  pwdFill.style.background = colors[strength - 1] || '#e5e7eb';
  pwdLabel.textContent = labels[strength - 1] || 'Enter a password';
});

// ── PASSWORD VISIBILITY ───────────────────────────────────
pwdToggle?.addEventListener('click', () => {
  const show = pwdInput.type === 'password';
  pwdInput.type = show ? 'text' : 'password';
  pwdToggle.textContent = show ? '🙈' : '👁️';
});

// ── CLEAR BUTTON ──────────────────────────────────────────
clearBtn?.addEventListener('click', () => {
  form.reset();
  pwdFill.style.width = '0%';
  pwdLabel.textContent = 'Enter a password';
  hideError();
});

// ── HELPERS ───────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorAlert.classList.add('show');
}
function hideError() {
  errorAlert.classList.remove('show');
}
function setLoading(on) {
  registerBtn.disabled = on;
  btnText.textContent  = on ? 'Creating Account...' : 'Register Account';
  btnSpinner.classList.toggle('show', on);
}

// ── FORM SUBMIT ───────────────────────────────────────────
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const fullName   = document.getElementById('fullName').value.trim();
  const college    = document.getElementById('collegeDept').value;
  const social     = document.getElementById('socialMedia').value.trim();
  const email      = document.getElementById('emailAddress').value.trim();
  const password   = pwdInput.value;

  // Client-side validation
  if (!fullName)  return showError('Please enter your full name.');
  if (!college)   return showError('Please select your college / department.');
  if (!email)     return showError('Please enter a valid email address.');
  if (password.length < 6) return showError('Password must be at least 6 characters.');

  setLoading(true);

  try {
    // 1. Create the auth user, passing metadata for the trigger
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name:    fullName,
          college_dept: college,
          facebook_link: social || null,
        }
      }
    });

    if (error) throw error;

    // 2. Show success state
    form.style.display       = 'none';
    successName.textContent  = fullName.split(' ')[0];
    successState.classList.add('show');

    // 3. Animate redirect bar, then send to login
    setTimeout(() => { redirectFill.style.width = '100%'; }, 50);
    setTimeout(() => { window.location.href = 'login.html'; }, 3200);

  } catch (err) {
    const msg =
      err.message.includes('already registered')
        ? 'This email is already registered. Try logging in.'
        : err.message || 'Registration failed. Please try again.';
    showError(msg);
    setLoading(false);
  }
});
