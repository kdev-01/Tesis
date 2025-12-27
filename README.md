# ⚽ Plataforma FDPEN – Gestión Deportiva Integral

Monorepo que agrupa la API en FastAPI y la SPA en React para la Federación Deportiva Provincial Estudiantil de Napo. Incluye configuración de marca en vivo, formularios enriquecidos y autenticación segura.

## 🏗 Arquitectura general

```mermaid
flowchart TD
    User[Usuarios / Staff]
    Frontend[React + Vite]
    Backend[FastAPI + SQLAlchemy]
    DB[(PostgreSQL)]
    Email[SMTP Server]

    User <--> Frontend
    Frontend <--> Backend
    Backend <--> DB
    Backend --> Email
```

- **Frontend (`FRONTEND2/`)**: React 19 con Vite, componentes reutilizables, contexto global para branding (AppConfig) y selects avanzados con búsqueda/multiselección.
- **Backend (`BACKEND2/`)**: FastAPI + SQLAlchemy asíncrono, servicios por dominio y repositorios, seeds idempotentes y CLI para migraciones.
- **Base de datos**: PostgreSQL 14+, gestionada mediante scripts SQL versionados.
- **Infraestructura**: Makefile con atajos (`dev`, `db-reset`, `db-migrate`, `db-seed`) y configuración basada en variables de entorno.

## 📦 Contenido del repositorio

| Directorio   | Descripción                                                                 |
|--------------|-------------------------------------------------------------------------------|
| `BACKEND2/`  | API FastAPI, modelos, repositorios, servicios, migraciones y documentación.   |
| `FRONTEND2/` | SPA React/Vite, contextos globales, componentes UI y pruebas con Vitest.      |
| `README.md`  | Este resumen general de la arquitectura y el arranque del proyecto.           |

## 🚀 Puesta en marcha rápida

1. Clonar el repositorio y posicionarse en la raíz.
2. **Backend** (`BACKEND2/`):
   ```bash
   cd BACKEND2
   python3 -m venv .venv
   source .venv/bin/activate  # En Windows: .venv\Scripts\activate
   pip install -e .
   ```
   Crear un archivo `.env` en `BACKEND2/` con las variables mínimas:
   ```env
   DATABASE_URL=postgresql+asyncpg://usuario:password@localhost:5432/agxport
   JWT_SECRET_KEY=super-secreto
   JWT_REFRESH_SECRET_KEY=super-secreto-refresh
   SMTP_HOST=localhost
   SMTP_PORT=1025
   SMTP_FROM=no-reply@agxport.local
   CORS_ALLOW_ORIGINS=http://localhost:5173
   ```
   Luego inicializar la base de datos y lanzar el servidor:
   ```bash
   make db-reset    # Ejecuta migraciones + seeds
   make dev         # uvicorn con autoreload en http://localhost:8000
   ```
3. **Frontend** (`FRONTEND2/`):
   ```bash
   cd ../FRONTEND2
   npm install  # o pnpm/yarn equivalente
   ```
   Configurar las variables de entorno necesarias creando `FRONTEND2/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```
   Iniciar el servidor de desarrollo:
   ```bash
   npm run dev  # Abre la SPA en http://localhost:5173
   ```

## 🔧 Funcionalidades destacadas

- **Branding editable**: desde `/admin/ajustes` se actualizan el nombre público, el correo de soporte y el modo mantenimiento. El contexto `AppConfig` replica los cambios automáticamente en la cabecera pública, el footer y un banner de mantenimiento.
- **Selects mejorados**: todos los formularios administrativos usan el nuevo componente `Select` con búsqueda, chips para multiselección y estilos consistentes.
- **Gestión de usuarios**: los perfiles registran tipo de sangre, subida de avatar con vista previa y limpieza segura de archivos temporales.

## 📚 Documentación detallada

- [Backend – FastAPI](BACKEND2/README.md)
- [Frontend – React](FRONTEND2/README.md)

Cada documento profundiza en estructura de carpetas, comandos útiles, variables de entorno y flujos de negocio.

## 📤 Despliegue

- **Backend**: construir una imagen Docker propia o ejecutar `uvicorn app.main:app` detrás de un reverse proxy. Ejecutar `make db-migrate`/`make db-seed` según el entorno.
- **Frontend**: `npm run build` genera artefactos estáticos en `FRONTEND2/dist/` listos para CDN o servidor estático.
- Configurar las variables de entorno equivalentes en producción (`DATABASE_URL`, `JWT_SECRET_KEY`, `VITE_API_BASE_URL`, etc.).

## 🤝 Contribución

1. Crear una rama desde `main`.
2. Implementar los cambios y ejecutar pruebas (`pytest` en `BACKEND2`, `npm test` en `FRONTEND2`).
3. Documentar cualquier cambio relevante (README o comentarios) y adjuntar evidencias en el PR.
4. Seguir convenciones de commits claros (Conventional Commits recomendado).

---

> ¿Dudas o mejoras? Abre un issue o PR y conversemos.
