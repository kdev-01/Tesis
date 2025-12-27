import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PublicLayout } from './components/layout/PublicLayout.jsx';
import { AdminLayout } from './components/layout/AdminLayout.jsx';
import { ProtectedRoute } from './router/ProtectedRoute.jsx';
import { Home } from './pages/public/Home.jsx';
import { About } from './pages/public/About.jsx';
import { Events } from './pages/public/Events.jsx';
import { News } from './pages/public/News.jsx';
import { Login } from './pages/auth/Login.jsx';
import { Dashboard } from './pages/admin/Dashboard.jsx';
import { Users } from './pages/admin/Users.jsx';
import { Institutions } from './pages/admin/Institutions.jsx';
import { Roles as RolesPage } from './pages/admin/Roles.jsx';
import { Players } from './pages/admin/Players.jsx';
import { AdminEvents } from './pages/admin/AdminEvents.jsx';
import { Settings } from './pages/admin/Settings.jsx';
import { Profile } from './pages/admin/Profile.jsx';
import { AdminNews } from './pages/admin/AdminNews.jsx';
import { Scenarios } from './pages/admin/Scenarios.jsx';
import { ForgotPassword } from './pages/auth/ForgotPassword.jsx';
import { ResetPassword } from './pages/auth/ResetPassword.jsx';
import { InvitationRegister } from './pages/public/InvitationRegister.jsx';
import { NotFound } from './pages/public/NotFound.jsx';
import { RouteNames, Roles } from './utils/constants.js';
import { RepresentativeInvitations } from './pages/admin/RepresentativeInvitations.jsx';
import { RepresentativeEvents } from './pages/admin/RepresentativeEvents.jsx';
import { RepresentativeFixture } from './pages/admin/RepresentativeFixture.jsx';
import { RepresentativeInstitutionStudents } from './pages/admin/RepresentativeInstitutionStudents.jsx';
import { AdminEventDetail } from './pages/admin/AdminEventDetail.jsx';
import { Notifications } from './pages/admin/Notifications.jsx';

const App = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path={RouteNames.ABOUT.substring(1)} element={<About />} />
          <Route path={RouteNames.EVENTS.substring(1)} element={<Events />} />
          <Route path={RouteNames.NEWS.substring(1)} element={<News />} />
          <Route path={RouteNames.LOGIN.substring(1)} element={<Login />} />
          <Route path={RouteNames.FORGOT_PASSWORD.substring(1)} element={<ForgotPassword />} />
          <Route path={RouteNames.RESET_PASSWORD.substring(1)} element={<ResetPassword />} />
          <Route path={RouteNames.INVITATION_REGISTER.substring(1)} element={<InvitationRegister />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[Roles.ADMIN, Roles.MANAGER, Roles.COACH]} />}> 
          <Route element={<AdminLayout />}>
            <Route path={RouteNames.DASHBOARD.substring(1)} element={<Dashboard />} />
            <Route
              path="admin/usuarios"
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.ROLES.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <RolesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/estudiantes"
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <Players />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/eventos/administracion"
              element={
                <ProtectedRoute allowedRoles={[Roles.ADMIN]} redirectTo={RouteNames.DASHBOARD}>
                  <AdminEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/eventos/:eventId/detalle"
              element={
                <ProtectedRoute allowedRoles={[Roles.ADMIN]} redirectTo={RouteNames.DASHBOARD}>
                  <AdminEventDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/noticias"
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <AdminNews />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/ajustes"
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/instituciones"
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH, Roles.MANAGER]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <Institutions />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.SCENARIOS.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH, Roles.MANAGER]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <Scenarios />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.EVENT_INVITATIONS.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.MANAGER, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <RepresentativeInvitations />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.EVENT_REGISTRATION.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.MANAGER, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <RepresentativeEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.EVENT_FIXTURE.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.MANAGER, Roles.ADMIN, Roles.COACH]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <RepresentativeFixture />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.NOTIFICATIONS.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.ADMIN, Roles.COACH, Roles.MANAGER]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path={RouteNames.EDUCATIONAL_PORTAL.substring(1)}
              element={
                <ProtectedRoute
                  allowedRoles={[Roles.MANAGER]}
                  redirectTo={RouteNames.DASHBOARD}
                >
                  <RepresentativeInstitutionStudents />
                </ProtectedRoute>
              }
            />
            <Route path="admin/perfil" element={<Profile />} />
            <Route path="admin/*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </AnimatePresence>
  );
};

export default App;
