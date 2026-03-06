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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ensureDefaults') {
    seedDefaults(sendResponse);
    return true; // keep channel open for async response
  }
});
