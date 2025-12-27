import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon, ArrowPathIcon, EyeIcon, PencilSquareIcon, TrashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { DataTable } from '../../components/data-display/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { permissionService, roleService } from '../../services/dataService.js';
import { useToast } from '../../hooks/useToast.js';

const roleSchema = z.object({
  nombre: z.string().min(1, 'Ingresa el nombre del rol'),
  descripcion: z
    .string()
    .max(200, 'La descripción es demasiado larga')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
});

const PERMISSIONS_OPTIONS = [
  { value: 'manage_users', label: 'Gestionar usuarios' },
  { value: 'manage_roles', label: 'Configurar roles' },
  { value: 'manage_permissions', label: 'Gestionar permisos' },
  { value: 'manage_events', label: 'Gestionar eventos' },
  { value: 'view_events', label: 'Ver eventos' },
  { value: 'manage_institutions', label: 'Gestionar instituciones' },
  { value: 'view_institutions', label: 'Ver instituciones' },
  { value: 'manage_students', label: 'Gestionar jugadores' },
  { value: 'view_students', label: 'Ver jugadores' },
];

export const Roles = () => {
  const { data: roles = [], loading, refetch } = useFetchWithAuth('/roles/');
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRole, setSelectedRole] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionRole, setPermissionRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [detailRole, setDetailRole] = useState(null);
  const [isDetailOpen, setDetailOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: { nombre: '', descripcion: '' },
  });

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRole(null);
    reset({ nombre: '', descripcion: '' });
  };

  const openCreateModal = () => {
    setModalMode('create');
    reset({ nombre: '', descripcion: '' });
    setModalOpen(true);
  };

  const openEditModal = (role) => {
    setModalMode('edit');
    setSelectedRole(role);
    reset({ nombre: role.nombre, descripcion: role.descripcion ?? '' });
    setModalOpen(true);
  };

  const openDeleteModal = (role) => {
    setRoleToDelete(role);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setRoleToDelete(null);
    setDeleteOpen(false);
  };

  const openPermissionsModal = async (role) => {
    setPermissionRole(role);
    setPermissionsOpen(true);
    setLoadingPermissions(true);
    try {
      const permissions = await permissionService.listByRole(role.id);
      setSelectedPermissions(permissions);
    } catch (error) {
      addToast({ title: 'No pudimos cargar los permisos', description: error.message, status: 'error' });
    } finally {
      setLoadingPermissions(false);
    }
  };

  const closePermissionsModal = () => {
    setPermissionRole(null);
    setSelectedPermissions([]);
    setPermissionsOpen(false);
  };

  const openDetailModal = (role) => {
    setDetailRole(role);
    setDetailOpen(true);
  };

  const closeDetailModal = () => {
    setDetailRole(null);
    setDetailOpen(false);
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    const payload = {
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion?.trim() || null,
    };

    try {
      if (modalMode === 'edit' && selectedRole) {
        await roleService.update(selectedRole.id, payload);
        addToast({ title: 'Rol actualizado', status: 'success' });
      } else {
        await roleService.create(payload);
        addToast({ title: 'Rol creado', status: 'success' });
      }
      closeModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo guardar el rol', description: error.message, status: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      await roleService.remove(roleToDelete.id);
      addToast({ title: 'Rol eliminado', status: 'success' });
      closeDeleteModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo eliminar el rol', description: error.message, status: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePermission = (permission) => {
    setSelectedPermissions((current) => {
      if (current.includes(permission)) {
        return current.filter((value) => value !== permission);
      }
      return [...current, permission];
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionRole) return;
    setSavingPermissions(true);
    try {
      const normalized = await permissionService.update(permissionRole.id, selectedPermissions);
      setSelectedPermissions(normalized);
      addToast({ title: 'Permisos actualizados', status: 'success' });
      closePermissionsModal();
    } catch (error) {
      addToast({ title: 'No se pudieron actualizar los permisos', description: error.message, status: 'error' });
    } finally {
      setSavingPermissions(false);
    }
  };

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) => role.nombre.toLowerCase().includes(query));
  }, [roles, search]);

  const actionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary-500 shadow-lg shadow-primary-500/20 transition hover:-translate-y-0.5 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 dark:bg-slate-800 dark:text-primary-200';
  const dangerActionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-lg shadow-red-400/20 transition hover:-translate-y-0.5 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:bg-slate-800 dark:text-red-400';

  return (
    <>
    <Card>
      <CardHeader
        title="Roles del sistema"
        description="Controla los permisos disponibles para los usuarios."
        actions={
          <div className="flex flex-wrap items-center gap-2 rounded-full bg-gradient-to-r from-sky-100 via-rose-100 to-purple-100 p-1.5 shadow-inner dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900">
            <Button variant="gradient" size="sm" onClick={openCreateModal}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Nuevo rol
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sky-500 hover:bg-sky-100/60"
              onClick={() => refetch()}
              disabled={loading}
            >
              <ArrowPathIcon className="h-4 w-4" aria-hidden />
              Refrescar
            </Button>
          </div>
        }
      />

      <div className="mb-6 w-full md:max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre" />
      </div>

      <DataTable
        columns={[
          { Header: 'Nombre', accessor: 'nombre' },
          {
            Header: 'Descripción',
            accessor: 'descripcion',
            Cell: ({ value }) => value || '—',
          },
          {
            Header: 'Actualizado',
            accessor: 'actualizado_en',
            Cell: ({ value }) => (value ? new Date(value).toLocaleDateString() : '—'),
          },
        ]}
        data={filteredRoles}
        emptyMessage={'No hay roles registrados'}
        loading={loading}
        renderActions={(role) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={`${actionButtonClass} text-sky-500`}
              onClick={() => openDetailModal(role)}
              title="Ver detalle"
            >
              <EyeIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={`${actionButtonClass} text-slate-500 ${
                (role.nombre ?? '').toLowerCase() === 'representante de comisión' ? '' : 'opacity-50'
              }`}
              onClick={() => {
                if ((role.nombre ?? '').toLowerCase() === 'representante de comisión') {
                  openPermissionsModal(role);
                } else {
                  addToast({
                    title: 'Permisos bloqueados',
                    description: 'Solo puedes gestionar los permisos del rol Representante de comisión.',
                    status: 'info',
                  });
                }
              }}
              title="Configurar permisos"
            >
              <ShieldCheckIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={` ${actionButtonClass} text-green-500 `}
              onClick={() => openEditModal(role)}
              title="Editar"
            >
              <PencilSquareIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={dangerActionButtonClass}
              onClick={() => openDeleteModal(role)}
              title="Eliminar"
            >
              <TrashIcon className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
      />

     
    </Card>

      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        onConfirm={closeDetailModal}
        confirmLabel="Cerrar"
        confirmVariant="ghost"
        title={detailRole?.nombre ?? 'Detalle del rol'}
        description="Consulta la información general del rol seleccionado."
      >
        {detailRole ? (
          <div className="space-y-6">
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-700 dark:bg-slate-900/60">
              <Badge color="accent">ID {detailRole.id}</Badge>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                {detailRole.descripcion || 'Sin descripción registrada.'}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Creado</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {detailRole.creado_en ? new Date(detailRole.creado_en).toLocaleString() : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Actualizado</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {detailRole.actualizado_en ? new Date(detailRole.actualizado_en).toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usa el botón <span className="font-semibold text-slate-500">Permisos</span> para gestionar los accesos asociados a este rol.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Selecciona un rol para visualizar sus detalles.</p>
        )}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={onSubmit}
        confirmLabel={modalMode === 'edit' ? 'Actualizar' : 'Crear'}
        confirmDisabled={isSubmitting}
        confirmLoading={isSubmitting}
        title={modalMode === 'edit' ? 'Editar rol' : 'Crear rol'}
        description={modalMode === 'edit' ? 'Actualiza el nombre o descripción del rol.' : 'Define un nuevo rol para asignar a los usuarios.'}
      >
        <form className="space-y-4 px-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Nombre del rol
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('nombre')}
              />
            </label>
            {errors.nombre && <span className="mt-1 block text-xs text-red-500">{errors.nombre.message}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Descripción
              <textarea
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('descripcion')}
              />
            </label>
            {errors.descripcion && <span className="mt-1 block text-xs text-red-500">{errors.descripcion.message}</span>}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        confirmLabel="Eliminar"
        confirmVariant="outline"
        confirmDisabled={isDeleting}
        confirmLoading={isDeleting}
        title="Eliminar rol"
        description="Esta acción eliminará el rol del catálogo."
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Deseas eliminar el rol <strong>{roleToDelete?.nombre}</strong>? Asegúrate de que no esté asignado a usuarios críticos.
        </p>
      </Modal>

      <Modal
        isOpen={isPermissionsOpen}
        onClose={closePermissionsModal}
        onConfirm={handleSavePermissions}
        confirmLabel="Guardar"
        confirmDisabled={savingPermissions}
        confirmLoading={savingPermissions}
        title={permissionRole ? `Permisos de ${permissionRole.nombre}` : 'Permisos del rol'}
        description="Activa o desactiva los módulos disponibles para este rol."
      >
        {loadingPermissions ? (
          <p className="text-sm text-slate-500">Cargando permisos…</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {PERMISSIONS_OPTIONS.map((permission) => {
              const id = `permission-${permission.value}`;
              const checked = selectedPermissions.includes(permission.value);
              return (
                <li
                  key={permission.value}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                    checked={checked}
                    onChange={() => togglePermission(permission.value)}
                  />
                  <label htmlFor={id} className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-medium">{permission.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{permission.value}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
      </>
  );
};
