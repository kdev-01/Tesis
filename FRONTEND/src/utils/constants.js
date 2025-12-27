export const Roles = Object.freeze({
  ADMIN: 'Administrador',
  MANAGER: 'Representante educativo',
  COACH: 'Representante de comisión',
});

export const RouteNames = {
  HOME: '/',
  ABOUT: '/nosotros',
  EVENTS: '/eventos',
  NEWS: '/noticias',
  LOGIN: '/acceso',
  FORGOT_PASSWORD: '/recuperar',
  RESET_PASSWORD: '/restablecer/:token',
  INVITATION_REGISTER: '/registro/:token',
  DASHBOARD: '/admin',
  ROLES: '/admin/roles',
  SCENARIOS: '/admin/escenarios',
  EVENT_INVITATIONS: '/admin/eventos/invitaciones',
  EVENT_REGISTRATION: '/admin/eventos',
  EVENT_FIXTURE: '/admin/eventos/calendario',
  EVENT_DETAIL: '/admin/eventos/:eventId/detalle',
  EDUCATIONAL_PORTAL: '/admin/estudiantes-institucion',
  NOTIFICATIONS: '/admin/notificaciones',
};

export const ACCESSIBLE_MESSAGES = {
  LOGGED_IN: 'Sesión iniciada. Redirigiendo al panel administrativo.',
  LOGGED_OUT: 'Sesión cerrada correctamente.',
};

export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
