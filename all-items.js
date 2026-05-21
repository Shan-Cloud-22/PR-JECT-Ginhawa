import { supabase, getProfile } from './supabase-config.js';

// ── GLOBALS ───────────────────────────────────────────────
let currentUser  = null;
let allItems     = [];
let activeFilter = 'all';
let searchQuery  = '';
let sortOrder    = 'recent';
let campusFilter = 'all';

// ── BOOT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Soft auth — page stays visible to guests
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user ?? null;

  populateSidebar();
  bindSidebarToggle();
  bindLogout();
  await fetchItems();
  bindSearchAndFilters();
});

// ── SIDEBAR ───────────────────────────────────────────────
async function populateSidebar() {
  const avatarEl = document.getElementById('userAvatar');
  const nameEl   = document.getElementById('userName');
  const roleEl   = document.querySelector('.user-role');

  if (!currentUser) {
    // Guest state
    if (avatarEl) avatarEl.textContent = '?';
    if (nameEl)   nameEl.textContent   = 'Guest';
    if (roleEl)   roleEl.textContent   = 'Not logged in';
    return;
  }

  try {
    const profile = await getProfile(currentUser.id);
    const initials = profile.full_name
      .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = profile.full_name;
  } catch {}
}

function bindSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.querySelector('.main')?.classList.toggle('expanded');
  });
}

function bindLogout() {
  document.querySelector('[data-tip="Logout"]')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}

// ── DATA FETCH ────────────────────────────────────────────
async function fetchItems() {
  showSkeletons();

  const { data, error } = await supabase
    .from('items_with_reporter')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('itemsGrid').innerHTML = '';
    return;
  }

  allItems = data;
  renderItems();
}

// ── RENDER ────────────────────────────────────────────────
function renderItems() {
  let items = [...allItems];

  if (activeFilter !== 'all') {
    if (activeFilter === 'resolved') {
      items = items.filter(i => i.status === 'Resolved');
    } else {
      items = items.filter(i => i.type.toLowerCase() === activeFilter && i.status !== 'Resolved');
    }
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.campus_location || '').toLowerCase().includes(q) ||
      (i.reporter_name || '').toLowerCase().includes(q)
    );
  }

  if (campusFilter !== 'all') {
    items = items.filter(i => (i.campus_location || '') === campusFilter);
  }

  items.sort((a, b) => {
    const da = new Date(a.created_at), db = new Date(b.created_at);
    return sortOrder === 'oldest' ? da - db : db - da;
  });

  const grid       = document.getElementById('itemsGrid');
  const emptyState = document.getElementById('emptyState');
  const countEl    = document.getElementById('resultsCount');

  countEl.textContent = items.length;

  if (!items.length) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = items.map(buildItemCard).join('');
}

// ── CARD BUILDER ─────────────────────────────────────────
function buildItemCard(item) {
  const isResolved = item.status === 'Resolved';
  const isOwner    = currentUser && item.user_id === currentUser.id;

  const emoji = {
    'Electronics':     '📱',
    'Documents':       '📄',
    'Accessories':     '⌚',
    'Bags & Apparels': '👜',
    'School Supplies': '📚',
    'Others':          '📦',
  }[item.category] || '📦';

  const imgContent = item.image_url
    ? `<img src="${escHtml(item.image_url)}" alt="${escHtml(item.title)}" loading="lazy">`
    : `<span class="card-emoji">${emoji}</span>`;

  const badgeClass = isResolved ? 'badge-resolved'
    : item.type === 'Lost' ? 'badge-lost' : 'badge-found';
  const badgeText  = isResolved ? '✓ Resolved' : item.type;

  // Reporter social links
  const fbLink = item.reporter_facebook
    ? `<a class="reporter-social fb" href="${escHtml(item.reporter_facebook)}" target="_blank" rel="noopener" title="Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
       </a>` : '';

  const igLink = item.reporter_instagram
    ? `<a class="reporter-social ig" href="${escHtml(item.reporter_instagram)}" target="_blank" rel="noopener" title="Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
        </svg>
       </a>` : '';

  const emailLink = item.reporter_email
    ? `<a class="reporter-social em" href="mailto:${escHtml(item.reporter_email)}" title="Email">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
       </a>` : '';

  const hasSocials = fbLink || igLink || emailLink;

  return `
    <div class="item-card" data-id="${item.id}">

      <!-- IMAGE -->
      <div class="item-image">
        ${imgContent}
        <span class="item-status-badge ${badgeClass}">${badgeText}</span>
        <span class="item-category-tag">${escHtml(item.category)}</span>
      </div>

      <!-- BODY -->
      <div class="item-body">

        <!-- Title -->
        <div class="item-title">${escHtml(item.title)}</div>

        <!-- Description -->
        ${item.description
          ? `<div class="item-description">${escHtml(item.description)}</div>`
          : ''}

        <!-- Meta: location + date -->
        <div class="item-meta">
          <div class="meta-row">
            <span class="meta-icon">📍</span>
            <span class="item-location">${escHtml(item.campus_location || 'Location not specified')}</span>
          </div>
          <div class="meta-row">
            <span class="meta-icon">🕐</span>
            <span class="item-date">${formatDate(item.created_at)}</span>
          </div>
        </div>

        <!-- Reporter strip -->
        <div class="reporter-strip">
          <div class="reporter-left">
            <div class="reporter-avatar">${(item.reporter_name || 'U')[0].toUpperCase()}</div>
            <div class="reporter-info">
              <div class="reporter-name">
                ${escHtml(item.reporter_name || 'Unknown')}
                ${isOwner ? '<span class="owner-tag">You</span>' : ''}
              </div>
              <div class="reporter-label">Reporter</div>
            </div>
          </div>
          ${hasSocials
            ? `<div class="reporter-socials">${fbLink}${igLink}${emailLink}</div>`
            : `<span class="no-contact">No contact info</span>`}
        </div>

      </div><!-- end item-body -->

      <!-- FOOTER -->
      <div class="item-footer">
        <button class="btn-view" onclick="openItemModal('${item.id}')">View Details</button>
      </div>
    </div>`;
}

// ── ITEM DETAIL MODAL ─────────────────────────────────────
window.openItemModal = function(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;

  const existing = document.getElementById('itemModal');
  if (existing) existing.remove();

  const isResolved = item.status === 'Resolved';

  const fbLink = item.reporter_facebook
    ? `<a href="${escHtml(item.reporter_facebook)}" target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;
         background:#1877F2;color:#fff;border-radius:10px;font-size:0.8rem;font-weight:700;
         text-decoration:none;">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
         Facebook
       </a>` : '';
  // Around line 255, after fbLink is defined, add:
const igLink = item.reporter_instagram
  ? `<a href="${escHtml(item.reporter_instagram)}" target="_blank" rel="noopener"
       style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;
       background:#E1306C;color:#fff;border-radius:10px;font-size:0.8rem;font-weight:700;
       text-decoration:none;">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></svg>
       Instagram
     </a>` : '';

const emailLink = item.reporter_email
  ? `<a href="mailto:${escHtml(item.reporter_email)}"
       style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;
       background:#6366F1;color:#fff;border-radius:10px;font-size:0.8rem;font-weight:700;
       text-decoration:none;">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
       Email
     </a>` : '';

  const modal = document.createElement('div');
  modal.id = 'itemModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(26,26,46,0.7);backdrop-filter:blur(8px);padding:20px;animation:fadeIn .2s ease;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;max-width:560px;width:100%;
         max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);
         animation:slideUp .25s ease;">

      <!-- Header image -->
      <div style="height:220px;background:linear-gradient(135deg,var(--indigo-pale),var(--mint-soft));
           display:flex;align-items:center;justify-content:center;font-size:4rem;
           border-radius:24px 24px 0 0;overflow:hidden;position:relative;">
        ${item.image_url
          ? `<img src="${escHtml(item.image_url)}" style="width:100%;height:100%;object-fit:cover;">`
          : ({'Electronics':'📱','Documents':'📄','Accessories':'⌚','Bags & Apparels':'👜','School Supplies':'📚'}[item.category] || '📦')}
        <span style="position:absolute;top:14px;right:14px;padding:6px 14px;border-radius:50px;
             background:${isResolved ? 'rgba(34,197,94,0.9)' : item.type === 'Lost' ? 'rgba(79,70,229,0.9)' : 'rgba(45,138,95,0.85)'};
             color:#fff;font-size:0.72rem;font-weight:700;text-transform:uppercase;">
          ${isResolved ? '✓ Resolved' : item.type}
        </span>
        <button onclick="document.getElementById('itemModal').remove()"
          style="position:absolute;top:14px;left:14px;width:32px;height:32px;border-radius:50%;
          background:rgba(255,255,255,0.9);border:none;cursor:pointer;font-size:1rem;
          display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Body -->
      <div style="padding:28px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <h2 style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem;
               color:var(--text-dark);line-height:1.2;">${escHtml(item.title)}</h2>
          <span style="flex-shrink:0;padding:4px 10px;border-radius:6px;background:var(--indigo-pale);
               color:var(--indigo);font-size:0.72rem;font-weight:700;">${escHtml(item.category)}</span>
        </div>

        ${item.description ? `
          <p style="font-size:0.9rem;color:var(--text-mid);line-height:1.7;margin-bottom:20px;">
            ${escHtml(item.description)}
          </p>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div style="background:var(--cream);border-radius:12px;padding:14px;">
            <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;
                 color:var(--text-light);margin-bottom:4px;">Last seen at</div>
            <div style="font-size:0.875rem;color:var(--text-dark);font-weight:500;">
              📍 ${escHtml(item.campus_location || 'Not specified')}
            </div>
          </div>
          <div style="background:var(--cream);border-radius:12px;padding:14px;">
            <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;
                 color:var(--text-light);margin-bottom:4px;">Date Reported</div>
            <div style="font-size:0.875rem;color:var(--text-dark);font-weight:500;">
              🕐 ${formatDate(item.created_at)}
            </div>
          </div>
        </div>

        <!-- Reporter -->
        <div style="background:var(--indigo-pale);border-radius:16px;padding:18px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--indigo);
                 display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;
                 font-weight:800;font-size:1rem;color:#fff;flex-shrink:0;">
              ${(item.reporter_name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;color:var(--text-dark);">
                ${escHtml(item.reporter_name || 'Unknown reporter')}
              </div>
              <div style="font-size:0.75rem;color:var(--text-mid);margin-top:2px;">
                ${escHtml(item.reporter_college || 'Reporter')}
              </div>
            </div>
          </div>
          <!-- Social buttons row -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${fbLink || igLink || emailLink
              ? fbLink + igLink + emailLink
              : `<span style="font-size:0.78rem;color:var(--text-light);">No contact info available</span>`}
          </div>
        </div>
      </div>
    </div>`;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
};

// ── SEARCH & FILTERS ─────────────────────────────────────
function bindSearchAndFilters() {
  let debounceTimer;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      updateActiveFilterTags();
      renderItems();
    }, 250);
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      updateActiveFilterTags();
      renderItems();
    });
  });

  document.getElementById('sortDropdown')?.addEventListener('change', (e) => {
    sortOrder = e.target.value;
    renderItems();
  });

  document.getElementById('campusFilter')?.addEventListener('change', (e) => {
    campusFilter = e.target.value;
    updateActiveFilterTags();
    renderItems();
  });
}

function updateActiveFilterTags() {
  const container = document.getElementById('activeFilters');
  if (!container) return;
  const tags = [];
  if (activeFilter !== 'all') tags.push(`Type: ${capitalize(activeFilter)}`);
  if (searchQuery)             tags.push(`Search: "${searchQuery}"`);
  if (campusFilter !== 'all')  tags.push(`Campus: ${campusFilter}`);
  container.innerHTML = tags
    .map(t => `<span class="filter-tag">${escHtml(t)} <button onclick="clearTag('${t}')">×</button></span>`)
    .join('');
}

window.clearTag = function(tag) {
  if (tag.startsWith('Type:')) {
    activeFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });
  } else if (tag.startsWith('Search:')) {
    searchQuery = '';
    document.getElementById('searchInput').value = '';
  } else if (tag.startsWith('Campus:')) {
    campusFilter = 'all';
    const cf = document.getElementById('campusFilter');
    if (cf) cf.value = 'all';
  }
  updateActiveFilterTags();
  renderItems();
};

// ── SKELETONS ─────────────────────────────────────────────
function showSkeletons() {
  document.getElementById('itemsGrid').innerHTML = Array(6).fill(0).map(() =>
    `<div class="item-card loading-skeleton" style="min-height:300px;"></div>`
  ).join('');
  document.getElementById('emptyState').style.display = 'none';
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}