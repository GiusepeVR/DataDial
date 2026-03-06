(() => {
  // ─── State ────────────────────────────────────────────────────────────────
  let dialEl       = null;
  let dialOpen     = false;
  let targetInput  = null;
  let profiles     = [];
  let activeProfileId = 'personal';
  let dialPosition = { x: 0, y: 0 };

  const iconMap = new WeakMap(); // input → icon div
  let currentIconInput = null;


  // ─── Input selector ───────────────────────────────────────────────────────
  const INPUT_SELECTOR = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="search"]',
    'input[type="url"]',
    'input:not([type])',
    'textarea',
  ].join(', ');

  function isFormInput(el) {
    return el && typeof el.matches === 'function'
      && el.matches(INPUT_SELECTOR)
      && !el.readOnly
      && !el.disabled;
  }

  // ─── Field maps ───────────────────────────────────────────────────────────
  const FIELD_HINTS = {
    firstName: ['first', 'fname', 'given', 'firstname', 'first-name', 'first_name', 'givenname'],
    lastName:  ['last', 'lname', 'surname', 'lastname', 'last-name', 'last_name', 'familyname'],
    fullName:  ['fullname', 'full-name', 'full_name', 'name', 'your-name', 'yourname'],
    email:     ['email', 'e-mail', 'mail', 'correo'],
    phone:     ['phone', 'tel', 'mobile', 'cell', 'telefono', 'celular', 'phonenumber'],
    address:   ['address', 'addr', 'street', 'direccion', 'domicilio'],
    city:      ['city', 'ciudad', 'town', 'locality'],
    state:     ['state', 'province', 'region', 'estado'],
    zip:       ['zip', 'postal', 'postcode', 'zipcode', 'cp'],
    country:   ['country', 'pais', 'nation'],
    company:   ['company', 'organization', 'organisation', 'employer', 'empresa'],
  };

  const AUTOCOMPLETE_MAP = {
    'given-name':     'firstName',
    'family-name':    'lastName',
    'name':           'fullName',
    'email':          'email',
    'tel':            'phone',
    'street-address': 'address',
    'address-line1':  'address',
    'address-level2': 'city',
    'address-level1': 'state',
    'postal-code':    'zip',
    'country-name':   'country',
    'organization':   'company',
  };

  const FIELD_LABELS = {
    firstName: 'First',   lastName: 'Last',    fullName: 'Name',
    email:     'Email',   phone:    'Phone',   address:  'Address',
    city:      'City',    state:    'State',   zip:      'ZIP',
    country:   'Country', company:  'Company',
  };

  const FIELD_ICONS = {
    firstName: '\u{1F464}', lastName: '\u{1F464}', fullName: '\u{1F464}',
    email:     '\u2709\uFE0F',
    phone:     '\u{1F4DE}',
    address:   '\u{1F3E0}',
    city:      '\u{1F3D9}\uFE0F',
    state:     '\u{1F5FA}\uFE0F',
    zip:       '\u{1F4EE}',
    country:   '\u{1F30D}',
    company:   '\u{1F3E2}',
  };

  // ─── Floating trigger icon ─────────────────────────────────────────────────
  // Technique: plain <div> appended to <html>, all styles set via
  // style.setProperty(..., 'important') so no page stylesheet can interfere.
  // Uses a 🤡 emoji as a placeholder so we can tell at a glance whether the
  // injection itself works.  Replace with the SVG once confirmed working.

  function iconStyle(el, prop, val) {
    el.style.setProperty(prop, val, 'important');
  }

  function applyBaseStyles(icon, top, left) {
    iconStyle(icon, 'position',        'fixed');
    iconStyle(icon, 'z-index',         '2147483647');
    iconStyle(icon, 'top',             top  + 'px');
    iconStyle(icon, 'left',            left + 'px');
    iconStyle(icon, 'width',           '24px');
    iconStyle(icon, 'height',          '24px');
    iconStyle(icon, 'border-radius',   '50%');
    iconStyle(icon, 'background',      'rgba(10,22,40,0.92)');
    iconStyle(icon, 'border',          '1.5px solid rgba(110,231,183,0.7)');
    iconStyle(icon, 'color',           '#6EE7B7');
    iconStyle(icon, 'display',         'flex');
    iconStyle(icon, 'align-items',     'center');
    iconStyle(icon, 'justify-content', 'center');
    iconStyle(icon, 'cursor',          'pointer');
    iconStyle(icon, 'pointer-events',  'auto');
    iconStyle(icon, 'user-select',     'none');
    iconStyle(icon, 'box-sizing',      'border-box');
    iconStyle(icon, 'box-shadow',      '0 2px 8px rgba(0,0,0,0.5)');
    iconStyle(icon, 'overflow',        'hidden');
    iconStyle(icon, 'padding',         '0');
    iconStyle(icon, 'margin',          '0');
    iconStyle(icon, 'outline',         'none');
    iconStyle(icon, 'transition',      'transform 0.12s ease, opacity 0.12s ease');
  }

  function iconCoords(input) {
    const r = input.getBoundingClientRect();
    return {
      top:    r.top  - 12,   // centered on the top edge
      left:   r.left - 12,   // centered on the left edge
      inView: r.bottom > 0 && r.top < window.innerHeight,
    };
  }

  function showTriggerIcon(input) {
    if (iconMap.has(input)) {
      const icon = iconMap.get(input);
      const { top, left, inView } = iconCoords(input);
      iconStyle(icon, 'top',  top  + 'px');
      iconStyle(icon, 'left', left + 'px');
      iconStyle(icon, 'display', inView ? 'block' : 'none');
      return;
    }

    const { top, left } = iconCoords(input);

    const icon = document.createElement('div');
    icon.setAttribute('data-datadial', '1');
    applyBaseStyles(icon, top, left);

    // Inline SVG — no external resource, immune to CSP img-src rules
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

    icon.addEventListener('mousedown', (e) => e.preventDefault());
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = input.getBoundingClientRect();
      openDial(r.left + r.width / 2, r.top + r.height / 2, input);
    });
    icon.addEventListener('mouseenter', () => {
      iconStyle(icon, 'transform', 'scale(1.15)');
      iconStyle(icon, 'opacity',   '1');
    });
    icon.addEventListener('mouseleave', () => {
      iconStyle(icon, 'transform', 'scale(1)');
      iconStyle(icon, 'opacity',   '0.88');
    });

    document.documentElement.appendChild(icon);
    iconMap.set(input, icon);
    currentIconInput = input;
  }

  function hideTriggerIcon(input) {
    const icon = iconMap.get(input);
    if (!icon) return;
    icon.remove();
    iconMap.delete(input);
    if (currentIconInput === input) currentIconInput = null;
  }

  function repositionCurrentIcon() {
    if (!currentIconInput || !iconMap.has(currentIconInput)) return;
    const icon = iconMap.get(currentIconInput);
    const { top, left, inView } = iconCoords(currentIconInput);
    iconStyle(icon, 'top',  top  + 'px');
    iconStyle(icon, 'left', left + 'px');
    iconStyle(icon, 'display', inView ? 'block' : 'none');
  }

  // ─── Focus / blur tracking ─────────────────────────────────────────────────
  document.addEventListener('focusin', (e) => {
    if (!isFormInput(e.target)) return;
    showTriggerIcon(e.target);
  }, true);

  document.addEventListener('focusout', (e) => {
    if (!isFormInput(e.target)) return;
    const input = e.target;
    setTimeout(() => {
      if (document.activeElement !== input) hideTriggerIcon(input);
    }, 150);
  }, true);

  window.addEventListener('scroll',  repositionCurrentIcon, { capture: true, passive: true });
  window.addEventListener('resize',  repositionCurrentIcon, { passive: true });

  // ─── Active profile ───────────────────────────────────────────────────────
  function getActiveProfile() {
    return profiles.find(p => p.id === activeProfileId) || profiles[0];
  }

  // ─── Fill field ───────────────────────────────────────────────────────────
  function fillField(fieldKey) {
    if (!targetInput) return;
    const profile = getActiveProfile();
    if (!profile) return;
    const value = profile.fields[fieldKey];
    if (value === undefined || value === null) return;

    targetInput.focus();

    const inputDesc    = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,   'value');
    const textareaDesc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    const setter = (inputDesc && inputDesc.set) || (textareaDesc && textareaDesc.set);

    if (setter) setter.call(targetInput, value);
    else         targetInput.value = value;

    targetInput.dispatchEvent(new Event('input',  { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

    targetInput.style.transition = 'background 0.3s';
    targetInput.style.background = '#6EE7B750';
    setTimeout(() => { targetInput.style.background = ''; }, 600);

    closeDial();
  }

  // ─── Dial petals ──────────────────────────────────────────────────────────
  function buildPetals(profile) {
    if (!profile) return '';
    const fields    = Object.entries(profile.fields).filter(([, v]) => v !== '');
    const angleStep = 360 / fields.length;
    const R         = 88;

    return fields.map(([key], i) => {
      const angle = angleStep * i - 90;
      const rad   = (angle * Math.PI) / 180;
      const x     = Math.round(R * Math.cos(rad));
      const y     = Math.round(R * Math.sin(rad));
      const label = FIELD_LABELS[key] || key;
      const icon  = FIELD_ICONS[key]  || '\u2022';
      return `<button class="fd-petal" data-key="${key}"
        style="--tx:${x}px;--ty:${y}px;--delay:${i * 30}ms;"
        title="${label}: ${profile.fields[key]}"
      ><span class="fd-petal-icon">${icon}</span><span class="fd-petal-label">${label}</span></button>`;
    }).join('');
  }

  function buildProfileTabs() {
    return profiles.map(p => `
      <button class="fd-profile-tab ${p.id === activeProfileId ? 'active' : ''}"
        data-profile="${p.id}" style="--pcolor:${p.color}">${p.label}</button>
    `).join('');
  }

  // ─── Dial mount / open / close ────────────────────────────────────────────
  function mountDial() {
    if (dialEl) dialEl.remove();
    const profile = getActiveProfile();

    dialEl = document.createElement('div');
    dialEl.id = 'form-dial-root';
    dialEl.innerHTML = `
      <div class="fd-backdrop"></div>
      <div class="fd-hub" id="fd-hub">
        <div class="fd-petals-ring">${buildPetals(profile)}</div>
        <div class="fd-center"><div class="fd-logo">&#9889;</div></div>
        <div class="fd-profiles">${buildProfileTabs()}</div>
        <button class="fd-close" id="fd-close">&#10005;</button>
        ${targetInput ? `<div class="fd-target-hint">&#8594; ${targetInput.placeholder || targetInput.name || targetInput.id || 'field'}</div>` : ''}
      </div>`;

    const hubSize = 240;
    const hub = dialEl.querySelector('#fd-hub');
    hub.style.left = Math.max(10, Math.min(dialPosition.x - hubSize / 2, window.innerWidth  - hubSize - 10)) + 'px';
    hub.style.top  = Math.max(10, Math.min(dialPosition.y - hubSize / 2, window.innerHeight - hubSize - 80)) + 'px';

    document.body.appendChild(dialEl);
    requestAnimationFrame(() => dialEl.classList.add('fd-open'));

    dialEl.querySelector('#fd-close').addEventListener('click', closeDial);
    dialEl.querySelector('.fd-backdrop').addEventListener('click', closeDial);
    dialEl.querySelectorAll('.fd-petal').forEach(btn =>
      btn.addEventListener('click', (e) => { e.stopPropagation(); fillField(btn.dataset.key); }));
    dialEl.querySelectorAll('.fd-profile-tab').forEach(tab =>
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        activeProfileId = tab.dataset.profile;
        chrome.storage.local.set({ activeProfile: activeProfileId });
        mountDial();
      }));
  }

  function openDial(x, y, input) {
    targetInput  = input;
    dialPosition = { x, y };
    dialOpen     = true;
    mountDial();
  }

  function closeDial() {
    if (!dialEl) return;
    dialEl.classList.remove('fd-open');
    dialEl.classList.add('fd-closing');
    setTimeout(() => { if (dialEl) dialEl.remove(); dialEl = null; }, 280);
    dialOpen = false;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialOpen) {
      closeDial();
      return;
    }

    // Cmd+ñ (Mac) / Ctrl+ñ (Win/Linux) — open dial on focused input
    if ((e.metaKey || e.ctrlKey) && (e.key === 'ñ' || e.key === 'Ñ')) {
      e.preventDefault();
      e.stopPropagation();

      if (dialOpen) { closeDial(); return; }

      const focused = document.activeElement;
      const input   = isFormInput(focused) ? focused : null;

      let x, y;
      if (input) {
        const r = input.getBoundingClientRect();
        x = r.left + r.width  / 2;
        y = r.top  + r.height / 2;
      } else {
        x = window.innerWidth  / 2;
        y = window.innerHeight / 2;
      }

      openDial(x, y, input);
    }
  });

  // ─── Storage ──────────────────────────────────────────────────────────────
  function loadProfiles() {
    chrome.storage.local.get(['profiles', 'activeProfile'], (data) => {
      profiles        = data.profiles     || [];
      activeProfileId = data.activeProfile || (profiles[0] && profiles[0].id) || 'personal';
    });
  }

  loadProfiles();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.profiles)      profiles        = changes.profiles.newValue;
    if (changes.activeProfile) activeProfileId = changes.activeProfile.newValue;
    if (dialOpen) mountDial();
  });
})();
