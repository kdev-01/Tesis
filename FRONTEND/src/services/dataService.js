import { httpClient, buildQueryString } from './httpClient.js';

export const eventService = {
  async listEvents({ page = 1, pageSize = 6, search = '', manageable = false, sportId } = {}) {
    const query = buildQueryString({
      page,
      page_size: pageSize,
      search,
      manageable: manageable ? 'true' : undefined,
      deporte_id: sportId ? String(sportId) : undefined,
    });
    const response = await httpClient(`/events/${query}`);
    return response.data ?? [];
  },
  async create({ metadata, planningDocument, coverImage }) {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    if (planningDocument) {
      formData.append('planning_document', planningDocument);
    }
    if (coverImage) {
      formData.append('cover_image', coverImage);
    }
    const response = await httpClient('/events/', { method: 'POST', body: formData });
    return response.data;
  },
  async update(id, { metadata, planningDocument, coverImage }) {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    if (planningDocument) {
      formData.append('planning_document', planningDocument);
    }
    if (coverImage) {
      formData.append('cover_image', coverImage);
    }
    const response = await httpClient(`/events/${id}`, { method: 'PUT', body: formData });
    return response.data;
  },
  async updateTimeline(id, payload) {
    const response = await httpClient(`/events/${id}/timeline`, {
      method: 'PATCH',
      body: payload,
    });
    return response?.data ?? null;
  },
  async remove(id) {
    await httpClient(`/events/${id}`, { method: 'DELETE' });
  },
  async listSports() {
    const response = await httpClient('/events/sports');
    return response?.data ?? [];
  },
  async listCategoriesBySport(sportId) {
    if (!sportId) return [];
    const response = await httpClient(`/events/sports/${sportId}/categories`);
    return response?.data ?? [];
  },
  async getById(eventId, { includeInstitutions = true } = {}) {
    if (!eventId) return null;
    const query = includeInstitutions ? '' : '?include_institutions=false';
    const response = await httpClient(`/events/${eventId}${query}`);
    return response?.data ?? null;
  },
  async getStage(eventId, { fecha } = {}) {
    const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
    const response = await httpClient(`/events/${eventId}/stage${query}`);
    return response?.data ?? 'borrador';
  },
  async listDocumentTypes() {
    const response = await httpClient('/events/documents/types');
    return response?.data ?? [];
  },
  async listMyInvitations() {
    const response = await httpClient('/events/invitations/me');
    return response?.data ?? [];
  },
  async listEventInstitutions(eventId) {
    if (!eventId) return [];
    const response = await httpClient(`/events/${eventId}/institutions`);
    return response?.data ?? [];
  },
  async addInstitution(eventId, payload) {
    if (!eventId || !payload?.institucion_id) {
      throw new Error('Faltan datos para agregar la institución');
    }
    const response = await httpClient(`/events/${eventId}/institutions`, {
      method: 'POST',
      body: payload,
    });
    return response?.data ?? null;
  },
  async removeInstitution(eventId, institutionId) {
    if (!eventId || !institutionId) {
      throw new Error('Faltan datos para quitar la institución');
    }
    await httpClient(`/events/${eventId}/institutions/${institutionId}`, {
      method: 'DELETE',
    });
  },
  async notifyInstitution(eventId, institutionId, payload) {
    if (!eventId || !institutionId) {
      throw new Error('Faltan datos para enviar la notificación');
    }
    const response = await httpClient(`/events/${eventId}/institutions/${institutionId}/notify`, {
      method: 'POST',
      body: payload,
    });
    return response?.data ?? null;
  },
  async acceptInvitation(eventId) {
    const response = await httpClient(`/events/${eventId}/invitations/accept`, {
      method: 'POST',
    });
    return response?.data ?? null;
  },
  async rejectInvitation(eventId) {
    const response = await httpClient(`/events/${eventId}/invitations/reject`, {
      method: 'POST',
    });
    return response?.data ?? null;
  },
  async getMyRegistration(eventId) {
    const response = await httpClient(`/events/${eventId}/registrations/me`);
    return response?.data ?? null;
  },
  async getInstitutionRegistration(eventId, institutionId) {
    if (!eventId || !institutionId) return null;
    const response = await httpClient(
      `/events/${eventId}/institutions/${institutionId}/registration`,
    );
    return response?.data ?? null;
  },
  async updateMyRegistration(eventId, payload) {
    const response = await httpClient(`/events/${eventId}/registrations/me`, {
      method: 'PUT',
      body: payload,
    });
    return response?.data ?? null;
  },
  async uploadStudentDocument(eventId, studentId, { tipoDocumento, archivo }) {
    if (!eventId || !studentId || !archivo) {
      throw new Error('Faltan datos para cargar el documento');
    }
    const formData = new FormData();
    formData.append('tipo_documento', tipoDocumento);
    formData.append('archivo', archivo);
    const response = await httpClient(
      `/events/${eventId}/registrations/me/students/${studentId}/documents`,
      { method: 'POST', body: formData },
    );
    return response?.data ?? null;
  },
  async uploadStudentDocumentsBatch(eventId, formData) {
    if (!eventId || !(formData instanceof FormData)) {
      throw new Error('Faltan datos para cargar los documentos');
    }
    const response = await httpClient(
      `/events/${eventId}/registrations/me/documents/batch`,
      { method: 'POST', body: formData },
    );
    return response?.data ?? null;
  },
  async extendInstitutionRegistration(eventId, institutionId, payload) {
    const response = await httpClient(
      `/events/${eventId}/institutions/${institutionId}/registration/extension`,
      {
        method: 'PUT',
        body: payload,
      },
    );
    return response?.data ?? null;
  },
  async reviewInstitutionDocuments(eventId, institutionId, payload) {
    const response = await httpClient(
      `/events/${eventId}/institutions/${institutionId}/documents/review`,
      { method: 'PUT', body: payload },
    );
    return response?.data ?? null;
  },
  async auditInstitution(eventId, institutionId, payload) {
    const response = await httpClient(`/events/${eventId}/institutions/${institutionId}/audit`, {
      method: 'POST',
      body: payload,
    });
    return response?.data ?? null;
  },
  async auditInstitutionsBatch(eventId, payload) {
    const response = await httpClient(`/events/${eventId}/institutions/audit/batch`, {
      method: 'POST',
      body: payload,
    });
    return response?.data ?? [];
  },
  async getFixture(eventId) {
    return this.getSchedule(eventId);
  },
  async updateFixture(eventId, payload) {
    const response = await httpClient(`/events/${eventId}/fixture`, {
      method: 'PUT',
      body: payload,
    });
    return response?.data ?? [];
  },
  async registerMatchResult(eventId, matchId, payload) {
    const response = await httpClient(`/events/${eventId}/fixture/${matchId}/result`, {
      method: 'POST',
      body: payload,
    });
    return { match: response?.data ?? null, meta: response?.meta ?? null };
  },
  async publishMatchNews(eventId, matchId) {
    const response = await httpClient(`/events/${eventId}/fixture/${matchId}/publish`, {
      method: 'POST',
    });
    return { match: response?.data ?? null, meta: response?.meta ?? null };
  },
  async getSchedule(eventId) {
    const response = await httpClient(`/events/${eventId}/schedule`);
    return { matches: response?.data ?? [], meta: response?.meta ?? null };
  },
  async getStandings(eventId) {
    const response = await httpClient(`/events/${eventId}/standings`);
    return response?.data ?? [];
  },
  async generateSchedule(eventId, payload) {
    const response = await httpClient(`/events/${eventId}/schedule`, {
      method: 'POST',
      body: payload,
    });
    return { matches: response?.data ?? [], meta: response?.meta ?? null };
  },
  async deleteSchedule(eventId) {
    await httpClient(`/events/${eventId}/schedule`, { method: 'DELETE' });
  },
  async getMatchPerformance(matchId) {
    if (!matchId) return [];
    const response = await httpClient(`/matches/${matchId}/performance`);
    return response ?? [];
  },
  async saveMatchPerformance(matchId, data) {
    if (!matchId) return [];
    const response = await httpClient(`/matches/${matchId}/performance`, {
      method: 'POST',
      body: data,
    });
    return response.data ?? [];
  },
  async calculateMatchMVP(matchId) {
    if (!matchId) return [];
    const response = await httpClient(`/matches/${matchId}/calculate-mvp`, {
      method: 'POST',
      body: {},
    });
    return response.data ?? [];
  },
  async getMatchPlayers(eventId, matchId) {
    if (!eventId || !matchId) return null;
    const response = await httpClient(`/events/${eventId}/fixture/${matchId}/players`);
    return response?.data ?? null;
  },
  async registerDetailedMatchResult(eventId, matchId, payload) {
    const response = await httpClient(`/events/${eventId}/fixture/${matchId}/detailed_result`, {
      method: 'POST',
      body: payload,
    });
    return { match: response?.data ?? null, meta: response?.meta ?? null };
  },
};


export const newsService = {
  async list({
    page = 1,
    pageSize = 9,
    search = '',
    categoria,
    destacado,
    tags,
    orderBy,
  } = {}) {
    const query = buildQueryString({
      page,
      page_size: pageSize,
      search,
      categoria,
      destacado,
      tags: Array.isArray(tags) ? tags.join(',') : tags,
      order_by: orderBy,
    });
    const response = await httpClient(`/news/${query}`, { auth: false });
    return {
      data: response?.data ?? [],
      meta: response?.meta ?? null,
    };
  },
  async listAdmin({
    page = 1,
    pageSize = 20,
    search = '',
    estados,
    categoria,
    destacado,
    tags,
    autorId,
    orderBy,
    order = 'desc',
  } = {}) {
    const query = buildQueryString({
      page,
      page_size: pageSize,
      search,
      estados: Array.isArray(estados) ? estados.join(',') : estados,
      categoria,
      destacado,
      tags: Array.isArray(tags) ? tags.join(',') : tags,
      autor_id: autorId,
      order_by: orderBy,
      order,
    });
    const response = await httpClient(`/news/manage/${query}`);
    return {
      data: response?.data ?? [],
      meta: response?.meta ?? null,
    };
  },
  async getBySlug(slug) {
    const response = await httpClient(`/news/${slug}`, { auth: false });
    return response?.data ?? null;
  },
  async getById(id) {
    const response = await httpClient(`/news/manage/${id}`);
    return response?.data ?? null;
  },
  async create(payload) {
    const response = await httpClient('/news/manage/', { method: 'POST', body: payload });
    return response?.data ?? null;
  },
  async update(id, payload) {
    const response = await httpClient(`/news/manage/${id}`, { method: 'PUT', body: payload });
    return response?.data ?? null;
  },
  async changeState(id, payload) {
    const response = await httpClient(`/news/manage/${id}/state`, { method: 'PATCH', body: payload });
    return response?.data ?? null;
  },
  async remove(id) {
    await httpClient(`/news/manage/${id}`, { method: 'DELETE' });
  },
};

export const userService = {
  async list(params = {}) {
    const query = buildQueryString(params);
    const response = await httpClient(`/users/${query}`);
    return response.data ?? [];
  },
  async create(payload) {
    const response = await httpClient('/users/', { method: 'POST', body: payload });
    return response.data;
  },
  async update(id, payload) {
    const response = await httpClient(`/users/${id}`, { method: 'PUT', body: payload });
    return response.data;
  },
  async remove(id) {
    await httpClient(`/users/${id}`, { method: 'DELETE' });
  },
  async restore(id) {
    const response = await httpClient(`/users/${id}/restore`, { method: 'POST' });
    return response.data;
  },
  async forceRemove(id) {
    await httpClient(`/users/${id}/force`, { method: 'DELETE' });
  },
  async sendRecovery(id) {
    await httpClient(`/users/${id}/send-recovery`, { method: 'POST' });
  },
  async updateProfile(payload) {
    const response = await httpClient('/users/me', { method: 'PUT', body: payload });
    return response.data;
  },
};

export const roleService = {
  async list() {
    const response = await httpClient('/roles/');
    return response.data ?? [];
  },
  async create(payload) {
    const response = await httpClient('/roles/', { method: 'POST', body: payload });
    return response.data;
  },
  async update(id, payload) {
    const response = await httpClient(`/roles/${id}`, { method: 'PUT', body: payload });
    return response.data;
  },
  async remove(id) {
    await httpClient(`/roles/${id}`, { method: 'DELETE' });
  },
};

export const permissionService = {
  async listByRole(roleId) {
    const response = await httpClient(`/permissions/roles/${roleId}`);
    return response.data ?? [];
  },
  async update(roleId, permisos) {
    const response = await httpClient(`/permissions/roles/${roleId}`, {
      method: 'PUT',
      body: { permisos },
    });
    return response.data ?? [];
  },
};

export const institutionService = {
  async get(id) {
    if (!id) return null;
    const response = await httpClient(`/institutions/${id}`);
    return response.data ?? null;
  },
  async list(params = {}) {
    const query = buildQueryString(params);
    const response = await httpClient(`/institutions/${query}`);
    return response.data ?? [];
  },
  async listSelectable() {
    const response = await httpClient('/institutions/?page_size=100');
    return response?.data ?? [];
  },
  async create(payload) {
    const response = await httpClient('/institutions/', { method: 'POST', body: payload });
    return response.data;
  },
  async update(id, payload) {
    const response = await httpClient(`/institutions/${id}`, { method: 'PUT', body: payload });
    return response.data;
  },
  async remove(id) {
    await httpClient(`/institutions/${id}`, { method: 'DELETE' });
  },
  async restore(id) {
    const response = await httpClient(`/institutions/${id}/restore`, { method: 'POST' });
    return response.data;
  },
  async forceRemove(id) {
    await httpClient(`/institutions/${id}/force`, { method: 'DELETE' });
  },
  async disaffiliate(id, payload) {
    const response = await httpClient(`/institutions/${id}/disaffiliate`, { method: 'POST', body: payload });
    return response.data;
  },
  async reaffiliate(id, payload = {}) {
    const response = await httpClient(`/institutions/${id}/reaffiliate`, { method: 'POST', body: payload });
    return response.data;
  },
  async sanction(id, payload) {
    const response = await httpClient(`/institutions/${id}/sanction`, { method: 'POST', body: payload });
    return response.data;
  },
  async liftSanction(id, payload = {}) {
    const response = await httpClient(`/institutions/${id}/sanction/lift`, { method: 'POST', body: payload });
    return response.data;
  },
};

export const studentService = {
  async list(params = {}) {
    const query = buildQueryString(params);
    const response = await httpClient(`/students/${query}`);
    return response.data ?? [];
  },
  async create(payload) {
    const response = await httpClient('/students/', { method: 'POST', body: payload });
    return response.data;
  },
  async update(id, payload) {
    const response = await httpClient(`/students/${id}`, { method: 'PUT', body: payload });
    return response.data;
  },
  async remove(id) {
    await httpClient(`/students/${id}`, { method: 'DELETE' });
  },
  async restore(id) {
    const response = await httpClient(`/students/${id}/restore`, { method: 'POST' });
    return response.data;
  },
  async forceRemove(id) {
    await httpClient(`/students/${id}/force`, { method: 'DELETE' });
  },
};

export const scenarioService = {
  async list(params = {}) {
    const query = buildQueryString(params);
    const response = await httpClient(`/scenarios/${query}`);
    return response.data ?? [];
  },
  async create(payload) {
    const response = await httpClient('/scenarios/', { method: 'POST', body: payload });
    return response.data;
  },
  async update(id, payload) {
    const response = await httpClient(`/scenarios/${id}`, { method: 'PUT', body: payload });
    return response.data;
  },
  async remove(id) {
    await httpClient(`/scenarios/${id}`, { method: 'DELETE' });
  },
  async restore(id) {
    const response = await httpClient(`/scenarios/${id}/restore`, { method: 'POST' });
    return response.data;
  },
  async forceRemove(id) {
    await httpClient(`/scenarios/${id}/force`, { method: 'DELETE' });
  },
};

export const historyService = {
  async list(params = {}) {
    const query = buildQueryString(params);
    const response = await httpClient(`/history/${query}`);
    return {
      data: response?.data ?? [],
      meta: response?.meta ?? null,
    };
  },
};

export const notificationService = {
  async list({ page = 1, pageSize = 10, status = 'all', search = '' } = {}) {
    const query = buildQueryString({
      page,
      page_size: pageSize,
      status: status && status !== 'all' ? status : undefined,
      search: search || undefined,
    });
    const response = await httpClient(`/notifications/${query}`);
    return {
      data: response?.data ?? [],
      meta: response?.meta ?? null,
    };
  },
  async summary({ limit = 5 } = {}) {
    const query = buildQueryString({ limit });
    const response = await httpClient(`/notifications/summary${query}`);
    return response?.data ?? { total_sin_leer: 0, recientes: [] };
  },
  async markAsRead(id, read = true) {
    if (!id) return null;
    const response = await httpClient(`/notifications/${id}/read`, {
      method: 'POST',
      body: { leido: read },
    });
    return response?.data ?? null;
  },
  async markAll({ read = true } = {}) {
    const response = await httpClient('/notifications/read-all', {
      method: 'POST',
      body: { leido: read },
    });
    return response?.data ?? { actualizadas: 0 };
  },
  async remove(id) {
    if (!id) return;
    await httpClient(`/notifications/${id}`, { method: 'DELETE' });
  },
  async clear() {
    const response = await httpClient('/notifications/', { method: 'DELETE' });
    return response?.data ?? { eliminadas: 0 };
  },
};
