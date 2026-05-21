import { supabase, IMAGE_BUCKET, requireAuth, getProfile } from './supabase-config.js';

// ── GLOBALS ───────────────────────────────────────────────
let currentUser    = null;
let userProfile    = null;
let allMyReports   = [];
let reportFilter   = 'all';
let uploadedImgUrl = null;

// ── BOOT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  currentUser  = await requireAuth();
  userProfile  = await getProfile(currentUser.id);

  populateSidebar();
  await loadOverview();
  bindSidebarNav();
  bindSidebarToggle();
  bindCreateReport();
  bindMyReportsFilters();
  bindLogout();
  bindImageUpload();
});

// ── SIDEBAR POPULATION ────────────────────────────────────
function populateSidebar() {
  const initials = userProfile.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  document.getElementById('sidebarAvatar').textContent  = initials;
  document.getElementById('sidebarName').textContent    = userProfile.full_name;
  document.getElementById('sidebarCollege').textContent = userProfile.college_dept;
  document.getElementById('topbarName').innerHTML       = userProfile.full_name.split(' ')[0];
}

// ── SIDEBAR TOGGLE ────────────────────────────────────────
function bindSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('mainContent');
  document.getElementById('toggleBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
  });
}

// ── PANEL NAVIGATION ─────────────────────────────────────
function bindSidebarNav() {
  document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => {
      const panel = item.dataset.panel;
      if (panel) switchPanel(panel);
    });
  });
}

window.switchPanel = function(panelId) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-panel="${panelId}"]`)?.classList.add('active');

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${panelId}`)?.classList.add('active');

  const labels = {
    overview:  ['Overview',      'Welcome to your personal dashboard'],
    create:    ['Create Report', 'Post a new lost or found item'],
    myreports: ['My Reports',    'Track and manage your submitted reports'],
  };
  const [title, sub] = labels[panelId] || ['Dashboard', ''];
  document.getElementById('panelTitle').textContent = title;
  document.getElementById('panelSub').textContent   = sub;

  if (panelId === 'myreports') renderMyReports();
};

// ── OVERVIEW ──────────────────────────────────────────────
async function loadOverview() {
  const { data: items, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  allMyReports = items;

  const total    = items.length;
  const active   = items.filter(i => i.status === 'Searching').length;
  const resolved = items.filter(i => i.status === 'Resolved').length;
  const found    = items.filter(i => i.type === 'Found').length;

  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statActive').textContent   = active;
  document.getElementById('statResolved').textContent = resolved;
  document.getElementById('statFound').textContent    = found;
  document.getElementById('reportsBadge').textContent = total;

  const container = document.getElementById('recentActivity');
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:30px 20px;">
        <div class="empty-icon">📋</div>
        <h3>No reports yet</h3>
        <p>Create your first report using the sidebar!</p>
      </div>`;
    return;
  }

  container.innerHTML = items.slice(0, 5).map(item => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
         border-bottom:1px solid rgba(0,0,0,0.04);">
      <div style="width:36px;height:36px;border-radius:10px;flex-shrink:0;
           background:${item.type === 'Lost' ? 'var(--indigo-pale)' : 'var(--mint-soft)'};
           display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
        ${item.type === 'Lost' ? '🔍' : '🌿'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.85rem;
             color:var(--text-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escHtml(item.title)}
        </div>
        <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px;">
          ${item.type} · ${item.category} · ${formatDate(item.created_at)}
        </div>
      </div>
      <span style="font-size:0.68rem;font-weight:700;padding:3px 8px;border-radius:50px;
           background:${item.status === 'Resolved' ? 'var(--success-pale)' : 'var(--indigo-pale)'};
           color:${item.status === 'Resolved' ? '#166534' : 'var(--indigo)'};">
        ${item.status}
      </span>
    </div>
  `).join('');
}

// ── CREATE REPORT ─────────────────────────────────────────
window.setReportType = function(type) {
  document.getElementById('reportType').value = type;
  const lostBtn  = document.getElementById('typeLost');
  const foundBtn = document.getElementById('typeFound');
  lostBtn.className  = 'type-btn' + (type === 'Lost'  ? ' active-lost'  : '');
  foundBtn.className = 'type-btn' + (type === 'Found' ? ' active-found' : '');
};

window.resetReportForm = function() {
  document.getElementById('reportForm').reset();
  setReportType('Lost');
  uploadedImgUrl = null;
  document.getElementById('uploadPreview').style.display  = 'none';
  document.getElementById('uploadPrompt').style.display   = 'block';
  document.getElementById('uploadProgress').style.display = 'none';
  hideAlert('reportError');
  hideAlert('reportSuccess');
};

function bindCreateReport() {
  document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title    = document.getElementById('itemTitle').value.trim();
    const category = document.getElementById('itemCategory').value;
    const location = document.getElementById('campusLocation').value;
    const details  = document.getElementById('itemDetails').value.trim();
    const type     = document.getElementById('reportType').value;

    if (!title || !category || !location || !details) {
      showAlert('reportError', 'Please fill in all required fields.');
      return;
    }

    const submitBtn = document.getElementById('submitReportBtn');
    const submitTxt = document.getElementById('submitText');
    const spinner   = document.getElementById('submitSpinner');
    submitBtn.disabled    = true;
    submitTxt.textContent = 'Submitting...';
    spinner.classList.add('show');
    hideAlert('reportError');

    try {
      let imageUrl = null;
      const fileInput = document.getElementById('itemPhoto');
      if (fileInput.files[0]) {
        imageUrl = await uploadItemImage(fileInput.files[0]);
      }

      const { error } = await supabase.from('items').insert({
        user_id:         currentUser.id,
        title,
        category,
        campus_location: location,
        description:     details,
        type,
        status:          'Searching',
        image_url:       imageUrl,
      });

      if (error) throw error;

      showAlert('reportSuccess');
      setTimeout(resetReportForm, 1000);
      await loadOverview();

    } catch (err) {
      showAlert('reportError', err.message || 'Submission failed. Please try again.');
    } finally {
      submitBtn.disabled    = false;
      submitTxt.textContent = 'Submit Report';
      spinner.classList.remove('show');
    }
  });
}

// ── IMAGE UPLOAD ──────────────────────────────────────────
function bindImageUpload() {
  const zone      = document.getElementById('uploadZone');
  const fileInput = document.getElementById('itemPhoto');
  const preview   = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('previewImg');
  const prompt    = document.getElementById('uploadPrompt');
  const progress  = document.getElementById('uploadProgress');
  const removeBtn = document.getElementById('removeImg');

  zone?.addEventListener('click', () => fileInput.click());
  zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showAlert('reportError', 'Image must be under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      previewImg.src        = ev.target.result;
      prompt.style.display  = 'none';
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value        = '';
    previewImg.src         = '';
    preview.style.display  = 'none';
    prompt.style.display   = 'block';
    progress.style.display = 'none';
    uploadedImgUrl         = null;
  });
}

async function uploadItemImage(file) {
  const ext  = file.name.split('.').pop();
  const path = `${currentUser.id}/${Date.now()}.${ext}`;

  const progress = document.getElementById('uploadProgress');
  const fill     = document.getElementById('progressFill');
  const label    = document.getElementById('progressLabel');
  progress.style.display = 'block';
  fill.style.width       = '30%';
  label.textContent      = 'Uploading image...';

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  fill.style.width  = '100%';
  label.textContent = 'Upload complete ✓';
  setTimeout(() => { progress.style.display = 'none'; }, 1500);

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── MY REPORTS ────────────────────────────────────────────
function bindMyReportsFilters() {
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reportFilter = btn.dataset.filter;
      renderMyReports();
    });
  });
}

async function renderMyReports() {
  const grid = document.getElementById('reportsGrid');
  grid.innerHTML = '<div class="loading-state">Loading your reports...</div>';

  const { data: items, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = '<div class="loading-state">Failed to load reports.</div>';
    return;
  }

  allMyReports = items;
  const filtered = reportFilter === 'all'
    ? items
    : items.filter(i => i.status === reportFilter);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">📭</div>
        <h3>No reports found</h3>
        <p>You have no ${reportFilter === 'all' ? '' : reportFilter.toLowerCase()} reports yet.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => buildReportCard(item)).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleReportAction(btn.dataset.action, btn.dataset.id));
  });
}

function buildReportCard(item) {
  const isResolved = item.status === 'Resolved';
  const imgContent = item.image_url
    ? `<img src="${escHtml(item.image_url)}" alt="${escHtml(item.title)}" loading="lazy">`
    : (item.category === 'Electronics'     ? '📱' :
       item.category === 'Documents'       ? '📄' :
       item.category === 'Accessories'     ? '⌚' :
       item.category === 'Bags & Apparels' ? '👜' :
       item.category === 'School Supplies' ? '📚' : '📦');

  return `
    <div class="report-card">
      <div class="report-card-img">
        ${imgContent}
        <span class="report-type-badge badge-${item.type.toLowerCase()}">${item.type}</span>
        ${isResolved ? `<span class="report-type-badge badge-resolved" style="left:auto;right:10px;">✓ Resolved</span>` : ''}
      </div>
      <div class="report-card-body">
        <div class="report-card-title">${escHtml(item.title)}</div>
        <div class="report-card-meta">
          <span>📍 ${escHtml(item.campus_location || 'Unknown location')}</span>
          &nbsp;·&nbsp;
          <span>🏷 ${escHtml(item.category)}</span>
          &nbsp;·&nbsp;
          <span>${formatDate(item.created_at)}</span>
        </div>
        ${item.description ? `<p class="report-card-desc">${escHtml(item.description.slice(0, 120))}${item.description.length > 120 ? '…' : ''}</p>` : ''}
      </div>
      <div class="report-card-actions">
        ${isResolved
          ? `<button class="action-btn action-reopen"  data-action="reopen"  data-id="${item.id}">🔄 Reopen</button>`
          : `<button class="action-btn action-resolve" data-action="resolve" data-id="${item.id}">✅ Mark Resolved</button>`}
        <button class="action-btn action-delete" data-action="delete" data-id="${item.id}">🗑 Delete</button>
      </div>
    </div>`;
}

async function handleReportAction(action, id) {
  if (action === 'delete') {
    if (!confirm('Delete this report permanently? This cannot be undone.')) return;

    const item = allMyReports.find(i => i.id === id);
    if (item?.image_url) {
      const path = item.image_url.split(`/${IMAGE_BUCKET}/`)[1];
      if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    }

    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) return showToast('Delete failed: ' + error.message, 'error');
    showToast('Report deleted.', 'success');

  } else if (action === 'resolve') {
    const { error } = await supabase.from('items').update({ status: 'Resolved' }).eq('id', id);
    if (error) return showToast('Update failed: ' + error.message, 'error');
    showToast('Marked as Resolved! 🎉', 'success');

  } else if (action === 'reopen') {
    const { error } = await supabase.from('items').update({ status: 'Searching' }).eq('id', id);
    if (error) return showToast('Update failed: ' + error.message, 'error');
    showToast('Report reopened.', 'info');
  }

  await loadOverview();
  await renderMyReports();
}

// ── LOGOUT ────────────────────────────────────────────────
function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}

// ── UTILS ─────────────────────────────────────────────────
function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg) {
    const msgEl = el.querySelector('span:last-child') || el;
    msgEl.textContent = msg;
  }
  el.classList.add('show');
}

function hideAlert(id) {
  document.getElementById(id)?.classList.remove('show');
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}