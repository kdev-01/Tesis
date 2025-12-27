import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button.jsx';
import { authService } from '../../services/authService.js';
import { useToast } from '../../hooks/useToast.js';
import { RouteNames } from '../../utils/constants.js';

export const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
          confirm_password: z.string(),
        })
        .refine((data) => data.password === data.confirm_password, {
          message: 'Las contraseñas no coinciden',
          path: ['confirm_password'],
        }),
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await authService.resetPassword({ token, password: data.password });
      addToast({ title: 'Contraseña actualizada', description: 'Ya puedes iniciar sesión con tu nueva contraseña.', status: 'success' });
      reset();
      navigate(RouteNames.LOGIN, { replace: true });
    } catch (error) {
      addToast({ title: 'No se pudo actualizar la contraseña', description: error.message, status: 'error' });
    }
  });

  return (
    <section className="flex flex-col items-center justify-center">
      <motion.div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-display text-primary-600">Restablecer contraseña</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          Crea una nueva contraseña segura para tu cuenta.
        </p>
        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Nueva contraseña
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('password')}
            />
            {errors.password && <span className="mt-1 block text-xs text-red-500">{errors.password.message}</span>}
          </label>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Confirmar contraseña
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('confirm_password')}
            />
            {errors.confirm_password && <span className="mt-1 block text-xs text-red-500">{errors.confirm_password.message}</span>}
          </label>
          <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
            {isSubmitting ? 'Actualizando…' : 'Guardar contraseña'}
          </Button>
        </form>
      </motion.div>
    </section>
  );
};
