import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusIcon,
  UserPlusIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  CheckIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  EnvelopeOpenIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { DataTable } from '../../components/data-display/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { userService } from '../../services/dataService.js';
import { invitationService } from '../../services/invitationService.js';
import { resolveMediaUrl } from '../../utils/media.js';
import { BLOOD_TYPES } from '../../utils/constants.js';

const bloodTypeSchema = z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']);

const baseSchema = z.object({
  nombre_completo: z.string().min(1, 'Ingresa el nombre completo'),
  email: z.string().email('Ingresa un correo válido'),
  telefono: z
    .string()
    .max(40, 'El teléfono es demasiado largo')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  password: z.string().optional(),
  rol_id: z.string().min(1, 'Selecciona un rol'),
  activo: z.boolean().optional(),
  tipo_sangre: bloodTypeSchema.optional().or(z.literal('')).transform((value) => value || null),
 deporte_id: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null)),
  institucion_id: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null)),
  send_welcome: z.boolean().optional(),
});

const inviteSchema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  nombre: z.string().optional(),
  rol_id: z.string().min(1, 'Selecciona un rol'),
});

export const Users = () => {
  const { data: usersData, loading, refetch } = useFetchWithAuth('/users/');
  const { data: rolesData, loading: loadingRoles } = useFetchWithAuth('/roles/');
  const { data: institutionsData, loading: loadingInstitutions } = useFetchWithAuth('/institutions/?page_size=100');
  const {
    data: sportsData,
    loading: loadingSports,
    error: sportsError,
  } = useFetchWithAuth('/events/sports');
  const {
    data: invitationsData,
    loading: loadingInvites,
    refetch: refetchInvites,
  } = useFetchWithAuth('/invitations/');
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState({ isOpen: false, action: null, user: null });
  const [isStatusProcessing, setIsStatusProcessing] = useState(false);
  const [isInviteOpen, setInviteOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [recoveringUserId, setRecoveringUserId] = useState(null);
  const passwordRequirementRef = useRef(true);
  const filterMenuRef = useRef(null);
  const [isFilterOpen, setFilterOpen] = useState(false);

  const users = useMemo(() => (Array.isArray(usersData) ? usersData : []), [usersData]);
  const roles = useMemo(() => (Array.isArray(rolesData) ? rolesData : []), [rolesData]);
  const sports = useMemo(() => (Array.isArray(sportsData) ? sportsData : []), [sportsData]);
  const invitations = useMemo(
    () => (Array.isArray(invitationsData) ? invitationsData : []),
    [invitationsData],
  );
  const institutions = useMemo(
    () => (Array.isArray(institutionsData) ? institutionsData : []),
    [institutionsData],
  );
  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: String(role.id), label: role.nombre })),
    [roles],
  );
  const sportOptions = useMemo(
    () => sports.map((sport) => ({ value: String(sport.id), label: sport.nombre })),
    [sports],
  );
  const roleIdToName = useMemo(() => {
    const mapping = new Map();
    roles.forEach((role) => {
      mapping.set(Number(role.id), role.nombre);
    });
    return mapping;
  }, [roles]);
  const institutionOptions = useMemo(
    () => institutions.map((institution) => ({ value: String(institution.id), label: institution.nombre })),
    [institutions],
  );
  const bloodTypeOptions = useMemo(
    () => BLOOD_TYPES.map((type) => ({ value: type, label: type })),
    [],
  );

  const educationalRoleIds = useMemo(
    () =>
      roles
        .filter((role) => (role.nombre ?? '').toLowerCase() === 'representante educativo')
        .map((role) => String(role.id)),
    [roles],
  );
  const commissionerRoleIds = useMemo(
    () =>
      roles
        .filter((role) => (role.nombre ?? '').toLowerCase() === 'representante de comisión')
        .map((role) => String(role.id)),
    [roles],
  );

  const formSchema = useMemo(
    () =>
      baseSchema.superRefine((data, ctx) => {
        const password = data.password?.trim() ?? '';
        if (passwordRequirementRef.current) {
          if (!password) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La contraseña es obligatoria.', path: ['password'] });
          } else if (password.length < 6) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe contener al menos 6 caracteres.', path: ['password'] });
          }
        } else if (password && password.length < 6) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe contener al menos 6 caracteres.', path: ['password'] });
        }

        const requiresInstitution = educationalRoleIds.includes(data.rol_id ?? '');
        if (requiresInstitution && !data.institucion_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecciona la institución educativa para este usuario.',
            path: ['institucion_id'],
          });
        }
        const requiresSport = commissionerRoleIds.includes(data.rol_id ?? '');
        if (requiresSport && !data.deporte_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecciona el deporte asignado para este usuario.',
            path: ['deporte_id'],
          });
        }
      }),
    [commissionerRoleIds, educationalRoleIds],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre_completo: '',
      email: '',
      telefono: '',
      password: '',
      rol_id: '',
      activo: true,
      tipo_sangre: '',
      deporte_id: '',         
    institucion_id: '', 
      send_welcome: true,
    },
  });

  const {
    register: registerInvite,
    control: inviteControl,
    handleSubmit: handleInviteSubmit,
    reset: resetInviteForm,
    formState: { errors: inviteErrors, isSubmitting: isInviteSubmitting },
  } = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', nombre: '', rol_id: '' },
  });

 const closeModal = () => {
  setModalOpen(false);
  setSelectedUser(null);

  // Reset al estado inicial del formulario
  reset({
    nombre_completo: '',
    email: '',
    telefono: '',
    password: '',
    rol_id: '',
    activo: true,
    tipo_sangre: '',
    deporte_id: '',
    institucion_id: '',
    send_welcome: true,
  });

  if (avatarPreview && avatarPreview.startsWith('blob:')) {
    URL.revokeObjectURL(avatarPreview);
  }
  setAvatarFile(null);
  setAvatarPreview('');
  setRemoveAvatar(false);
};


  const openCreateModal = () => {
    passwordRequirementRef.current = true;
    setModalMode('create');
    reset({
      nombre_completo: '',
      email: '',
      telefono: '',
      password: '',
      rol_id: '',
      activo: true,
      tipo_sangre: '',
      deporte_id: null,
      institucion_id: null,
      send_welcome: true,
    });
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(false);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    if (user?.eliminado) {
      addToast({
        title: 'Usuario eliminado',
        description: 'Restaura el usuario antes de intentar editarlo.',
        status: 'info',
      });
      return;
    }
    passwordRequirementRef.current = false;
    setModalMode('edit');
    setSelectedUser(user);
    reset({
      nombre_completo: user.nombre_completo,
      email: user.email,
      telefono: user.telefono ?? '',
      password: '',
      rol_id: user.rol_id
        ? String(user.rol_id)
        : Array.isArray(user.role_ids) && user.role_ids[0] !== undefined
          ? String(user.role_ids[0])
          : '',
      activo: user.activo,
      tipo_sangre: user.tipo_sangre ?? '',
      deporte_id: user.deporte_id ? String(user.deporte_id) : null,
      institucion_id: user.institucion_id ? String(user.institucion_id) : null,
      send_welcome: false,
    });
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview(user.avatar_url ? resolveMediaUrl(user.avatar_url) : '');
    setRemoveAvatar(false);
    setModalOpen(true);
  };

  const openStatusModal = (user, action) => {
    setStatusModal({ isOpen: true, action, user });
  };

  const closeStatusModal = () => {
    setStatusModal({ isOpen: false, action: null, user: null });
  };

  const openInviteModal = () => {
    resetInviteForm({ email: '', nombre: '', rol_id: '' });
    setInviteOpen(true);
  };

  const closeInviteModal = () => {
    setInviteOpen(false);
  };

  const watchRoleId = watch('rol_id');
  const watchDeporteId = watch('deporte_id');

 useEffect(() => {
  if (!educationalRoleIds.includes(watchRoleId ?? '')) {
    setValue('institucion_id', '', { shouldValidate: true }); // 👈 null → ''
  }
}, [educationalRoleIds, setValue, watchRoleId]);

  useEffect(() => {
   if (!commissionerRoleIds.includes(watchRoleId ?? '')) {
    if (watchDeporteId !== '') {                                     // 👈 compara con ''
      setValue('deporte_id', '', { shouldValidate: true });          // 👈 null → ''
    }
    return;
  }
    if (!watchDeporteId && sportOptions.length === 1) {
    setValue('deporte_id', sportOptions[0].value, { shouldValidate: true });
  }
  }, [commissionerRoleIds, setValue, sportOptions, watchDeporteId, watchRoleId]);

  useEffect(() => {
    if (sportsError) {
      addToast({
        title: 'No se pudieron cargar los deportes',
        description: sportsError.message,
        status: 'error',
      });
    }
  }, [addToast]);

  const openDetailModal = (user) => {
    setDetailUser(user);
    setDetailOpen(true);
  };

  const closeDetailModal = () => {
    setDetailUser(null);
    setDetailOpen(false);
  };

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
      setAvatarPreview('');
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

const onSubmit = handleSubmit(
  async (formData) => {

    setIsSubmitting(true);
    const submission = new FormData();

    submission.append('nombre_completo', formData.nombre_completo.trim());
    submission.append('email', formData.email.trim());

    if (formData.telefono !== undefined) {
      submission.append('telefono', (formData.telefono ?? '').trim());
    }

    if (formData.tipo_sangre) {
      submission.append('tipo_sangre', formData.tipo_sangre);
    } else if (modalMode === 'edit' && selectedUser?.tipo_sangre) {
      submission.append('tipo_sangre', '');
    }

    // OJO: formData.roles no existe en tu esquema, esto siempre será []
    // Puedes borrar este bloque si ya no manejas múltiples roles
    (formData.roles ?? []).forEach((roleId) => {
      submission.append('roles', roleId);
    });

    submission.append('activo', (formData.activo ?? true) ? 'true' : 'false');

    if (formData.rol_id) {
      submission.append('rol_id', formData.rol_id);
    }

    submission.append('deporte_id', formData.deporte_id ?? '');
    submission.append('institucion_id', formData.institucion_id ?? '');

    const passwordValue = formData.password?.trim();
    if (modalMode === 'create' || passwordValue) {
      submission.append('password', passwordValue ?? '');
    }

    if (avatarFile) {
      submission.append('avatar', avatarFile);
    } else if (modalMode === 'edit' && removeAvatar) {
      submission.append('remove_avatar', 'true');
    }

    if (modalMode === 'create') {
      submission.append('send_welcome', formData.send_welcome ? 'true' : 'false');
    }

    try {
      if (modalMode === 'edit' && selectedUser) {
        const data= await userService.update(selectedUser.id, submission);
        addToast({ title: 'Usuario actualizado', status: 'success' });
      } else {
        await userService.create(submission);
        addToast({ title: 'Usuario creado', status: 'success' });
      }
      await refetch();
      closeModal();
      
    } catch (error) {
      console.error('❌ Error al guardar usuario:', error);
      addToast({
        title: 'No se pudo guardar el usuario',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  },
  (errors) => {
    // Este callback se ejecuta cuando HAY errores de validación
    console.log('❌ Errores de validación del formulario:', errors);
  },
);


  const handleStatusAction = async () => {
    if (!statusModal.user || !statusModal.action) return;
    setIsStatusProcessing(true);
    const actionMessages = {
      delete: { success: 'Usuario eliminado', error: 'No se pudo eliminar el usuario' },
      restore: { success: 'Usuario restaurado', error: 'No se pudo restaurar el usuario' },
      'force-delete': {
        success: 'Usuario eliminado permanentemente',
        error: 'No se pudo eliminar permanentemente al usuario',
      },
    };
    try {
      if (statusModal.action === 'delete') {
        await userService.remove(statusModal.user.id);
      } else if (statusModal.action === 'restore') {
        await userService.restore(statusModal.user.id);
      } else if (statusModal.action === 'force-delete') {
        await userService.forceRemove(statusModal.user.id);
      }
      addToast({ title: actionMessages[statusModal.action]?.success ?? 'Acción completada', status: 'success' });
      closeStatusModal();
      await refetch();
    } catch (error) {
      addToast({
        title: actionMessages[statusModal.action]?.error ?? 'No se pudo completar la acción',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsStatusProcessing(false);
    }
  };

  const handleSendRecovery = async (user) => {
    if (!user) return;
    if (user.eliminado) {
      addToast({
        title: 'Usuario eliminado',
        description: 'Restaura el usuario antes de enviar la recuperación de cuenta.',
        status: 'info',
      });
      return;
    }
    setRecoveringUserId(user.id);
    try {
      await userService.sendRecovery(user.id);
      addToast({ title: 'Recuperación enviada', status: 'success' });
    } catch (error) {
      addToast({ title: 'No se pudo enviar la recuperación', description: error.message, status: 'error' });
    } finally {
      setRecoveringUserId(null);
    }
  };

  const onSubmitInvitation = handleInviteSubmit(async (formData) => {
    try {
      await invitationService.create({
        email: formData.email.trim().toLowerCase(),
        nombre: formData.nombre?.trim() || null,
        rol_id: Number(formData.rol_id),
      });
      addToast({ title: 'Invitación enviada', status: 'success' });
      setInviteOpen(false);
      resetInviteForm();
      await refetchInvites();
    } catch (error) {
      addToast({ title: 'No se pudo enviar la invitación', description: error.message, status: 'error' });
    }
  });

  const handleRemoveInvitation = async (token) => {
    try {
      await invitationService.remove(token);
      addToast({ title: 'Invitación cancelada', status: 'info' });
      await refetchInvites();
    } catch (error) {
      addToast({ title: 'No se pudo cancelar la invitación', description: error.message, status: 'error' });
    }
  };

  const normalizedUsers = useMemo(
    () =>
      users.map((user) => {
        const extractedRoleIds = Array.isArray(user.role_ids)
          ? user.role_ids.map((roleId) => Number(roleId)).filter((roleId) => Number.isFinite(roleId))
          : [];
        const normalizedRoleIds = [...new Set(extractedRoleIds)];
        const primaryRoleId = user.rol_id ? Number(user.rol_id) : normalizedRoleIds[0] ?? null;
        if (primaryRoleId && !normalizedRoleIds.includes(primaryRoleId)) {
          normalizedRoleIds.unshift(primaryRoleId);
        }

        const extractedRoleNames = Array.isArray(user.roles)
          ? user.roles.map((role) =>
              typeof role === 'object'
                ? role.nombre ?? role.name ?? String(role.id ?? '')
                : String(role),
            )
          : Array.isArray(user.role_names)
            ? user.role_names
            : [];
        const normalizedRoleNames = [...new Set(extractedRoleNames)];
        const fallbackRoleName = primaryRoleId ? roleIdToName.get(primaryRoleId) : null;
        const primaryRoleName = user.rol ?? normalizedRoleNames[0] ?? fallbackRoleName ?? null;
        if (primaryRoleName && !normalizedRoleNames.includes(primaryRoleName)) {
          normalizedRoleNames.unshift(primaryRoleName);
        }

        return {
          ...user,
          role_ids: normalizedRoleIds,
          roles: normalizedRoleNames,
          rol_id: primaryRoleId ?? null,
          rol: primaryRoleName,
        };
      }),
    [roleIdToName, users],
  );

  const roleFilters = useMemo(
    () => [
      { value: 'all', label: 'Todos' },
      ...roles.map((role) => ({
        value: String(role.id),
        label: role.nombre ?? role.name ?? `Rol ${role.id}`,
      })),
    ],
    [roles],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalizedUsers.filter((user) => {
      const matchesSearch =
        !query ||
        (user.nombre_completo ?? '').toLowerCase().includes(query) ||
        (user.email ?? '').toLowerCase().includes(query);

      const matchesRole =
        selectedRole === 'all' ||
        (user.role_ids ?? []).map(String).includes(selectedRole);

      return matchesSearch && matchesRole;
    });
  }, [normalizedUsers, search, selectedRole]);

  const isLoading = loading || loadingRoles || loadingInstitutions || loadingSports;
  const actionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary-500 shadow-lg shadow-primary-500/20 transition hover:-translate-y-0.5 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 dark:bg-slate-800 dark:text-primary-200';
  const dangerActionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-lg shadow-red-400/20 transition hover:-translate-y-0.5 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:bg-slate-800 dark:text-red-400';

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const statusActionConfig = useMemo(() => {
    if (!statusModal.action || !statusModal.user) {
      return {
        title: 'Gestionar usuario',
        description: '',
        confirmLabel: 'Confirmar',
        confirmVariant: 'primary',
        message: null,
      };
    }
    const displayName = statusModal.user.nombre_completo ?? statusModal.user.email ?? 'este usuario';
    switch (statusModal.action) {
      case 'restore':
        return {
          title: 'Restaurar usuario',
          description: 'El usuario volverá a tener acceso al portal correspondiente.',
          confirmLabel: 'Restaurar',
          confirmVariant: 'primary',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas restaurar a <strong>{displayName}</strong>? Podrá iniciar sesión nuevamente.
            </p>
          ),
        };
      case 'force-delete':
        return {
          title: 'Eliminar permanentemente',
          description: 'Esta acción es definitiva y no se puede deshacer.',
          confirmLabel: 'Eliminar permanentemente',
          confirmVariant: 'danger',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar permanentemente a <strong>{displayName}</strong>? Todos los datos asociados se perderán.
            </p>
          ),
        };
      case 'delete':
      default:
        return {
          title: 'Eliminar usuario',
          description: 'El usuario quedará inactivo hasta que lo restaures.',
          confirmLabel: 'Eliminar',
          confirmVariant: 'outline',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar a <strong>{displayName}</strong>? El acceso se revocará de inmediato.
            </p>
          ),
        };
    }
  }, [statusModal.action, statusModal.user]);

  return (
    <>
    <Card>
      <CardHeader
        title="Usuarios"
        description="Gestiona los accesos del personal autorizado."
        actions={
          <div className="flex flex-wrap items-center gap-2 rounded-full bg-gradient-to-r from-sky-100 via-rose-100 to-purple-100 p-1.5 shadow-inner dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900">
            <Button variant="gradient" size="sm" onClick={openCreateModal}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Nuevo usuario
            </Button>
            <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-100/60" onClick={openInviteModal}>
              <UserPlusIcon className="h-4 w-4" aria-hidden />
              Invitar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sky-500 hover:bg-sky-100/60"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <ArrowPathIcon className="h-4 w-4" aria-hidden />
              Refrescar
            </Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o correo" />
        </div>
        <div className="relative self-start md:self-auto" ref={filterMenuRef}>
          <Button
            variant="ghost"
            className="!px-3"
            onClick={() => setFilterOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isFilterOpen}
            aria-label="Abrir filtros de roles"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" aria-hidden />
          </Button>
          {isFilterOpen && (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Roles
              </p>
              <div className="mt-2 flex flex-col">
                {roleFilters.map((filter) => {
                  const isActive = selectedRole === filter.value;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => {
                        setSelectedRole(filter.value);
                        setFilterOpen(false);
                      }}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-200'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      role="menuitemradio"
                      aria-checked={isActive}
                    >
                      <span>{filter.label}</span>
                      {isActive && <CheckIcon className="h-5 w-5" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <DataTable
        columns={[
          {
            Header: 'Avatar',
            accessor: 'avatar_url',
            Cell: ({ value, row }) => (
              <div className="flex items-center gap-3">
                <img
                  src={
                    value
                      ? resolveMediaUrl(value)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(row.nombre_completo ?? 'U')}`
                  }
                  alt={row.nombre_completo}
                  className="h-10 w-10 rounded-full object-cover"
                />
              </div>
            ),
          },
          { Header: 'Nombre', accessor: 'nombre_completo' },
          { Header: 'Correo', accessor: 'email' },
          {
            Header: 'Teléfono',
            accessor: 'telefono',
            Cell: ({ value }) => value || '—',
          },
          {
            Header: 'Tipo de sangre',
            accessor: 'tipo_sangre',
            Cell: ({ value }) => value || '—',
          },
          {
            Header: 'Roles',
            accessor: 'roles',
            Cell: ({ value }) => (
              <div className="flex flex-wrap gap-2">
                {(value ?? []).map((roleName) => (
                  <Badge key={roleName} color="neutral">
                    {roleName}
                  </Badge>
                ))}
              </div>
            ),
          },
          {
            Header: 'Deporte',
            accessor: 'deporte_nombre',
            Cell: ({ value }) => value || '—',
          },
          {
            Header: 'Institución',
            accessor: 'institucion_nombre',
            Cell: ({ value }) => value || '—',
          },
          {
            Header: 'Estado',
            accessor: 'activo',
            Cell: ({ value, row }) => {
              const isDeleted = Boolean(row?.eliminado);
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={value ? 'accent' : 'neutral'}>{value ? 'Activo' : 'Inactivo'}</Badge>
                  {isDeleted && (
                    <Badge
                      color="neutral"
                      className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-200"
                    >
                      Eliminado
                    </Badge>
                  )}
                </div>
              );
            },
          },
        ]}
        data={filteredUsers}
        emptyMessage={'No hay usuarios registrados'}
        loading={isLoading}
        renderActions={(user) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={`${actionButtonClass} text-sky-500`}
              onClick={() => openDetailModal(user)}
              title="Ver detalle"
            >
              <EyeIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={`${actionButtonClass} text-green-500 ${user.eliminado ? 'pointer-events-none opacity-50' : ''}`}
              onClick={() => openEditModal(user)}
              title="Editar"
              disabled={user.eliminado}
            >
              <PencilSquareIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={`${actionButtonClass} text-slate-500 ${
                recoveringUserId === user.id || user.eliminado ? 'opacity-60 pointer-events-none' : ''
              }`}
              onClick={() => handleSendRecovery(user)}
              title="Enviar recuperación de cuenta"
              disabled={recoveringUserId === user.id || user.eliminado}
            >
              <EnvelopeOpenIcon className={`h-5 w-5 ${recoveringUserId === user.id ? 'animate-pulse' : ''}`} aria-hidden />
            </button>
            {user.eliminado ? (
              <>
                <button
                  type="button"
                  className={`${actionButtonClass} text-slate-500`}
                  onClick={() => openStatusModal(user, 'restore')}
                  title="Restaurar"
                >
                  <ArrowPathIcon className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={dangerActionButtonClass}
                  onClick={() => openStatusModal(user, 'force-delete')}
                  title="Eliminar permanentemente"
                >
                  <TrashIcon className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                className={dangerActionButtonClass}
                onClick={() => openStatusModal(user, 'delete')}
                title="Eliminar"
              >
                <TrashIcon className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        )}
      />

      <section className="mt-8 rounded-3xl border border-slate-200 p-6 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Invitaciones pendientes</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Envía enlaces temporales para que nuevos colaboradores creen su cuenta.
        </p>
        {loadingInvites ? (
          <p className="mt-4 text-sm text-slate-500">Cargando invitaciones…</p>
        ) : invitations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No hay invitaciones activas.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {invitations.map((invite) => (
              <li key={invite.token} className="rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{invite.email}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Expira el {new Date(invite.expira_en).toLocaleString()}</p>
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>
                    Rol: {roleIdToName.get(Number(invite.rol_id)) ?? `ID ${invite.rol_id}`}
                  </span>
                  <button className="text-primary-500" onClick={() => handleRemoveInvitation(invite.token)}>
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>


    </Card>
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        onConfirm={closeDetailModal}
        confirmLabel="Cerrar"
        confirmVariant="ghost"
        title="Detalle del usuario"
        description="Consulta la información completa del perfil seleccionado."
        size="lg"
        scrollable={false}
      >
        {detailUser ? (
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-40 w-40 overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-sky-200 via-rose-200 to-purple-200 shadow-xl dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900">
                <img
                  src={
                    detailUser.avatar_url
                      ? resolveMediaUrl(detailUser.avatar_url)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(detailUser.nombre_completo ?? 'U')}`
                  }
                  alt={detailUser.nombre_completo}
                  className="h-full w-full object-cover"
                />
              </div>
              <Badge color={detailUser.activo ? 'accent' : 'neutral'}>
                {detailUser.activo ? 'Activo' : 'Inactivo'}
              </Badge>
              {detailUser.eliminado && (
                <Badge
                  color="neutral"
                  className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-200"
                >
                  Eliminado
                </Badge>
              )}
              {detailUser.institucion_nombre && (
                <Badge color="accent">{detailUser.institucion_nombre}</Badge>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{detailUser.nombre_completo}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-300">{detailUser.email}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Teléfono</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {detailUser.telefono || 'No registrado'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo de sangre</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {detailUser.tipo_sangre || 'No registrado'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Último acceso</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {detailUser.ultimo_acceso
                      ? new Date(detailUser.ultimo_acceso).toLocaleString()
                      : 'Sin actividad registrada'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Institución</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {detailUser.institucion_nombre || 'No asignada'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Deporte</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {detailUser.deporte_nombre || 'No asignado'}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Roles asignados</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detailUser.roles ?? []).length === 0 ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">Sin roles asignados</span>
                  ) : (
                    detailUser.roles.map((role) => (
                      <Badge key={role} color="neutral">
                        {role}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Creado</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {new Date(detailUser.creado_en).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Actualizado el {new Date(detailUser.actualizado_en).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Selecciona un registro para ver los detalles.</p>
        )}
      </Modal>
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={onSubmit}
        confirmLabel={modalMode === 'edit' ? 'Actualizar' : 'Crear'}
        confirmDisabled={isSubmitting}
        confirmLoading={isSubmitting}
        title={modalMode === 'edit' ? 'Editar usuario' : 'Crear usuario'}
        description={
          modalMode === 'edit'
            ? 'Actualiza la información del usuario y sus roles asignados.'
            : 'Registra un nuevo usuario con los permisos adecuados.'
        }
      >
        <form className="space-y-6 px-4" onSubmit={onSubmit}>
          <FileUpload
            label="Avatar del usuario"
            description="Sube una imagen cuadrada para identificar al usuario."
            helperText="Formatos admitidos: JPG, PNG o WebP."
            previewUrl={avatarPreview}
            onFileSelect={handleAvatarSelect}
            onRemove={handleAvatarRemove}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Nombre completo
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('nombre_completo')}
                />
              </label>
              {errors.nombre_completo && (
                <span className="mt-1 block text-xs text-red-500">{errors.nombre_completo.message}</span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Correo electrónico
                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('email')}
                />
              </label>
              {errors.email && <span className="mt-1 block text-xs text-red-500">{errors.email.message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Teléfono
                <input
                  type="tel"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('telefono')}
                />
              </label>
              {errors.telefono && <span className="mt-1 block text-xs text-red-500">{errors.telefono.message}</span>}
            </div>
            <div>
              <Controller
                name="tipo_sangre"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Tipo de sangre"
                    placeholder="No especificado"
                    options={bloodTypeOptions}
                    value={field.value || null}
                    onChange={(newValue) => field.onChange(newValue ?? null)}
                    onBlur={field.onBlur}
                    error={errors.tipo_sangre?.message}
                  />
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Contraseña {modalMode === 'edit' && <span className="text-xs text-slate-400">(opcional)</span>}
                <input
                  type="password"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('password')}
                />
              </label>
              {errors.password && <span className="mt-1 block text-xs text-red-500">{errors.password.message}</span>}
            </div>
            <div className="md:col-span-2">
              <Controller
                name="rol_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Rol asignado"
                    placeholder="Selecciona el rol"
                    options={roleOptions}
                    searchable
                    value={field.value || null}
                    onChange={(newValue) => field.onChange(newValue ?? null)}
                    onBlur={field.onBlur}
                    helperText="Cada usuario puede tener un único rol."
                    error={errors.rol_id?.message}
                  />
                )}
              />
            </div>
            {commissionerRoleIds.includes(watchRoleId ?? '') && (
              <div className="md:col-span-2">
               <Controller
  name="deporte_id"
  control={control}
  render={({ field }) => (
    <Select
      label="Deporte asignado"
      placeholder="Selecciona el deporte"
      options={sportOptions}
      searchable
      disabled={sportOptions.length === 0}
      value={field.value || null}                         // 👌: '' → null para el Select
      onChange={(newValue) => field.onChange(newValue ?? '')} // 👈 aquí: null → ''
      onBlur={field.onBlur}
      helperText={
        sportOptions.length === 0
          ? 'No hay deportes disponibles. Registra deportes en el catálogo.'
          : 'Este rol solo puede gestionar eventos del deporte seleccionado.'
      }
      error={errors.deporte_id?.message}
    />
  )}
/>
              </div>
            )}
            {educationalRoleIds.includes(watchRoleId ?? '') && (
              <div className="md:col-span-2">
                <Controller
  name="institucion_id"
  control={control}
  render={({ field }) => (
    <Select
      label="Institución educativa"
      placeholder="Selecciona la institución"
      options={institutionOptions}
      searchable
      disabled={institutionOptions.length === 0}
      value={field.value || null}                          // 👌 igual que arriba
      onChange={(newValue) => field.onChange(newValue ?? '')} // 👈 null → ''
      onBlur={field.onBlur}
      helperText={
        institutionOptions.length === 0
          ? 'No hay instituciones disponibles. Registra una antes de asignar este rol.'
          : 'Este rol debe estar vinculado a una institución registrada.'
      }
      error={errors.institucion_id?.message}
    />
  )}
/>

              </div>
            )}
            <label className="md:col-span-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <input type="checkbox" className="h-4 w-4" {...register('activo')} /> Usuario activo
            </label>
            {modalMode === 'create' && (
              <label className="md:col-span-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <input type="checkbox" className="h-4 w-4" {...register('send_welcome')} /> Enviar correo de bienvenida
              </label>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={statusModal.isOpen}
        onClose={closeStatusModal}
        onConfirm={handleStatusAction}
        confirmLabel={statusActionConfig.confirmLabel}
        confirmVariant={statusActionConfig.confirmVariant}
        confirmDisabled={isStatusProcessing}
        confirmLoading={isStatusProcessing}
        title={statusActionConfig.title}
        description={statusActionConfig.description}
      >
        {statusActionConfig.message}
      </Modal>

      <Modal
        isOpen={isInviteOpen}
        onClose={closeInviteModal}
        onConfirm={onSubmitInvitation}
        confirmLabel="Enviar invitación"
        confirmDisabled={isInviteSubmitting}
        confirmLoading={isInviteSubmitting}
        title="Invitar usuario"
        description="Se enviará un correo con un enlace para completar el registro."
      >
        <form className="space-y-4 px-4" onSubmit={onSubmitInvitation}>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Correo institucional
              <input
                type="email"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...registerInvite('email')}
              />
            </label>
            {inviteErrors.email && <span className="mt-1 block text-xs text-red-500">{inviteErrors.email.message}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Nombre de referencia (opcional)
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...registerInvite('nombre')}
              />
            </label>
          </div>
          <div>
            <Controller
              name="rol_id"
              control={inviteControl}
              render={({ field }) => (
                <Select
                  label="Rol asignado"
                  placeholder="Selecciona un rol"
                  options={roleOptions}
                  value={field.value || null}
                  onChange={(newValue) => field.onChange(newValue ?? '')}
                  onBlur={field.onBlur}
                  error={inviteErrors.rol_id?.message}
                />
              )}
            />
          </div>
        </form>
      </Modal>

    </>
  );
};