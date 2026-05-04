document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get(['profiles', 'activeProfile'], (data) => {
  const profiles = data.profiles;

  if (!profiles || profiles.length === 0) {
    chrome.runtime.sendMessage({ type: 'ensureDefaults' }, () => {
      setTimeout(() => window.location.reload(), 120);
    });
    return;
  }

  const activeId = data.activeProfile;
  const active   = profiles.find(p => p.id === activeId) || profiles[0];
  document.getElementById('profileName').textContent      = active.label;
  document.getElementById('profileDot').style.background = active.color;
});

chrome.runtime.sendMessage({ type: 'getAuthState' }, (status) => {
  const el = document.getElementById('syncIndicator');
  if (!status) { el.style.display = 'none'; return; }

  if (status.signedIn) {
    el.classList.add('signed-in');
    el.innerHTML = '<span class="cloud-icon">&#9729;</span> Synced — ' + escapeHtml(status.email);
  } else {
    el.innerHTML = '<span class="cloud-icon">&#9729;</span> <a href="#" id="popupSignIn" style="color:#6EE7B7;text-decoration:none">Sign in to sync</a>';
    const link = document.getElementById('popupSignIn');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
