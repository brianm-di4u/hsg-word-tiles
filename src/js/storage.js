// localStorage, every call in try/catch: the game works when storage is missing or throws.
export const KEYS = {
  save: 'hs-letters-save-v1',
  settings: 'hs-letters-settings-v1',
  register: 'hs-letters-register-v1',
  daily: 'hs-letters-daily-v1',
};
export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
  json(k, fallback) { try { const v = JSON.parse(this.get(k) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } },
  put(k, v) { return this.set(k, JSON.stringify(v)); },
};
