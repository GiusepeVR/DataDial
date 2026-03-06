document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get(['profiles', 'activeProfile'], (data) => {
  const profiles = data.profiles;

  if (!profiles || profiles.length === 0) {
    // Storage was never seeded — send a message to background to seed now,
    // then reload this popup so the data appears.
    chrome.runtime.sendMessage({ type: 'ensureDefaults' }, () => {
      // Small delay so the storage write has time to complete
      setTimeout(() => window.location.reload(), 120);
    });
    return;
  }

  const activeId = data.activeProfile;
  const active   = profiles.find(p => p.id === activeId) || profiles[0];
  document.getElementById('profileName').textContent        = active.label;
  document.getElementById('profileDot').style.background   = active.color;
});
