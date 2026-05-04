const FIELD_DEFS = [
  { key: 'firstName', label: 'First Name',    type: 'text'  },
  { key: 'lastName',  label: 'Last Name',     type: 'text'  },
  { key: 'fullName',  label: 'Full Name',     type: 'text'  },
  { key: 'email',     label: 'Email',         type: 'email' },
  { key: 'phone',     label: 'Phone',         type: 'tel'   },
  { key: 'address',   label: 'Street Address',type: 'text'  },
  { key: 'city',      label: 'City',          type: 'text'  },
  { key: 'state',     label: 'State',         type: 'text'  },
  { key: 'zip',       label: 'ZIP / Postal',  type: 'text'  },
  { key: 'country',   label: 'Country',       type: 'text'  },
  { key: 'company',   label: 'Company',       type: 'text'  },
];

const PROFILE_COLORS = ['#6EE7B7', '#93C5FD', '#F9A8D4', '#FCD34D', '#A78BFA', '#FB923C'];

let profiles = [];
let activeProfileId = '';

function renderTabs() {
  const tabs = document.getElementById('profileTabs');
  tabs.innerHTML = profiles.map(p => `
    <button class="tab-btn ${p.id === activeProfileId ? 'active' : ''}" data-id="${p.id}" style="--pcolor: ${p.color}">${escapeHtml(p.label)}</button>
  `).join('') + `<button class="add-profile-btn" id="addProfileBtn">+ Profile</button>`;

  tabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      collectCurrentProfile();
      activeProfileId = btn.dataset.id;
      renderTabs();
      renderPanel();
    });
  });

  document.getElementById('addProfileBtn').addEventListener('click', () => {
    collectCurrentProfile();
    const id = 'profile_' + Date.now();
    profiles.push({
      id,
      label: 'New Profile',
      color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
      fields: Object.fromEntries(FIELD_DEFS.map(f => [f.key, ''])),
    });
    activeProfileId = id;
    renderTabs();
    renderPanel();
  });
}

function renderPanel() {
  const panel = document.getElementById('profilePanel');
  const profile = profiles.find(p => p.id === activeProfileId);
  if (!profile) { panel.innerHTML = ''; return; }

  panel.innerHTML = `
    <div class="profile-header">
      <input class="profile-label-input" id="profileLabel" value="${escapeHtml(profile.label)}" placeholder="Profile name" />
      <div class="color-dot" id="colorDot" style="background: ${profile.color}" title="Click to cycle color"></div>
      ${profiles.length > 1
        ? `<button class="delete-profile-btn" id="deleteProfileBtn" title="Delete this profile">Delete</button>`
        : ''}
    </div>
    <div class="fields-grid">
      ${FIELD_DEFS.map(f => `
        <div class="field-group">
          <label for="field_${f.key}">${f.label}</label>
          <input type="${f.type}" id="field_${f.key}" value="${escapeHtml(profile.fields[f.key] || '')}" placeholder="${f.label}" autocomplete="off" />
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('profileLabel').addEventListener('input', (e) => {
    profile.label = e.target.value;
    const tab = document.querySelector(`.tab-btn[data-id="${profile.id}"]`);
    if (tab) tab.textContent = profile.label;
  });

  document.getElementById('colorDot').addEventListener('click', () => {
    const idx = PROFILE_COLORS.indexOf(profile.color);
    profile.color = PROFILE_COLORS[(idx + 1) % PROFILE_COLORS.length];
    document.getElementById('colorDot').style.background = profile.color;
    const tab = document.querySelector(`.tab-btn[data-id="${profile.id}"]`);
    if (tab) tab.style.setProperty('--pcolor', profile.color);
  });

  var deleteBtn = document.getElementById('deleteProfileBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    if (!confirm(`Delete profile "${profile.label}"?`)) return;
    profiles = profiles.filter(p => p.id !== activeProfileId);
    activeProfileId = (profiles[0] && profiles[0].id) || '';
    renderTabs();
    renderPanel();
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function collectCurrentProfile() {
  const profile = profiles.find(p => p.id === activeProfileId);
  if (!profile) return;
  var labelEl = document.getElementById('profileLabel');
  profile.label = (labelEl && labelEl.value) || profile.label;
  for (const f of FIELD_DEFS) {
    const el = document.getElementById('field_' + f.key);
    if (el) profile.fields[f.key] = el.value;
  }
}

document.getElementById('saveBtn').addEventListener('click', () => {
  collectCurrentProfile();
  StorageLayer.saveProfiles(profiles, activeProfileId).then(() => {
    const status = document.getElementById('status');
    status.textContent = '✓ Saved!';
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 2000);
  });
});

// --- Auth UI ---

function renderAuthSection(status) {
  const section = document.getElementById('authSection');
  if (status.signedIn) {
    const ago = status.lastSyncedAt
      ? timeAgo(status.lastSyncedAt)
      : 'never';
    section.innerHTML = `
      <div class="user-info">
        ${status.photoUrl ? `<img class="user-avatar" src="${status.photoUrl}" alt="" />` : ''}
        <div>
          <div class="user-email">${escapeHtml(status.email)}</div>
          <div class="sync-status">Last synced: ${ago}</div>
        </div>
      </div>
      <button class="sync-btn" id="syncNowBtn">Sync Now</button>
      <button class="sign-out-btn" id="signOutBtn">Sign Out</button>
    `;
    document.getElementById('syncNowBtn').addEventListener('click', () => {
      collectCurrentProfile();
      StorageLayer.pushToCloud().then(() => refreshAuthUI());
    });
    document.getElementById('signOutBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'signOut' }, () => refreshAuthUI());
    });
  } else {
    section.innerHTML = `
      <button class="google-btn" id="googleSignInBtn">Sign in with Google</button>
      <span class="sync-status">Sync profiles across devices</span>
    `;
    document.getElementById('googleSignInBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'signIn' }, (res) => {
        if (res && !res.error) {
          StorageLayer.getProfiles().then((data) => {
            profiles = data.profiles;
            activeProfileId = data.activeProfileId || (profiles[0] && profiles[0].id) || '';
            renderTabs();
            renderPanel();
          });
        }
        refreshAuthUI();
      });
    });
  }
}

function refreshAuthUI() {
  chrome.runtime.sendMessage({ type: 'getAuthState' }, (status) => {
    renderAuthSection(status || { signedIn: false });
  });
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// --- Init ---

StorageLayer.getProfiles().then((data) => {
  profiles        = data.profiles;
  activeProfileId = data.activeProfileId || (profiles[0] && profiles[0].id) || '';
  renderTabs();
  renderPanel();
});

refreshAuthUI();
