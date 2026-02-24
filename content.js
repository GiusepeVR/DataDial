(() => {
  // ─── State ────────────────────────────────────────────────────────────────
  let dialEl = null;
  let dialOpen = false;
  let targetInput = null;
  let profiles = [];
  let activeProfileId = 'personal';
  let dialPosition = { x: 0, y: 0 };

  // ─── Field detection map ──────────────────────────────────────────────────
  const FIELD_HINTS = {
    firstName:  ['first', 'fname', 'given', 'firstname', 'first-name', 'first_name', 'givenname'],
    lastName:   ['last', 'lname', 'surname', 'lastname', 'last-name', 'last_name', 'familyname'],
    fullName:   ['fullname', 'full-name', 'full_name', 'name', 'your-name', 'yourname'],
    email:      ['email', 'e-mail', 'mail', 'correo'],
    phone:      ['phone', 'tel', 'mobile', 'cell', 'telefono', 'celular', 'phonenumber'],
    address:    ['address', 'addr', 'street', 'direccion', 'domicilio'],
    city:       ['city', 'ciudad', 'town', 'locality'],
    state:      ['state', 'province', 'region', 'estado'],
    zip:        ['zip', 'postal', 'postcode', 'zipcode', 'cp'],
    country:    ['country', 'pais', 'nation'],
    company:    ['company', 'organization', 'organisation', 'employer', 'empresa'],
  };

  const AUTOCOMPLETE_MAP = {
    'given-name':    'firstName',
    'family-name':   'lastName',
    'name':          'fullName',
    'email':         'email',
    'tel':           'phone',
    'street-address':'address',
    'address-line1': 'address',
    'address-level2':'city',
    'address-level1':'state',
    'postal-code':   'zip',
    'country-name':  'country',
    'organization':  'company',
  };

  // Labels shown in the dial for each field key
  const FIELD_LABELS = {
    firstName: 'First',
    lastName:  'Last',
    fullName:  'Name',
    email:     'Email',
    phone:     'Phone',
    address:   'Address',
    city:      'City',
    state:     'State',
    zip:       'ZIP',
    country:   'Country',
    company:   'Company',
  };

  // Icons (emoji, simple)
  const FIELD_ICONS = {
    firstName: '👤',
    lastName:  '👤',
    fullName:  '👤',
    email:     '✉️',
    phone:     '📞',
    address:   '🏠',
    city:      '🏙️',
    state:     '🗺️',
    zip:       '📮',
    country:   '🌍',
    company:   '🏢',
  };

  // ─── Detect what kind of field a given input is ───────────────────────────
  function detectFieldKey(input) {
    // 1. autocomplete attribute (most reliable)
    const ac = (input.getAttribute('autocomplete') || '').toLowerCase().trim();
    if (ac && AUTOCOMPLETE_MAP[ac]) return AUTOCOMPLETE_MAP[ac];

    // 2. name / id / placeholder / aria-label
    const haystack = [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('data-field'),
    ].filter(Boolean).join(' ').toLowerCase();

    for (const [key, hints] of Object.entries(FIELD_HINTS)) {
      for (const hint of hints) {
        if (haystack.includes(hint)) return key;
      }
    }

    // 3. Check associated <label> text
    let labelText = '';
    if (input.id) {
      const lbl = document.querySelector(`label[for="${input.id}"]`);
      if (lbl) labelText = lbl.textContent.toLowerCase();
    }
    if (!labelText) {
      // Look for wrapping label
      const lbl = input.closest('label');
      if (lbl) labelText = lbl.textContent.toLowerCase();
    }
    if (labelText) {
      for (const [key, hints] of Object.entries(FIELD_HINTS)) {
        for (const hint of hints) {
          if (labelText.includes(hint)) return key;
        }
      }
    }

    return null;
  }

  // ─── Get active profile ───────────────────────────────────────────────────
  function getActiveProfile() {
    return profiles.find(p => p.id === activeProfileId) || profiles[0];
  }

  // ─── Fill a specific field key into target input ──────────────────────────
  function fillField(fieldKey) {
    if (!targetInput) return;
    const profile = getActiveProfile();
    if (!profile) return;
    const value = profile.fields[fieldKey];
    if (value === undefined || value === null) return;

    // Focus input first
    targetInput.focus();

    // Use native input setter to trigger React/Vue reactive bindings
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(targetInput, value);
    } else {
      targetInput.value = value;
    }

    // Dispatch events so frameworks pick up the change
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Visual flash feedback
    targetInput.style.transition = 'background 0.3s';
    targetInput.style.background = '#6EE7B750';
    setTimeout(() => {
      targetInput.style.background = '';
    }, 600);

    closeDial();
  }

  // ─── Build dial petals ────────────────────────────────────────────────────
  function buildPetals(profile) {
    if (!profile) return '';
    const fields = Object.entries(profile.fields).filter(([, v]) => v !== '');
    const count = fields.length;
    const angleStep = 360 / count;
    // Radius in px — petals orbit around the center
    const R = 88;

    return fields.map(([key], i) => {
      const angle = angleStep * i - 90; // start from top
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(R * Math.cos(rad));
      const y = Math.round(R * Math.sin(rad));
      const label = FIELD_LABELS[key] || key;
      const icon  = FIELD_ICONS[key] || '•';

      return `
        <button
          class="fd-petal"
          data-key="${key}"
          style="--tx:${x}px; --ty:${y}px; --delay:${i * 30}ms;"
          title="${label}: ${profile.fields[key]}"
        >
          <span class="fd-petal-icon">${icon}</span>
          <span class="fd-petal-label">${label}</span>
        </button>
      `;
    }).join('');
  }

  // ─── Build profile tabs ───────────────────────────────────────────────────
  function buildProfileTabs() {
    return profiles.map(p => `
      <button
        class="fd-profile-tab ${p.id === activeProfileId ? 'active' : ''}"
        data-profile="${p.id}"
        style="--pcolor: ${p.color}"
      >${p.label}</button>
    `).join('');
  }

  // ─── Create/mount dial ────────────────────────────────────────────────────
  function mountDial() {
    if (dialEl) dialEl.remove();

    const profile = getActiveProfile();

    dialEl = document.createElement('div');
    dialEl.id = 'form-dial-root';
    dialEl.innerHTML = `
      <div class="fd-backdrop"></div>
      <div class="fd-hub" id="fd-hub">
        <div class="fd-petals-ring">
          ${buildPetals(profile)}
        </div>
        <div class="fd-center">
          <div class="fd-logo">⚡</div>
        </div>
        <div class="fd-profiles">
          ${buildProfileTabs()}
        </div>
        <button class="fd-close" id="fd-close">✕</button>
        ${targetInput ? `<div class="fd-target-hint">→ ${targetInput.placeholder || targetInput.name || targetInput.id || 'focused field'}</div>` : ''}
      </div>
    `;

    // Position near click
    const hubSize = 240;
    let x = dialPosition.x - hubSize / 2;
    let y = dialPosition.y - hubSize / 2;
    // Clamp to viewport
    x = Math.max(10, Math.min(x, window.innerWidth - hubSize - 10));
    y = Math.max(10, Math.min(y, window.innerHeight - hubSize - 80));

    const hub = dialEl.querySelector('#fd-hub');
    hub.style.left = x + 'px';
    hub.style.top  = y + 'px';

    document.body.appendChild(dialEl);

    // Animate in
    requestAnimationFrame(() => {
      dialEl.classList.add('fd-open');
    });

    // Events
    dialEl.querySelector('#fd-close').addEventListener('click', closeDial);
    dialEl.querySelector('.fd-backdrop').addEventListener('click', closeDial);

    dialEl.querySelectorAll('.fd-petal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        fillField(btn.dataset.key);
      });
    });

    dialEl.querySelectorAll('.fd-profile-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        activeProfileId = tab.dataset.profile;
        chrome.storage.sync.set({ activeProfile: activeProfileId });
        mountDial(); // re-render
      });
    });
  }

  // ─── Open dial ────────────────────────────────────────────────────────────
  function openDial(x, y, input) {
    targetInput = input;
    dialPosition = { x, y };
    dialOpen = true;
    mountDial();
  }

  // ─── Close dial ───────────────────────────────────────────────────────────
  function closeDial() {
    if (!dialEl) return;
    dialEl.classList.remove('fd-open');
    dialEl.classList.add('fd-closing');
    setTimeout(() => {
      dialEl?.remove();
      dialEl = null;
    }, 280);
    dialOpen = false;
  }

  // ─── Right-click handler ──────────────────────────────────────────────────
  document.addEventListener('contextmenu', (e) => {
    // Only intercept if right-clicking on or near a form input
    const isInput = e.target.matches('input[type="text"], input[type="email"], input[type="tel"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]');
    // Also allow if a form input is currently focused
    const focused = document.activeElement;
    const focusedIsInput = focused && focused.matches('input, textarea, [contenteditable]');

    if (!isInput && !focusedIsInput) return; // let normal context menu show for non-inputs

    e.preventDefault();
    const input = isInput ? e.target : focused;
    openDial(e.clientX, e.clientY, input);
  }, true);

  // ─── Escape to close ──────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialOpen) closeDial();
  });

  // ─── Load profiles from storage ──────────────────────────────────────────
  function loadProfiles() {
    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
      profiles = data.profiles || [];
      activeProfileId = data.activeProfile || (profiles[0]?.id ?? 'personal');
    });
  }

  loadProfiles();

  // Re-load on storage change (options page saved new data)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.profiles) profiles = changes.profiles.newValue;
    if (changes.activeProfile) activeProfileId = changes.activeProfile.newValue;
    if (dialOpen) mountDial();
  });
})();
