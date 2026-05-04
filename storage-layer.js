// Storage abstraction — offline-first with optional Firestore sync
const StorageLayer = {

  async getProfiles() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['profiles', 'activeProfile', 'localUpdatedAt'], (data) => {
        resolve({
          profiles: data.profiles || [],
          activeProfileId: data.activeProfile || '',
          updatedAt: data.localUpdatedAt || 0,
        });
      });
    });
  },

  async saveProfiles(profiles, activeProfileId) {
    const now = Date.now();
    await new Promise((resolve) => {
      chrome.storage.local.set({
        profiles,
        activeProfile: activeProfileId,
        localUpdatedAt: now,
      }, resolve);
    });

    this._syncToCloud(profiles, activeProfileId).catch(() => {});
  },

  async _syncToCloud(profiles, activeProfileId) {
    const auth = await FirebaseRest.getAuthState();
    if (!auth) return;
    await FirebaseRest.pushProfiles(profiles, activeProfileId);
    await new Promise((resolve) => {
      chrome.storage.local.set({ lastSyncedAt: Date.now() }, resolve);
    });
  },

  async pullFromCloud() {
    const remote = await FirebaseRest.pullProfiles();
    if (!remote || !remote.profiles) return null;

    await new Promise((resolve) => {
      chrome.storage.local.set({
        profiles: remote.profiles,
        activeProfile: remote.activeProfileId,
        localUpdatedAt: remote.updatedAt,
        lastSyncedAt: Date.now(),
      }, resolve);
    });

    return remote;
  },

  async pushToCloud() {
    const local = await this.getProfiles();
    if (!local.profiles.length) return false;
    const ok = await FirebaseRest.pushProfiles(local.profiles, local.activeProfileId);
    if (ok) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ lastSyncedAt: Date.now() }, resolve);
      });
    }
    return ok;
  },

  async getSyncStatus() {
    const auth = await FirebaseRest.getAuthState();
    const lastSynced = await new Promise((resolve) => {
      chrome.storage.local.get('lastSyncedAt', (d) => resolve(d.lastSyncedAt || 0));
    });
    return {
      signedIn: !!auth,
      email: auth ? auth.email : null,
      displayName: auth ? auth.displayName : null,
      photoUrl: auth ? auth.photoUrl : null,
      lastSyncedAt: lastSynced,
    };
  },

  async migrateOnFirstSignIn() {
    const remote = await FirebaseRest.pullProfiles();
    if (remote && remote.profiles && remote.profiles.length > 0) {
      await new Promise((resolve) => {
        chrome.storage.local.set({
          profiles: remote.profiles,
          activeProfile: remote.activeProfileId,
          localUpdatedAt: remote.updatedAt,
          lastSyncedAt: Date.now(),
        }, resolve);
      });
      return 'pulled';
    }

    await this.pushToCloud();
    return 'pushed';
  },
};
