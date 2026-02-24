chrome.runtime.onInstalled.addListener(() => {
  // Set default profile data
  chrome.storage.sync.get('profiles', (data) => {
    if (!data.profiles) {
      chrome.storage.sync.set({
        profiles: [
          {
            id: 'personal',
            label: 'Personal',
            color: '#6EE7B7',
            fields: {
              firstName: 'Giusepe',
              lastName: 'Velazquez',
              fullName: 'Giusepe Velazquez',
              email: 'giusepe.vr@gmail.com',
              phone: '+52 5554151961',
              address: '123 Main Street',
              city: 'San Francisco',
              state: 'CA',
              zip: '94105',
              country: 'United States',
              company: '',
            }
          },
          {
            id: 'work',
            label: 'Work',
            color: '#93C5FD',
            fields: {
              firstName: 'Giusepe',
              lastName: 'Velázquez',
              fullName: 'Rendón',
              email: 'giusepe.vr@gmail.com',
              phone: '5554151961',
              address: '456 Market Street',
              city: 'San Francisco',
              state: 'CA',
              zip: '94103',
              country: 'United States',
              company: 'Acme Corp',
            }
          }
        ],
        activeProfile: 'personal'
      });
    }
  });
});
