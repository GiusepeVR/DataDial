# ⚡ FormDial — Radial Autofill Chrome Extension

A radial S-Pen-style dial that appears on right-click to fill form fields instantly.

## Install (Unpacked / Developer Mode)

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer Mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `form-dial-extension` folder

That's it — no build step required.

---

## Usage

1. Click the ⚡ toolbar icon → **Edit Profiles** to set your name, email, address, etc.
2. On any website, click into a form field (or just hover near one)
3. **Right-click** → the radial dial appears
4. Click a petal to fill that value into the active input
5. Press **Esc** or click the backdrop to dismiss

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (MV3) |
| `content.js` | Injected into every page — renders the dial, detects fields, fills values |
| `dial.css` | Injected styles for the dial UI |
| `background.js` | Service worker — sets default profiles on install |
| `options.html/js` | Settings page to manage profiles |
| `popup.html` | Toolbar popup (quick access to settings) |

---

## How field detection works

The extension uses a 3-pass heuristic:

1. **`autocomplete` attribute** — most reliable, checks against W3C standard values
2. **`name` / `id` / `placeholder` / `aria-label`** — keyword matching against a dictionary of common field names (including Spanish variants)
3. **Associated `<label>` text** — walks the DOM to find wrapping or linked labels

---

## Adding profiles

Open Settings (click toolbar icon → Edit Profiles). You can add multiple profiles (Personal, Work, etc.) and switch between them directly in the dial.

---

## Known limitations (MVP)

- Only intercepts right-click on `input`, `textarea`, and `contenteditable` elements
- Field detection is heuristic — complex or obfuscated forms may not auto-detect the field type (you can still click any petal manually)
- Does not yet support `<select>` dropdowns
