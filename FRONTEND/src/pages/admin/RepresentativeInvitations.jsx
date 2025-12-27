import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardFooter } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { eventService } from '../../services/dataService.js';
import { useToastContext } from '../../context/ToastContext.jsx';
import { formatAgeRange, resolveAgeRange } from '../../utils/age.js';

const formatDate = (value) => {
  if (!value) return 'Sin definir';
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    return value;
  }
};

const getInvitationStatusColor = (status) => {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'aceptada') return 'accent';
  if (normalized === 'rechazada') return 'neutral';
  return 'primary';
};

export const RepresentativeInvitations = () => {
  const { addToast } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [invitations, setInvitations] = useState([]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const data = await eventService.listMyInvitations();
      setInvitations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('No se pudieron cargar las invitaciones', error);
      addToast({
        title: 'Error al cargar',
        description: error.message ?? 'Revisa tu conexión e inténtalo de nuevo.',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedInvitations = useMemo(() => {
    return [...invitations].sort((a, b) => {
      const stageOrder = {
        inscripcion: 0,
        auditoria: 1,
        campeonato: 2,
        borrador: 3,
        finalizado: 4,
        archivado: 5,
      };
      const stageA = stageOrder[(a?.etapa_actual ?? '').toLowerCase()] ?? 6;
      const stageB = stageOrder[(b?.etapa_actual ?? '').toLowerCase()] ?? 6;
      return stageA - stageB;
    });
  }, [invitations]);

  const handleAccept = async (eventId) => {
    try {
      setAcceptingId(eventId);
      await eventService.acceptInvitation(eventId);
      addToast({ title: 'Invitación aceptada', status: 'success' });
      await fetchInvitations();
    } catch (error) {
      console.error('No se pudo aceptar la invitación', error);
      addToast({
        title: 'No se pudo aceptar',
        description: error.message ?? 'Intenta nuevamente en unos minutos.',
        status: 'error',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (eventId) => {
    if (!eventId) return;
    const confirmed = window.confirm('¿Seguro que deseas rechazar esta invitación? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      setRejectingId(eventId);
      await eventService.rejectInvitation(eventId);
      addToast({ title: 'Invitación rechazada', status: 'success' });
      await fetchInvitations();
    } catch (error) {
      console.error('No se pudo rechazar la invitación', error);
      addToast({
        title: 'No se pudo rechazar',
        description: error.message ?? 'Intenta nuevamente en unos minutos.',
        status: 'error',
      });
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Invitaciones a eventos" description="Consulta el estado de tu participación en cada torneo." />
        <p className="text-sm text-slate-500 dark:text-slate-300">Cargando invitaciones…</p>
      </Card>
    );
  }

  if (!sortedInvitations.length) {
    return (
      <Card>
        <CardHeader title="Invitaciones a eventos" />
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Aún no tienes invitaciones asignadas. Consulta con el administrador del torneo.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {sortedInvitations.map((invitation) => {
        const ageRange = resolveAgeRange(invitation);
        return (
          <Card key={invitation.evento_id}>
            <CardHeader
              title={invitation.titulo}
              description={invitation.descripcion ?? 'Participación institucional'}
              actions={
                <Badge color={getInvitationStatusColor(invitation.estado_invitacion)}>
                {invitation.estado_invitacion ?? 'Pendiente'}
              </Badge>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Etapa actual:</span> {invitation.etapa_actual ?? 'Sin etapa definida'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Periodo de inscripción:</span>{' '}
                {formatDate(invitation.fecha_inscripcion_inicio)} → {formatDate(invitation.fecha_inscripcion_fin)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Disciplina:</span> {invitation.deporte?.nombre ?? 'Por definir'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Rango de edad permitido:</span>{' '}
                {formatAgeRange(ageRange.min, ageRange.max)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Participantes registrados:</span> {invitation.cantidad_inscritos ?? 0}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Sexo del evento:</span> {invitation.sexo_evento ?? 'Mixto'}
              </p>
            </div>
          </div>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estado de auditoría: {invitation.estado_auditoria ?? 'Pendiente'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {invitation.estado_invitacion !== 'aceptada' && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={
                    rejectingId === invitation.evento_id || invitation.estado_invitacion === 'rechazada'
                  }
                  onClick={() => handleReject(invitation.evento_id)}
                >
                  {rejectingId === invitation.evento_id
                    ? 'Rechazando…'
                    : invitation.estado_invitacion === 'rechazada'
                      ? 'Invitación rechazada'
                      : 'Rechazar invitación'}
                </Button>
              )}
              {invitation.estado_invitacion !== 'rechazada' && (
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    acceptingId === invitation.evento_id || invitation.estado_invitacion !== 'pendiente'
                  }
                  onClick={() => handleAccept(invitation.evento_id)}
                >
                  {acceptingId === invitation.evento_id
                    ? 'Aceptando…'
                    : invitation.estado_invitacion === 'aceptada'
                      ? 'Invitación aceptada'
                      : 'Aceptar participación'}
                </Button>
              )}
            </div>
          </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};
