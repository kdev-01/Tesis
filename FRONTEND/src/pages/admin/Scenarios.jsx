import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/data-display/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { scenarioService } from '../../services/dataService.js';
import { useToast } from '../../hooks/useToast.js';

const scenarioSchema = z.object({
  nombre: z.string().min(1, 'Ingresa el nombre del escenario'),
  direccion: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  ciudad: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  capacidad: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  activo: z.boolean().optional(),
});

export const Scenarios = () => {
  const {
    data: scenariosData = [],
    loading,
    refetch,
  } = useFetchWithAuth('/scenarios/?page_size=100&include_inactive=true');
  const { addToast } = useToast();

  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scenarioActionModal, setScenarioActionModal] = useState({
    isOpen: false,
    action: null,
    scenario: null,
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [search, setSearch] = useState('');

  const scenarios = useMemo(
    () => (Array.isArray(scenariosData) ? scenariosData : []),
    [scenariosData],
  );
  const filteredScenarios = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return scenarios;
    }
    return scenarios.filter((scenario) => {
      const name = scenario?.nombre?.toLowerCase() ?? '';
      const city = scenario?.ciudad?.toLowerCase() ?? '';
      const address = scenario?.direccion?.toLowerCase() ?? '';
      const capacity = scenario?.capacidad
        ? String(scenario.capacidad).toLowerCase()
        : '';
      return [name, city, address, capacity].some((value) =>
        value.includes(term),
      );
    });
  }, [scenarios, search]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      nombre: '',
      direccion: '',
      ciudad: '',
      capacidad: '',
      activo: true,
    },
  });

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedScenario(null);
    reset({
      nombre: '',
      direccion: '',
      ciudad: '',
      capacidad: '',
      activo: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (scenario) => {
    if (!scenario?.activo) {
      addToast({
        title: 'Escenario deshabilitado',
        description: 'Restaura el escenario antes de intentar editarlo.',
        status: 'info',
      });
      return;
    }
    setModalMode('edit');
    setSelectedScenario(scenario);
    reset({
      nombre: scenario.nombre,
      direccion: scenario.direccion ?? '',
      ciudad: scenario.ciudad ?? '',
      capacidad: scenario.capacidad?.toString() ?? '',
      activo: !!scenario.activo,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedScenario(null);
    reset({
      nombre: '',
      direccion: '',
      ciudad: '',
      capacidad: '',
      activo: true,
    });
  };

  const openActionModal = (scenario, action) => {
    setScenarioActionModal({ isOpen: true, action, scenario });
  };

  const closeActionModal = () => {
    setScenarioActionModal({ isOpen: false, action: null, scenario: null });
  };

  const scenarioActionConfig = useMemo(() => {
    if (!scenarioActionModal.action || !scenarioActionModal.scenario) {
      return {
        title: 'Gestionar escenario',
        description: 'Selecciona un escenario para cambiar su estado.',
        confirmLabel: 'Confirmar',
        confirmVariant: 'primary',
        message: (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Elige un escenario para restaurarlo, deshabilitarlo o eliminarlo
            permanentemente.
          </p>
        ),
        successTitle: 'Acción completada',
      };
    }

    const { action, scenario } = scenarioActionModal;
    const displayName = scenario.nombre ?? `Escenario #${scenario.id}`;

    switch (action) {
      case 'restore':
        return {
          title: 'Restaurar escenario',
          description:
            'El escenario volverá a estar disponible para asignaciones.',
          confirmLabel: 'Restaurar',
          confirmVariant: 'primary',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas restaurar <strong>{displayName}</strong>? Los
              administradores podrán usarlo nuevamente en los eventos.
            </p>
          ),
          successTitle: 'Escenario restaurado',
        };
      case 'force-delete':
        return {
          title: 'Eliminar permanentemente',
          description: 'Esta acción no se puede deshacer.',
          confirmLabel: 'Eliminar permanentemente',
          confirmVariant: 'danger',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar definitivamente <strong>{displayName}</strong>?
              Se borrarán todos sus datos asociados.
            </p>
          ),
          successTitle: 'Escenario eliminado',
        };
      case 'delete':
      default:
        return {
          title: 'Deshabilitar escenario',
          description: 'Podrás restaurarlo más adelante si lo necesitas.',
          confirmLabel: 'Deshabilitar',
          confirmVariant: 'outline',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas deshabilitar <strong>{displayName}</strong>? Dejará de
              estar disponible para nuevas asignaciones.
            </p>
          ),
          successTitle: 'Escenario deshabilitado',
        };
    }
  }, [scenarioActionModal]);

  const handleScenarioAction = async () => {
    if (!scenarioActionModal.action || !scenarioActionModal.scenario) return;
    setIsProcessingAction(true);
    const successTitle =
      scenarioActionConfig.successTitle ?? 'Acción completada';
    try {
      const { action, scenario } = scenarioActionModal;
      if (action === 'restore') {
        await scenarioService.restore(scenario.id);
      } else if (action === 'force-delete') {
        await scenarioService.forceRemove(scenario.id);
      } else {
        await scenarioService.remove(scenario.id);
      }
      addToast({ title: successTitle, status: 'success' });
      closeActionModal();
      await refetch();
    } catch (error) {
      addToast({
        title: 'No se pudo completar la acción',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion || undefined,
        ciudad: formData.ciudad || undefined,
        capacidad: formData.capacidad ? Number(formData.capacidad) : undefined,
        activo: formData.activo,
      };

      if (modalMode === 'edit' && selectedScenario) {
        await scenarioService.update(selectedScenario.id, payload);
        addToast({ title: 'Escenario actualizado', status: 'success' });
      } else {
        await scenarioService.create(payload);
        addToast({ title: 'Escenario creado', status: 'success' });
      }
      closeModal();
      await refetch();
    } catch (error) {
      addToast({
        title: 'No se pudo guardar el escenario',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  const formatDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString();
    } catch (error) {
      return '—';
    }
  };

  const actionButtonBase =
    'inline-flex h-10 w-10 items-center justify-center rounded-full font-semibold transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const actionButtonShadow =
    'shadow-lg shadow-slate-900/5 dark:shadow-black/20';
  const editButtonClass = `${actionButtonBase} ${actionButtonShadow} bg-primary-50 text-primary-600 hover:bg-primary-100 focus-visible:outline-primary-400 dark:bg-primary-500/20 dark:text-primary-100`;
  const disableButtonClass = `${actionButtonBase} ${actionButtonShadow} bg-amber-50 text-amber-600 hover:bg-amber-100 focus-visible:outline-amber-400 dark:bg-amber-500/20 dark:text-amber-100`;
  const restoreButtonClass = `${actionButtonBase} ${actionButtonShadow} bg-emerald-50 text-emerald-600 hover:bg-emerald-100 focus-visible:outline-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-100`;
  const forceDeleteButtonClass = `${actionButtonBase} ${actionButtonShadow} bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:outline-rose-400 dark:bg-rose-500/20 dark:text-rose-100`;

  return (
    <>
      <Card>
        <CardHeader
          title="Escenarios deportivos"
          description="Registra, actualiza o desactiva canchas y sedes disponibles para eventos."
          actions={
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-gradient-to-r from-sky-100 via-rose-100 to-purple-100 p-1.5 shadow-inner dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900">
              <Button variant="gradient" size="sm" onClick={openCreateModal}>
                <PlusIcon className="h-4 w-4" aria-hidden />
                Nuevo escenario
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-sky-500 hover:bg-sky-100/60"
                disabled={loading}
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Refrescar
              </Button>
            </div>
          }
        />

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, ciudad o dirección"
              label="Buscar escenarios"
            />
          </div>
          {search && (
            <div className="self-start md:self-auto">
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                Limpiar búsqueda
              </Button>
            </div>
          )}
        </div>

        <DataTable
          columns={[
            { Header: 'Nombre', accessor: 'nombre' },
            {
              Header: 'Ciudad',
              accessor: 'ciudad',
              Cell: ({ value }) => value || '—',
            },
            {
              Header: 'Dirección',
              accessor: 'direccion',
              Cell: ({ value }) => value || '—',
            },
            {
              Header: 'Capacidad',
              accessor: 'capacidad',
              Cell: ({ value }) => (value ? value.toLocaleString() : '—'),
            },
            {
              Header: 'Estado',
              accessor: 'activo',
              Cell: ({ row }) => (
                <Badge color={row.activo ? 'accent' : 'neutral'}>
                  {row.activo ? 'ACTIVO' : 'INACTIVO'}
                </Badge>
              ),
            },
            {
              Header: 'Actualizado',
              accessor: 'actualizado_en',
              Cell: ({ value }) => formatDate(value),
            },
          ]}
          data={filteredScenarios}
          emptyMessage={
            search.trim()
              ? 'No se encontraron escenarios que coincidan con la búsqueda'
              : 'No hay escenarios registrados'
          }
          loading={loading}
          renderActions={(scenario) => (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={`${editButtonClass} ${
                  scenario.activo ? '' : 'pointer-events-none opacity-50'
                }`}
                onClick={() => openEditModal(scenario)}
                title={scenario.activo ? 'Editar' : 'Restaurar antes de editar'}
                disabled={!scenario.activo}
              >
                <PencilSquareIcon className="h-5 w-5" aria-hidden />
              </button>
              {scenario.activo ? (
                <button
                  type="button"
                  className={disableButtonClass}
                  onClick={() => openActionModal(scenario, 'delete')}
                  title="Deshabilitar"
                >
                  <TrashIcon className="h-5 w-5" aria-hidden />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={restoreButtonClass}
                    onClick={() => openActionModal(scenario, 'restore')}
                    title="Restaurar"
                  >
                    <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={forceDeleteButtonClass}
                    onClick={() => openActionModal(scenario, 'force-delete')}
                    title="Eliminar permanentemente"
                  >
                    <TrashIcon className="h-5 w-5" aria-hidden />
                  </button>
                </>
              )}
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={onSubmit}
        confirmLabel={
          isSubmitting
            ? 'Guardando…'
            : modalMode === 'edit'
            ? 'Guardar cambios'
            : 'Crear escenario'
        }
        confirmDisabled={isSubmitting}
        title={
          modalMode === 'edit'
            ? 'Editar escenario deportivo'
            : 'Nuevo escenario deportivo'
        }
        description="Gestiona la infraestructura disponible para asignaciones de horarios."
      >
        <form className="space-y-4 px-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Nombre
            </label>
            <input
              {...register('nombre')}
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
              placeholder="Ej. Coliseo Central"
            />
            {errors.nombre && (
              <p className="mt-1 text-xs text-red-500">
                {errors.nombre.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Dirección
            </label>
            <input
              {...register('direccion')}
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
              placeholder="Calle, carrera, barrio"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Ciudad
            </label>
            <input
              {...register('ciudad')}
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
              placeholder="Ciudad"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Capacidad
            </label>
            <input
              {...register('capacidad')}
              type="number"
              min="0"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
              placeholder="Aforo máximo"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              {...register('activo')}
              type="checkbox"
              id="scenario-activo"
              className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-400"
              defaultChecked
            />
            <label
              htmlFor="scenario-activo"
              className="text-sm text-slate-600 dark:text-slate-200"
            >
              Escenario disponible para asignaciones
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={scenarioActionModal.isOpen}
        onClose={closeActionModal}
        onConfirm={handleScenarioAction}
        confirmLabel={
          isProcessingAction ? 'Procesando…' : scenarioActionConfig.confirmLabel
        }
        confirmVariant={scenarioActionConfig.confirmVariant}
        confirmDisabled={isProcessingAction}
        title={scenarioActionConfig.title}
        description={scenarioActionConfig.description}
      >
        {scenarioActionConfig.message}
      </Modal>
    </>
  );
};
