# Plantilla de arquitectura — Cómo construir un sitio como JTAS

> **Uso**: pedile a la IA: *"Lee `PLANTILLA-ARQUITECTURA.md` y crea el sitio \<nombre\> con estos datos: \<sección 0\>"*. La IA debe construirlo con este mismo patrón (VPS, Caddy, Supabase, tests, deploy con aprobación) y este documento manda sobre decisiones arquitectónicas.

---

## 0. Datos del proyecto (llenar antes de pedir el sitio)

| Dato | Valor |
|---|---|
| Nombre del sitio | FJcloud (FJcloud.app) |
| Descripción (1 línea) | Landing page de servicios cloud: VPS, desarrollo web, sistemas y soporte técnico para empresas |
| Repo GitHub | https://github.com/hazardvx/fjcloud (público, rama main) |
| VPS (IP / SSH key) | Contabo 13.140.186.234, SSH key `~/.ssh/id_ed25519_fjcloud` (root), sitio en `/opt/fjcloud` |
| Dominio (o nip.io de respaldo) | https://fjcloud.13-140-186-234.nip.io/ (activo); fjcloud.app (previsto) |
| Supabase (URL + anon key) | _no aplica aún_ (fase 1 = solo landing) |
| Cuenta admin de tests (email/pass) | _no aplica aún_ (fase 1 = solo landing) |
| Módulos/pantallas necesarias | Landing (fase 1): hero, servicios VPS/desarrollo/sistemas/soporte, sectores, CTA, contacto, footer. Fase 2: Área de Clientes (Supabase) |

> **Estado**: fase 1 (landing + PWA + tests E2E) DESPLEGADA en https://fjcloud.13-140-186-234.nip.io/ (53/53 checks contra prod). Repo: github.com/hazardvx/fjcloud. WhatsApp configurado (FMORAEDITION +507 6952-7810 en botón principal; footer con FMORAEDITION y Hazard.dev). Coexistencia en VPS: bloque Caddy propio (`/etc/caddy/Caddyfile.bak.fjcloud` = backup previo), sitio JTAS intacto en 13-140-186-234.nip.io. Pendiente: dominio propio fjcloud.app.

---

## 1. Cómo funciona este patrón (el modelo mental)

```
NAVEGADOR (SPA vanilla JS, sin framework ni build)
  ├── index.html único: vistas + estilos + lógica de UI
  ├── js/: módulos (sync, export, print, etc.)
  ├── localStorage: datos + estado de UI (funciona 100% offline)
  └── sw.js: caché de app shell para offline
        │
        │  cola de sincronización (push/pull + heartbeat)
        ▼
SUPABASE (BaaS)
  ├── Auth (login, sesiones, invites)
  ├── Postgres (datos) + RLS (seguridad por fila/rol)
  └── Realtime (multiusuario)

VPS (Contabo) + Caddy
  ├── Sirve los estáticos de /opt/<app> (git pull = deploy)
  ├── Cabeceras de seguridad (CSP, HSTS, XFO...)
  └── Backup diario de la BD (cron + pg_dump)
```

**Ciclo de datos**: leer → localStorage → render (instantáneo). Escribir → localStorage primero (optimista, nunca bloquea) → push a Supabase → realtime actualiza a los demás. Sin conexión → todo queda en localStorage + cola → se sincroniza al volver.

**Por qué así**: sin framework no hay build que se rompa; sin servidor propio no hay que mantener API; el offline es nativo (el negocio sigue funcionando sin internet).

## 2. Estructura del repo

```
index.html          # SPA completa (vistas, estilos, UI)
server.js           # servidor dev local (MISMOS headers que Caddy)
sw.js               # service worker (offline) — bump de CACHE_NAME por release
manifest.json       # PWA
js/                 # módulos JS (uno por responsabilidad)
vendor/             # librerías locales (sin CDN en runtime salvo supabase)
icons/
tests/              # E2E Playwright (verificar.js = suite principal)
supabase/           # SQL (schema + migraciones) — se aplica A MANO
infra/Caddyfile     # = /etc/caddy/Caddyfile en prod (copiar, validar, reload)
docs/               # documentación
.agents/skills/<n>-project/SKILL.md  # skill del proyecto (leerla antes de tocar)
```

## 3. VPS + Caddy + deploy

- Repo clonado en `/opt/<app>`, rama `main`, remoto GitHub.
- **Deploy = aprobación → commit → push → `ssh ... "cd /opt/<app> && git pull --ff-only"` → tests contra prod → reportar.**
- Caddyfile (patrón probado):
  - `root * /opt/<app>` + `encode gzip`
  - `header { nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS, CSP }`
  - `@html` y `@sw` → `Cache-Control: no-cache`
  - `@assets` (`/js/* /vendor/* /icons/*`) → `max-age=60, stale-while-revalidate=86400` (NUNCA 86400 puro: causa archivos viejos hasta 24 h)
  - Tras editar: `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy` y verificar con `curl -sI`
- SSH con clave: `ssh -i <key> -o IdentitiesOnly=yes -o BatchMode=yes root@<IP>`. **Nunca interpolar fechas/`$()` en comandos remotos desde PowerShell** (`date` es alias de Get-Date).
- Backup BD: cron diario, `pg_dump -Fc`, rotación 7 días, log.

## 4. Seguridad (invariantes, no negociables)

- **Roles**: `data-roles` en la UI oculta vistas, **pero RLS en Supabase es la seguridad real** (toda tabla con datos de usuario lleva policy por rol/`created_by`).
- Errores de formulario: `role="alert"` + `aria-describedby`. Diálogos: focus trap. Contraste ≥5:1. Targets táctiles ≥44px. `<th scope>`, labels asociados.
- Protección anti-bots en formularios públicos: Cloudflare Turnstile.
- **SQL**: vive en `supabase/`, se aplica A MANO en SQL Editor + consulta de control posterior. Patrón `hasCol()` para evitar 400 por columnas inexistentes.
- Tokens de test: archivo local **UTF-8 sin BOM** (PowerShell: `[IO.File]::WriteAllText($p,$j,(New-Object Text.UTF8Encoding $false))`).
- Nunca commitear secretos (service keys, credenciales de VPS).
- **NUNCA reescribir archivos con PowerShell `Get-Content`/`Set-Content`** (incidente BOM/mojibake) → usar la herramienta de edición de la IA.

## 5. Tests (obligatorio antes de cada reporte)

- **Suite E2E** (`tests/verificar.js`, Playwright): corre local y contra prod. Env: `JTAS_BASE`, `JTAS_REFRESH`, `JTAS_ACCESS`. Objetivo: ≥30 checks verificando vistas, a11y, seguridad, flujos.
- **Suite local** (login demo): `node server.js` en `127.0.0.1.nip.io:3000` (CLOUD=true) o `localhost:3000` (CLOUD=false).
- Patrón de login en sondas: `goto` → `sb.auth.setSession({access_token, refresh_token})` → `reload` → `waitForFunction(() => typeof S !== 'undefined' && S.datos.length)`. Variables globales son `let` (no viven en `window`).
- Filtrar errores de consola de terceros por URL (`location().url`), no por mensaje.
- Comandos: `npm run test:e2e`, `npm run test:caja` (adaptar scripts por proyecto).
- Antes de reportar: confirmar **local = GitHub = VPS** (`git status` limpio, mismo `git log -1`).

## 6. Flujo de trabajo con la IA

1. Idioma: español (UI y respuestas).
2. **Commit/push SOLO con aprobación explícita** vía question tool.
3. Otra IA/sesión puede tocar el mismo repo → revisar `git status`/`git log` antes de editar.
4. Al terminar: suites completas → aprobar → deploy → tests contra prod → reporte conciso con hash del commit.
5. Sondas/tmp en el directorio temporal del sistema, no en el repo.

## 7. PWA offline + lecciones de caché

- Navegación: **network-first** con respaldo offline. Estáticos: cache-first + refresh en background **con `fetch(..., {cache:'no-cache'})`** (sin eso, la caché HTTP de Caddy hace bucle de archivos viejos).
- `CACHE_NAME` con sufijo de versión (`v5`...) y **bump en cada release**: activa purge automático de la caché vieja.
- `index.html` y `sw.js` siempre `no-cache` en Caddy.
- Lección real: JS con `max-age=86400` + service worker cache-first = usuarios con código viejo hasta 24 h (alert fantasma, bugs ya corregidos, etc.).

## 8. Rendimiento

- `defer` en todos los scripts. Librerías pesadas → **lazy-load con promise** (ej: SheetJS 861 KB solo al exportar, con retry y `onerror` que limpia la promise).
- Medir fría/cálida: primera carga y recarga. Objetivo razonable: fría <2 s / <100 KB crítico.
- Auditorías: `squirrel audit <url> --format llm` (a11y/SEO/perf/security), `audit-website` skill.

## 9. Orden de construcción de un sitio nuevo (checklist)

1. [ ] Repo + `server.js` dev con headers idénticos al futuro Caddy.
2. [ ] Supabase: `schema.sql`, auth, **RLS por rol**, invites.
3. [ ] SPA: login → vistas principales → render (`renderAll` solo vista activa, `go()` re-renderiza).
4. [ ] Sync offline: localStorage + cola push/pull + realtime + badge de estado.
5. [ ] `sw.js` + `manifest.json` (offline PWA).
6. [ ] Tests E2E ≥30 checks + suite local; `package.json` scripts.
7. [ ] VPS: Caddy con headers + cache correcto; deploy `git pull` aprobado; verificar 37/37 (o los que apliquen) en prod.
8. [ ] Backups cron de la BD + log.
9. [ ] Auditoría (a11y, seguridad, perf) y cerrar hallazgos críticos.
10. [ ] Skill del proyecto en `.agents/skills/<n>-project/SKILL.md` + este documento actualizado con los datos reales (sección 0).

## 10. Prompt de arranque para el sitio nuevo

```
Lee PLANTILLA-ARQUITECTURA.md y construye el sitio siguiendo ese patrón.
Datos del proyecto:
- Nombre/descripción: ...
- Repo: ...
- VPS/IP/key: ...
- Dominio: ...
- Supabase URL + anon key: ...
- Cuenta admin de tests: ...
- Pantallas necesarias: ...
Reglas: español, deploy solo con aprobación vía question tool,
tests antes de cada reporte, SQL a mano, seguridad por RLS.
```
