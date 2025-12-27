import { httpClient } from './httpClient.js';

export const authService = {
  async login(credentials) {
    const response = await httpClient('/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    });
    return response.data;
  },
  async logout() {
    await httpClient('/auth/logout', { method: 'POST' });
  },
  async refresh(refreshToken) {
    const response = await httpClient('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
    });
    return response.data;
  },
  async getProfile() {
    const response = await httpClient('/auth/me', { method: 'GET' });
    return response.data;
  },
  async forgotPassword(payload) {
    await httpClient('/auth/forgot-password', { method: 'POST', body: payload, auth: false });
  },
  async resetPassword(payload) {
    await httpClient('/auth/reset-password', { method: 'POST', body: payload, auth: false });
  },
};
