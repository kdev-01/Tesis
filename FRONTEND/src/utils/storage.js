export const secureStorage = {
  get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(atob(raw));
      if (parsed?.expiresAt && parsed.expiresAt < Date.now()) {
        window.localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch (error) {
      console.error('No se pudo leer el almacenamiento seguro', error);
      return null;
    }
  },
  set(key, value, ttlMs) {
    try {
      const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
      const payload = { ...value, ...(expiresAt ? { expiresAt } : {}) };
      window.localStorage.setItem(key, btoa(JSON.stringify(payload)));
    } catch (error) {
      console.error('No se pudo guardar en el almacenamiento seguro', error);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('No se pudo eliminar del almacenamiento seguro', error);
    }
  },
};
