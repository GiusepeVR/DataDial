// Firebase REST API client for Chrome Extension (no SDK needed)
// Configure these values from your Firebase project console.
const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  projectId: 'YOUR_PROJECT_ID',
};

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const AUTH_KEY = 'datadial_auth';

const FirebaseRest = {

  // --- Auth ---

  async signIn() {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (t) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(t);
      });
    });

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `access_token=${token}&providerId=google.com`,
          requestUri: chrome.identity.getRedirectURL(),
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      },
    );

    if (!res.ok) throw new Error(`Firebase auth failed: ${res.status}`);
    const data = await res.json();

    const authState = {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName || data.email,
      photoUrl: data.photoUrl || '',
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + Number(data.expiresIn) * 1000,
    };

    await new Promise((resolve) => chrome.storage.local.set({ [AUTH_KEY]: authState }, resolve));
    return authState;
  },

  async signOut() {
    const authState = await this.getAuthState();
    if (authState) {
      await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (token) {
            chrome.identity.removeCachedAuthToken({ token }, resolve);
          } else {
            resolve();
          }
        });
      });
    }
    await new Promise((resolve) => chrome.storage.local.remove(AUTH_KEY, resolve));
  },

  async getAuthState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(AUTH_KEY, (data) => resolve(data[AUTH_KEY] || null));
    });
  },

  async getValidToken() {
    const auth = await this.getAuthState();
    if (!auth) return null;

    if (Date.now() < auth.expiresAt - 60000) return auth.idToken;

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${auth.refreshToken}`,
      },
    );

    if (!res.ok) {
      await this.signOut();
      return null;
    }

    const data = await res.json();
    auth.idToken = data.id_token;
    auth.refreshToken = data.refresh_token;
    auth.expiresAt = Date.now() + Number(data.expires_in) * 1000;
    await new Promise((resolve) => chrome.storage.local.set({ [AUTH_KEY]: auth }, resolve));
    return auth.idToken;
  },

  // --- Firestore ---

  _toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map((v) => this._toFirestoreValue(v)) } };
    if (typeof val === 'object') {
      const fields = {};
      for (const [k, v] of Object.entries(val)) fields[k] = this._toFirestoreValue(v);
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  },

  _fromFirestoreValue(val) {
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return val.doubleValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map((v) => this._fromFirestoreValue(v));
    if ('mapValue' in val) {
      const obj = {};
      for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = this._fromFirestoreValue(v);
      return obj;
    }
    return null;
  },

  async pushProfiles(profiles, activeProfileId) {
    const token = await this.getValidToken();
    if (!token) return false;
    const auth = await this.getAuthState();

    const docPath = `${FIRESTORE_BASE}/users/${auth.uid}/data/profiles`;
    const body = {
      fields: {
        profiles: this._toFirestoreValue(profiles),
        activeProfileId: this._toFirestoreValue(activeProfileId),
        updatedAt: this._toFirestoreValue(Date.now()),
      },
    };

    const res = await fetch(docPath, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return res.ok;
  },

  async pullProfiles() {
    const token = await this.getValidToken();
    if (!token) return null;
    const auth = await this.getAuthState();

    const docPath = `${FIRESTORE_BASE}/users/${auth.uid}/data/profiles`;
    const res = await fetch(docPath, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const doc = await res.json();
    if (!doc.fields) return null;

    return {
      profiles: this._fromFirestoreValue(doc.fields.profiles),
      activeProfileId: this._fromFirestoreValue(doc.fields.activeProfileId),
      updatedAt: this._fromFirestoreValue(doc.fields.updatedAt),
    };
  },
};
