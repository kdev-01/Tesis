import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { authService } from '../../services/authService.js';
import { useToast } from '../../hooks/useToast.js';
import { RouteNames } from '../../utils/constants.js';

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
});

export const ForgotPassword = () => {
  const { register, handleSubmit, formState, reset } = useForm({
    resolver: zodResolver(schema),
  });
  const { errors, isSubmitting } = formState;
  const { addToast } = useToast();

  const onSubmit = handleSubmit(async (data) => {
    try {
      await authService.forgotPassword({ email: data.email.trim().toLowerCase() });
      addToast({
        title: 'Solicitud enviada',
        description: 'Si el correo existe enviaremos un enlace para restablecer tu contraseña.',
        status: 'success',
      });
      reset();
    } catch (error) {
      addToast({
        title: 'No se pudo procesar la solicitud',
        description: error.message,
        status: 'error',
      });
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
        <h1 className="text-2xl font-display text-primary-600">Recuperar acceso</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          Ingresa tu correo institucional y te enviaremos instrucciones para restablecer la contraseña.
        </p>
        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Correo electrónico
            <input
              type="email"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('email')}
            />
            {errors.email && <span className="mt-1 block text-xs text-red-500">{errors.email.message}</span>}
          </label>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando enlace…' : 'Enviar instrucciones'}
          </Button>
        </form>
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>¿Recordaste tu contraseña? <Link to={RouteNames.LOGIN} className="text-primary-500">Inicia sesión</Link>.</p>
        </div>
      </motion.div>
    </section>
  );
};
