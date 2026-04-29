/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// ─── Chrome API mock ──────────────────────────────────────────────────────────
const storageMock = {
  profiles: [
    {
      id: 'personal',
      label: 'Personal',
      color: '#6EE7B7',
      fields: {
        firstName: 'Test',
        lastName: 'User',
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '555-0100',
        address: '1 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        country: 'US',
        company: '',
      },
    },
  ],
  activeProfile: 'personal',
};

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn((_keys, cb) => cb({ ...storageMock })),
        set: jest.fn(),
      },
      onChanged: { addListener: jest.fn() },
    },
    runtime: {
      onMessage: { addListener: jest.fn() },
    },
  };

  // Load the content script exactly once so event listeners don't accumulate
  loadContentScript();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadContentScript() {
  const code = fs.readFileSync(path.resolve(__dirname, 'content.js'), 'utf8');
  eval(code);
}

function createInput() {
  const input = document.createElement('input');
  input.type = 'text';
  document.body.appendChild(input);

  // jsdom doesn't implement layout — stub getBoundingClientRect
  input.getBoundingClientRect = () => ({
    top: 100,
    left: 200,
    bottom: 120,
    right: 400,
    width: 200,
    height: 20,
    x: 200,
    y: 100,
  });

  return input;
}

function getFloatingIcons() {
  return document.querySelectorAll('[data-datadial="1"]');
}

function getDialRoot() {
  return document.getElementById('form-dial-root');
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('content.js — floating icon trigger & dial', () => {
  beforeEach(() => {
    // Close dial via Escape so the IIFE's internal `dialOpen` flag resets
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    // Remove any leftover icons and dial from the previous test
    document.querySelectorAll('[data-datadial]').forEach(el => el.remove());
    const dial = document.getElementById('form-dial-root');
    if (dial) dial.remove();
  });

  // 1. Floating icon appears on focus
  test('floating icon trigger appears when a form input receives focus', () => {
    const input = createInput();

    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const icons = getFloatingIcons();
    expect(icons.length).toBe(1);
    expect(icons[0].style.getPropertyValue('position')).toBe('fixed');
  });

  // 2. Floating icon disappears on blur
  test('floating icon trigger disappears when a form input loses focus', () => {
    const input = createInput();

    // Focus first to create the icon
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(getFloatingIcons().length).toBe(1);

    // Enable fake timers BEFORE the blur so the 150 ms setTimeout is captured
    jest.useFakeTimers();

    input.blur();
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

    // Advance past the 150 ms debounce
    jest.advanceTimersByTime(200);
    jest.useRealTimers();

    expect(getFloatingIcons().length).toBe(0);
  });

  // 3. Floating icon repositions on scroll and resize
  test('floating icon repositions correctly on scroll and resize', () => {
    const input = createInput();

    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const icon = getFloatingIcons()[0];

    // Simulate the input moving after scroll
    input.getBoundingClientRect = () => ({
      top: 50,
      left: 300,
      bottom: 70,
      right: 500,
      width: 200,
      height: 20,
      x: 300,
      y: 50,
    });

    window.dispatchEvent(new Event('scroll'));

    expect(icon.style.getPropertyValue('top')).toBe('38px');   // 50 - 12
    expect(icon.style.getPropertyValue('left')).toBe('288px'); // 300 - 12

    // Now simulate resize with another position change
    input.getBoundingClientRect = () => ({
      top: 10,
      left: 20,
      bottom: 30,
      right: 220,
      width: 200,
      height: 20,
      x: 20,
      y: 10,
    });

    window.dispatchEvent(new Event('resize'));

    expect(icon.style.getPropertyValue('top')).toBe('-2px');  // 10 - 12
    expect(icon.style.getPropertyValue('left')).toBe('8px');  // 20 - 12
  });

  // 4. Dial opens when the floating icon is clicked
  test('dial opens when the floating icon is clicked', () => {
    const input = createInput();

    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const icon = getFloatingIcons()[0];
    icon.click();

    const dial = getDialRoot();
    expect(dial).not.toBeNull();
    expect(dial.querySelector('.fd-hub')).not.toBeNull();
    expect(dial.querySelectorAll('.fd-petal').length).toBeGreaterThan(0);
  });

  // 5. Dial opens when the keyboard shortcut is pressed
  test('dial opens when Ctrl+ñ keyboard shortcut is pressed on a focused input', () => {
    const input = createInput();
    input.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ñ',
        ctrlKey: true,
        bubbles: true,
      }),
    );

    const dial = getDialRoot();
    expect(dial).not.toBeNull();
    expect(dial.querySelector('.fd-hub')).not.toBeNull();
  });
});
