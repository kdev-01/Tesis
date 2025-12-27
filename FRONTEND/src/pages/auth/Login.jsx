import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useLiveAnnouncer } from '../../hooks/useLiveAnnouncer.js';
import { RouteNames } from '../../utils/constants.js';

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const Login = () => {
  const { login, status } = useAuth();
  const location = useLocation();
  const { addToast } = useToast();
  const { announce } = useLiveAnnouncer();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  useEffect(() => {
    announce('Formulario de autenticación listo');
  }, [announce]);

  const onSubmit = async (data) => {
    const sanitized = {
      email: data.email?.trim().toLowerCase() ?? '',
      password: data.password,
    };
    try {
      await login(sanitized);
    } catch (error) {
      setError('root', { message: error.message });
      addToast({ title: 'No pudimos iniciar sesión', description: error.message, status: 'error' });
    }
  };

  const isLoading = status === 'loading';
  const emailValue = watch('email');

  return (
    <section className="flex flex-col items-center justify-center">
      <motion.div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-display text-primary-600">Bienvenido de vuelta</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          Accede con tu cuenta institucional para administrar los eventos.
        </p>
        {location.state?.from && (
          <p className="mt-3 rounded-2xl bg-primary-50 p-3 text-xs text-primary-600">
            Debes iniciar sesión para acceder a {location.state.from.pathname}
          </p>
        )}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Correo electrónico
            <input
              type="email"
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <span className="mt-1 block text-xs text-red-500">{errors.email.message}</span>}
          </label>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('password')}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <span className="mt-1 block text-xs text-red-500">{errors.password.message}</span>}
          </label>
          {errors.root && <p className="text-xs text-red-500">{errors.root.message}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Validando credenciales…' : 'Iniciar sesión'}
          </Button>
        </form>
        <div className="mt-4 text-right text-xs">
          <Link to={RouteNames.FORGOT_PASSWORD} className="text-primary-500 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Se enviarán notificaciones al correo {emailValue || 'registrado'}. Mantén tus credenciales seguras.
        </p>
      </motion.div>
    </section>
  );
};
