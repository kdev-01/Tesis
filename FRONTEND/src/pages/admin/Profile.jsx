import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { useAuth, useAuthUser } from '../../hooks/useAuth.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { userService } from '../../services/dataService.js';
import { useToast } from '../../hooks/useToast.js';
import { resolveMediaUrl } from '../../utils/media.js';
import { BLOOD_TYPES, Roles } from '../../utils/constants.js';

const profileSchema = z.object({
  nombre_completo: z.string().min(1, 'Ingresa tu nombre'),
  telefono: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim())
    .refine((value) => value.length <= 40, {
      message: 'El teléfono es demasiado largo',
    }),
  tipo_sangre: z
    .enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
    .optional()
    .or(z.literal(''))
    .transform((value) => value || null),
});

const passwordSchema = z
  .object({
    password_actual: z.string().optional(),
    password_nueva: z.string().optional(),
    confirm_password: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.password_nueva) return true;
      return data.password_nueva.length >= 6;
    },
    {
      message: 'La nueva contraseña debe tener al menos 6 caracteres.',
      path: ['password_nueva'],
    },
  )
  .refine(
    (data) => {
      if (!data.password_nueva) return true;
      return Boolean(data.password_actual);
    },
    {
      message: 'Debes confirmar tu contraseña actual.',
      path: ['password_actual'],
    },
  )
  .refine(
    (data) => {
      if (!data.password_nueva) return true;
      return data.password_nueva === data.confirm_password;
    },
    {
      message: 'Las contraseñas no coinciden.',
      path: ['confirm_password'],
    },
  );

export const Profile = () => {
  const user = useAuthUser();
  const { setAuthenticatedUser } = useAuth();
  const { addToast } = useToast();

  const resolvedAvatarUrl = useMemo(
    () => (user?.avatar_url ? resolveMediaUrl(user.avatar_url) : ''),
    [user],
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(resolvedAvatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const bloodTypeOptions = useMemo(
    () => BLOOD_TYPES.map((type) => ({ value: type, label: type })),
    [],
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre_completo: user?.nombre_completo ?? '',
      telefono: user?.telefono ?? '',
      tipo_sangre: user?.tipo_sangre ?? '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors, isSubmitting: isUpdatingPassword },
    reset: resetPasswordForm,
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password_actual: '',
      password_nueva: '',
      confirm_password: '',
    },
  });

  useEffect(() => {
    reset({
      nombre_completo: user?.nombre_completo ?? '',
      telefono: user?.telefono ?? '',
      tipo_sangre: user?.tipo_sangre ?? '',
    });
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview(resolvedAvatarUrl);
    setRemoveAvatar(false);
  }, [reset, user, resolvedAvatarUrl]);

  useEffect(
    () => () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    },
    [avatarPreview],
  );

  const handleAvatarSelect = (file) => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setRemoveAvatar(false);
    } else {
      setAvatarFile(null);
      setAvatarPreview(resolvedAvatarUrl);
    }
  };

  const handleAvatarRemove = () => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(true);
  };

const onSubmitProfile = handleSubmit(async (formData) => {
  try {
    const submission = new FormData();

    submission.append('nombre_completo', formData.nombre_completo.trim());

    const phoneValue = formData.telefono?.trim();
    if (phoneValue) {
      submission.append('telefono', phoneValue);
    }

    if (formData.tipo_sangre) {
      submission.append('tipo_sangre', formData.tipo_sangre);
    }

    if (avatarFile) {
      submission.append('avatar', avatarFile);
    } else if (removeAvatar) {
      submission.append('remove_avatar', 'true');
    }

    const updated = await userService.updateProfile(submission);
    setAuthenticatedUser(updated);
    reset({
      nombre_completo: updated?.nombre_completo ?? '',
      telefono: updated?.telefono ?? '',
      tipo_sangre: updated?.tipo_sangre ?? '',
    });
    setAvatarFile(null);
    setAvatarPreview(updated?.avatar_url ? resolveMediaUrl(updated.avatar_url) : '');
    setRemoveAvatar(false);
    addToast({ title: 'Perfil actualizado', status: 'success' });
  } catch (error) {
    console.error(error);
    addToast({
      title: 'No se pudo actualizar el perfil',
      description: error?.message ?? 'Error desconocido',
      status: 'error',
    });
  }
});


  const onSubmitPassword = handlePasswordSubmit(async (formData) => {
    if (!formData.password_nueva) {
      resetPasswordForm();
      return;
    }
    try {
      const updated = await userService.updateProfile({
        password_actual: formData.password_actual,
        password_nueva: formData.password_nueva,
      });
      setAuthenticatedUser(updated);
      addToast({ title: 'Contraseña actualizada', status: 'success' });
      resetPasswordForm();
    } catch (error) {
      addToast({
        title: 'No se pudo actualizar la contraseña',
        description: error.message,
        status: 'error',
      });
    }
  });

  if (!user) {
    return (
      <p className="text-sm text-slate-500">
        No se encontró información del usuario.
      </p>
    );
  }

  const isManager = (user.roles ?? []).includes(Roles.MANAGER);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Perfil"
          description="Actualiza tus datos personales y de contacto."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Correo
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {user.email}
            </p>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Roles
            </p>
            <div className="flex flex-wrap gap-2">
              {(user.roles ?? []).map((role) => (
                <Badge key={role}>{role}</Badge>
              ))}
            </div>
            {!isManager && (
              <>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Permisos
                </p>
                <div className="flex flex-wrap gap-2">
                  {(user.permisos ?? []).length === 0 && (
                    <span className="text-xs text-slate-400">
                      Sin permisos adicionales
                    </span>
                  )}
                  {(user.permisos ?? []).map((permission) => (
                    <Badge key={permission} variant="outline">
                      {permission}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Deporte asignado
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {user.deporte_asignado ?? 'No asignado'}
                </p>
              </>
            )}
            <p className="text-xs font-semibold uppercase text-slate-500">
              Tipo de sangre
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {user.tipo_sangre ?? 'No registrado'}
            </p>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Último acceso
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {user.ultimo_acceso
                ? new Date(user.ultimo_acceso).toLocaleString()
                : 'Sin historial disponible'}
            </p>
          </div>
          <form className="space-y-5 px-4" onSubmit={onSubmitProfile}>
            <FileUpload
              label="Foto de perfil"
              description="Sube una imagen cuadrada en formato JPG, PNG o WebP."
              helperText="Se utilizará como tu avatar en la plataforma."
              previewUrl={avatarPreview}
              onFileSelect={handleAvatarSelect}
              onRemove={handleAvatarRemove}
            />
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Nombre completo
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('nombre_completo')}
              />
              {errors.nombre_completo && (
                <span className="mt-1 block text-xs text-red-500">
                  {errors.nombre_completo.message}
                </span>
              )}
            </label>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Teléfono
              <input
                type="tel"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('telefono')}
              />
              {errors.telefono && (
                <span className="mt-1 block text-xs text-red-500">
                  {errors.telefono.message}
                </span>
              )}
            </label>
            <Controller
              name="tipo_sangre"
              control={control}
              render={({ field }) => (
                <Select
                  label="Tipo de sangre"
                  placeholder="No especificado"
                  options={bloodTypeOptions}
                  value={field.value || null}
                  onChange={(newValue) => field.onChange(newValue ?? '')}
                  onBlur={field.onBlur}
                  error={errors.tipo_sangre?.message}
                />
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </form>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Seguridad"
          description="Actualiza tu contraseña cuando lo necesites."
        />
        <form className="space-y-5 px-4" onSubmit={onSubmitPassword}>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Contraseña actual
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...registerPassword('password_actual')}
            />
            {passwordErrors.password_actual && (
              <span className="mt-1 block text-xs text-red-500">
                {passwordErrors.password_actual.message}
              </span>
            )}
          </label>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Nueva contraseña
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...registerPassword('password_nueva')}
            />
            {passwordErrors.password_nueva && (
              <span className="mt-1 block text-xs text-red-500">
                {passwordErrors.password_nueva.message}
              </span>
            )}
          </label>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
            Confirmar contraseña
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...registerPassword('confirm_password')}
            />
            {passwordErrors.confirm_password && (
              <span className="mt-1 block text-xs text-red-500">
                {passwordErrors.confirm_password.message}
              </span>
            )}
          </label>
          <Button type="submit" disabled={isUpdatingPassword}>
            {isUpdatingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
