importScripts('firebase-rest.js', 'storage-layer.js');

const DEFAULT_PROFILES = [
  {
    id: 'personal',
    label: 'Personal',
    color: '#6EE7B7',
    fields: {
      firstName: 'Giusepe',
      lastName:  'Velazquez',
      fullName:  'Giusepe Velazquez',
      email:     'giusepe.vr@gmail.com',
      phone:     '+52 5554151961',
      address:   '123 Main Street',
      city:      'San Francisco',
      state:     'CA',
      zip:       '94105',
      country:   'United States',
      company:   '',
    },
  },
  {
    id: 'work',
    label: 'Work',
    color: '#93C5FD',
    fields: {
      firstName: 'Giusepe',
      lastName:  'Velázquez',
      fullName:  'Giusepe Velázquez Rendón',
      email:     'giusepe.vr@gmail.com',
      phone:     '5554151961',
      address:   '456 Market St',
      city:      'San Francisco',
      state:     'CA',
      zip:       '94103',
      country:   'United States',
      company:   'Acme Corp',
    },
  },
];

function seedDefaults(callback) {
  chrome.storage.local.get('profiles', (data) => {
    if (!data.profiles || data.profiles.length === 0) {
      chrome.storage.local.set(
        { profiles: DEFAULT_PROFILES, activeProfile: DEFAULT_PROFILES[0].id },
        callback,
      );
    } else if (callback) {
      callback();
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  seedDefaults();
});

chrome.runtime.onStartup.addListener(async () => {
  const auth = await FirebaseRest.getAuthState();
  if (auth) {
    StorageLayer.pullFromCloud().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ensureDefaults') {
    seedDefaults(sendResponse);
    return true;
  }

  if (msg.type === 'signIn') {
    (async () => {
      const auth = await FirebaseRest.signIn();
      const migration = await StorageLayer.migrateOnFirstSignIn();
      sendResponse({ auth, migration });
    })().catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'signOut') {
    FirebaseRest.signOut()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'getAuthState') {
    StorageLayer.getSyncStatus()
      .then((status) => sendResponse(status))
      .catch(() => sendResponse({ signedIn: false }));
    return true;
  }

  if (msg.type === 'syncNow') {
    StorageLayer.pushToCloud()
      .then((ok) => sendResponse({ ok }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});
