import { httpClient } from './httpClient.js';

export const settingsService = {
  async getSettings() {
    const response = await httpClient('/config/');
    return response.data ?? {};
  },
  async getPublicSettings() {
    const response = await httpClient('/config/public', { auth: false });
    return response.data ?? {};
  },
  async updateSettings(payload) {
    const response = await httpClient('/config/', { method: 'PUT', body: payload });
    return response.data ?? {};
  },
  async listSports() {
    const response = await httpClient('/config/sports/');
    return response.data ?? [];
  },
  async createSport(payload) {
    const response = await httpClient('/config/sports/', { method: 'POST', body: payload });
    return response.data ?? null;
  },
  async updateSport(id, payload) {
    const response = await httpClient(`/config/sports/${id}`, { method: 'PUT', body: payload });
    return response.data ?? null;
  },
  async listCategories({ sportId } = {}) {
    const query = sportId ? `?deporte_id=${encodeURIComponent(sportId)}` : '';
    const response = await httpClient(`/config/categories/${query}`);
    return response.data ?? [];
  },
  async createCategory(payload) {
    const response = await httpClient('/config/categories/', { method: 'POST', body: payload });
    return response.data ?? null;
  },
  async updateCategory(id, payload) {
    const response = await httpClient(`/config/categories/${id}`, { method: 'PUT', body: payload });
    return response.data ?? null;
  },
};
