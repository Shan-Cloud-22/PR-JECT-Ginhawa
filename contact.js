import { supabase } from './supabase-config.js';

const form = document.getElementById('contactForm');
const hub  = document.getElementById('feedback-hub');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const inputs  = form.querySelectorAll('input, select, textarea');
  const name    = inputs[0].value.trim();
  const email   = inputs[1].value.trim();
  const msgType = inputs[2].value;
  const message = inputs[3].value.trim();

  if (!name || !message) {
    alert('Please fill in your name and message.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled    = true;
  submitBtn.textContent = '⏳ Sending...';

  try {
    const { error } = await supabase.from('feedback').insert({
      name,
      email:        email || null,
      message_type: msgType,
      message,
    });

    if (error) throw error;

    // Success UI
    hub.innerHTML = `
      <div style="text-align:center;padding:60px 0;">
        <div style="font-size:3rem;margin-bottom:16px;">🎉</div>
        <h2 style="color:#fff;font-family:'Syne',sans-serif;font-weight:800;margin-bottom:10px;">
          Thanks for reaching out!
        </h2>
        <p style="color:#a0a0b0;max-width:360px;margin:0 auto;line-height:1.65;">
          We appreciate your feedback, ${escHtml(name.split(' ')[0])}. 
          The team will look into it shortly.
        </p>
      </div>`;

  } catch (err) {
    submitBtn.disabled    = false;
    submitBtn.textContent = '✈ Send Message';
    alert('Something went wrong: ' + (err.message || 'Please try again.'));
  }
});

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

  const btn  = document.getElementById('hamburgerBtn');
  const menu = document.getElementById('mobileMenu');
  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    menu.classList.toggle('open');
  });