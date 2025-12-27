import { httpClient } from './httpClient.js';

export const invitationService = {
  async list() {
    const response = await httpClient('/invitations/');
    return response.data ?? [];
  },
  async create(payload) {
    const response = await httpClient('/invitations/', { method: 'POST', body: payload });
    return response.data;
  },
  async remove(token) {
    await httpClient(`/invitations/${token}`, { method: 'DELETE' });
  },
  async get(token) {
    const response = await httpClient(`/invitations/${token}`, { method: 'GET', auth: false });
    return response.data;
  },
  async accept(token, payload) {
    const response = await httpClient(`/invitations/${token}/accept`, {
      method: 'POST',
      body: payload,
      auth: false,
    });
    return response.data;
  },
  async supportData() {
    const response = await httpClient('/invitations/support-data', { auth: false });
    return response.data;
  },
};
