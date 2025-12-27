import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button.jsx';
import { invitationService } from '../../services/invitationService.js';
import { useToast } from '../../hooks/useToast.js';
import { RouteNames } from '../../utils/constants.js';

const schema = z
  .object({
    nombre_completo: z.string().min(1, 'Ingresa tu nombre completo'),
    telefono: z.string().optional(),
    avatar_url: z.string().url('Ingresa una URL válida').optional().or(z.literal('')).transform((value) => value || null),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirm_password: z.string(),
    institucion_id: z
      .string()
      .optional()
      .transform((value) => (value ? Number(value) : null))
      .refine((value) => value === null || Number.isInteger(value), 'Selecciona una institución válida'),
    deporte_id: z
      .string()
      .optional()
      .transform((value) => (value ? Number(value) : null))
      .refine((value) => value === null || Number.isInteger(value), 'Selecciona un deporte válido'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

export const InvitationRegister = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supportData, setSupportData] = useState({ deportes: [], instituciones: [] });
  const [supportError, setSupportError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const data = await invitationService.get(token);
        setInvitation(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvitation();
  }, [token]);

  useEffect(() => {
    if (loading) return;

    const fetchSupportData = async () => {
      try {
        const data = await invitationService.supportData();
        setSupportData({
          deportes: Array.isArray(data?.deportes) ? data.deportes : [],
          instituciones: Array.isArray(data?.instituciones) ? data.instituciones : [],
        });
      } catch (err) {
        setSupportError(err.message);
      }
    };

    fetchSupportData();
  }, [loading]);

  const onSubmit = handleSubmit(async (formData) => {
    try {
      await invitationService.accept(token, {
        nombre_completo: formData.nombre_completo.trim(),
        telefono: formData.telefono ? formData.telefono.trim() : null,
        avatar_url: formData.avatar_url,
        password: formData.password,
        institucion_id: formData.institucion_id || undefined,
        deporte_id: formData.deporte_id || undefined,
      });
      addToast({ title: 'Registro completado', description: 'Ya puedes iniciar sesión con tus credenciales.', status: 'success' });
      navigate(RouteNames.LOGIN, { replace: true });
    } catch (err) {
      addToast({ title: 'No se pudo completar el registro', description: err.message, status: 'error' });
    }
  });

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">Validando invitación…</p>;
  }

  if (error || !invitation) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-500">{error || 'La invitación no está disponible.'}</p>
        <Link to={RouteNames.HOME} className="mt-4 inline-block text-primary-500">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const normalizedRole = (invitation?.rol_nombre || '').toLowerCase();
  const isCommissioner = normalizedRole === 'representante de comisión';
  const isEducational = normalizedRole === 'representante educativo';

  return (
    <section className="flex flex-col items-center justify-center">
      <motion.div
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white/90 p-10 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-display text-primary-600">Completa tu registro</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          Te han invitado como <span className="font-semibold text-primary-500">{invitation.nombre || invitation.email}</span>{' '}
          al rol{' '}
          <span className="font-semibold text-primary-600 dark:text-primary-300">
            {invitation.rol_nombre || 'asignado'}
          </span>
          .
        </p>
        {supportError && (
          <p className="mt-2 text-xs text-amber-600">No se pudieron cargar catálogos adicionales: {supportError}</p>
        )}
        <form className="mt-6 grid gap-6 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="md:col-span-2 text-sm font-medium text-slate-600 dark:text-slate-200">
            Nombre completo
            <input
              type="text"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('nombre_completo')}
            />
            {errors.nombre_completo && <span className="mt-1 block text-xs text-red-500">{errors.nombre_completo.message}</span>}
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Teléfono de contacto
            <input
              type="tel"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('telefono')}
            />
            {errors.telefono && <span className="mt-1 block text-xs text-red-500">{errors.telefono.message}</span>}
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            URL de foto de perfil (opcional)
            <input
              type="url"
              placeholder="https://..."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('avatar_url')}
            />
            {errors.avatar_url && <span className="mt-1 block text-xs text-red-500">{errors.avatar_url.message}</span>}
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Crea una contraseña
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('password')}
            />
            {errors.password && <span className="mt-1 block text-xs text-red-500">{errors.password.message}</span>}
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Confirmar contraseña
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('confirm_password')}
            />
            {errors.confirm_password && <span className="mt-1 block text-xs text-red-500">{errors.confirm_password.message}</span>}
          </label>
          {isCommissioner && (
            <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
              Deporte asociado (opcional)
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('deporte_id')}
              >
                <option value="">Sin deporte</option>
                {supportData.deportes.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.nombre}
                  </option>
                ))}
              </select>
              {errors.deporte_id && <span className="mt-1 block text-xs text-red-500">{errors.deporte_id.message}</span>}
            </label>
          )}
          {isEducational && (
            <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
              Institución educativa (opcional)
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('institucion_id')}
              >
                <option value="">Sin institución</option>
                {supportData.instituciones.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.nombre}
                  </option>
                ))}
              </select>
              {errors.institucion_id && <span className="mt-1 block text-xs text-red-500">{errors.institucion_id.message}</span>}
            </label>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando…' : 'Crear cuenta'}
            </Button>
          </div>
        </form>
      </motion.div>
    </section>
  );
};
