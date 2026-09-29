# Mi Equipo FC ⚽

Plataforma para entrenadores de fútbol: **gestionar** (plantilla, convocatorias, asistencia), **planificar** (modelo de juego,
rival, planteamiento del partido, pizarra táctica), **registrar** (partidos, alineaciones, cambios, minutos, goles con su zona,
observaciones) y **analizar** (estadísticas, tendencias, mapas de zonas de gol, patrones en tus observaciones).
Una sola base de código para **web (Vercel)**, **iOS** y **Android** (Capacitor), con **Supabase** para cuentas y sincronización.

Producción: **https://futbol-david.vercel.app**

## Qué hay dentro

| Sección | Qué hace |
|---|---|
| **Inicio** | Próximo partido, último resultado y racha, KPIs, accesos rápidos y el bloque **Herramientas tácticas** (pizarra, jugadas, alineaciones, evaluaciones, objetivos, convocatorias). |
| **Plantilla** | Nombre, dorsal, posición y **minutos jugados** visibles en la lista, con goles, asistencias y partidos; todo se actualiza solo desde los partidos. |
| **Partidos** | Próximos / jugados / papelera. Ficha completa: convocados, **alineación visual sobre el campo**, suplentes, **cambios**, minutos automáticos, goles (jugada, penalti, falta, propia puerta, centro…), **zona de cada gol**, tarjetas, incidencias, **información del rival**, **planteamiento en ataque y defensa** y observaciones. |
| **Convocatorias y asistencia** | Al crear una convocatoria se crea sola la ficha del partido con los convocados (sin teclear nada dos veces). Entrenos, convocatorias y resumen por jugador. |
| **Analíticas** | Hallazgos automáticos (1ª vs 2ª parte, evolución, carga de minutos, participación…), **dos mapas de burbujas de zonas** (goles realizados y recibidos), patrones detectados en tus observaciones, tipos de gol, rendimiento por sistema. |
| **Equipo** | Información general, cuerpo técnico, sistema habitual, modelo y principios de juego, ideas tácticas (todo editable), cuenta y exportaciones. |
| **Pizarra táctica** | Campo completo / medio / zona libre, jugadores, rivales, balón, conos, porterías, zonas y texto; movimientos, pases y conducciones; deshacer/rehacer, animación, guardar, editar, duplicar y exportar (PNG, PDF, JSON). |
| **Exportar** | Excel (.xlsx), CSV y PDF de plantilla, partidos, goles, minutos, convocatorias, asistencia y analíticas; ficha de partido en PDF. |

## Zonas de gol

La división del campo está definida **una sola vez** en `src/lib/zones.ts` (10 zonas sobre media pista, portería atacada arriba) y
la usan tanto el selector táctil al registrar el gol como los mapas de Analíticas. Los porcentajes se calculan como
`goles de la zona / goles con zona × 100`, y hasta que no hay 5 goles con zona el mapa avisa de que aún no hay registros suficientes.
> La imagen de referencia de zonas no llegó adjunta: se usó una división estándar (área pequeña, tres zonas del área, frontal,
> exteriores, bandas y larga distancia). Si quieres otra, basta con editar la lista `ZONES`: registro y analíticas cambian juntos.

## Arquitectura

| Capa | Elección | Por qué |
|---|---|---|
| UI | React 19 + TypeScript + Vite, CSS propio | El diseño original era web móvil; React elimina el `innerHTML` con datos del usuario (XSS) y TypeScript evita errores de tipos como el bug de los IDs. |
| Móvil | Capacitor 8 (`ios/`, `android/`) | Reutiliza el 100% del código web en apps nativas reales de App Store / Google Play. Reescribir en React Native/Flutter habría costado rehacer toda la interfaz sin ganar nada para este tipo de app. |
| Web | PWA en Vercel (`vercel.json`) | Instalable, funciona sin conexión (service worker). |
| Datos | **Local-first** + Supabase | Todo se guarda al instante en el dispositivo (funciona en el campo sin cobertura). Con sesión iniciada, los cambios van a una cola (*outbox*) que se sube a Supabase al recuperar conexión. |
| Seguridad | RLS por equipo | Cada tabla cuelga de `team_id`; solo los miembros del equipo (`team_members`) pueden leer/escribir. El cuerpo técnico se une con un código de invitación. |

```
src/
  lib/        dominio puro y testeado: tipos, estadísticas/análisis, fechas, copias de seguridad
  store/      estado (zustand), persistencia y motor de sincronización con Supabase
  pages/      pantallas (rutas)
  sheets/     formularios en hojas inferiores
  components/ piezas de UI (campo táctico, portería, overlays…)
supabase/migrations/  esquema SQL + RLS (ya aplicado al proyecto)
legacy/index-v4.html  versión original en un solo HTML (referencia)
```

La app funciona **sin cuenta** (modo local, como el HTML original). Al iniciar sesión se crea el equipo en la nube
y se suben los datos del dispositivo. Las copias de la versión antigua (JSON exportado del HTML) se pueden importar
desde *Configuración → Importar*, y si la app se abre en el mismo origen que el HTML antiguo, migra sus datos sola.

## Fallos del HTML original corregidos

1. **Las estadísticas de goles, asistencias y tarjetas nunca contaban**: los `<select>` guardaban el ID del jugador como texto (`"3"`) y se comparaba con `===` contra un número (`3`). Máximo goleador, participaciones y objetivos de goles quedaban siempre a 0 y el detalle del partido mostraba "—" como goleador. (Test de regresión en `src/lib/stats.test.ts`; la importación repara las copias antiguas.)
2. **XSS**: nombres, rivales y notas se pintaban con `innerHTML`; un nombre como `<img onerror=…>` o un JSON importado ejecutaba código. Además un apóstrofo en un nombre rompía los `onclick`.
3. **Goles sin minuto se borraban al guardar** (`filter(g => g.min)`), sin avisar.
4. **Minutos irreales**: todos los titulares jugaban el partido entero y los suplentes 0' (nunca contaban como partido jugado). Ahora se registran los minutos de cada jugador.
5. **Fechas en UTC** (`toISOString`): de madrugada se guardaba el día anterior; la edad podía salir un año mal.
6. **La papelera no se vaciaba nunca** (decía "se elimina en 0 días" para siempre). Ahora se purga a los 30 días.
7. **Entrenamiento desde Inicio** se guardaba sin fecha y con las casillas de la vez anterior; no había forma de ver, editar ni borrar entrenamientos.
8. **Cancelar una convocatoria la modificaba igualmente** (se editaba el objeto guardado por referencia).
9. **Borrar un jugador dejaba referencias colgando**. Ahora se puede *dar de baja* (conserva estadísticas) o eliminar en cascada.
10. **Cambiar la formación vaciaba la alineación**; ahora recoloca a los jugadores.
11. **Análisis por franjas fijas de 10' con "51+"**: inútil para partidos de 70' u 90'. Ahora son tramos proporcionales a la duración.
12. **Objetivos**: los "personalizados" no se podían actualizar, "asistencias de equipo" siempre daba 0 y se mostraba la clave interna (`wins`).
13. **Marcador y goles detallados podían contradecirse** (3 goles detallados en un 1-0). Ahora se valida.
14. Dorsales duplicados, temporada por defecto caducada (`2024-25`), `user-scalable=no` (accesibilidad), sin modo oscuro, sin manifest/service worker (no era instalable), `confirm()` nativos, archivo `Code HTML` duplicado con el `<!DOCTYPE>` roto.

## Mejoras nuevas

Sincronización en la nube y varios entrenadores por equipo · funciona offline · modo oscuro · botón atrás de Android ·
fútbol 7 y fútbol 8 · compartir convocatoria por WhatsApp (hora y lugar incluidos) · buscador de plantilla ·
ranking de minutos · origen de goles en contra · copias de seguridad compatibles con la versión antigua ·
navegación lateral en tablet/escritorio · accesibilidad (roles, foco, tamaños táctiles de 44px).

## Desarrollo

```bash
cp .env.example .env     # URL y clave publicable de Supabase (públicas por diseño; la seguridad es RLS)
npm install
npm run dev              # http://localhost:5173
npm test                 # tests de dominio (vitest)
npm run lint && npm run typecheck
```

### Apps nativas

```bash
npm run android          # build + cap sync + abre Android Studio
npm run ios              # build + cap sync + abre Xcode (requiere macOS)
npm run assets           # regenera iconos/splash desde assets/
```

El CI (`.github/workflows/ci.yml`) compila un **APK de Android** en cada push y lo deja como artefacto descargable.
La compilación de iOS se lanza a mano (*Actions → CI → Run workflow → iOS*). Para publicar en las tiendas hace falta
firmar: cuenta de Apple Developer (99 $/año) y cuenta de Google Play Console (25 $ una vez).
Identificador de la app: `com.futboldavid.miequipo` (cámbialo en `capacitor.config.ts` antes de publicar si quieres otro).

## Supabase

Proyecto `futbol-david` (región París, plan gratuito). Las migraciones de `supabase/migrations/` ya están aplicadas.

Pasos manuales en el panel de Supabase (**Authentication**) — **necesarios para que el enlace del email funcione**:

1. **URL Configuration → Site URL**: `https://futbol-david.vercel.app`. Añade también `https://futbol-david.vercel.app/**` y
   `http://localhost:5173/**` en *Redirect URLs*. (Con el valor por defecto `http://localhost:3000` el enlace de verificación verifica
   la cuenta pero redirige a una página que no existe: por eso «fallaba».)
2. **Email Templates → Confirm signup / Magic Link**: añade `{{ .Token }}` para poder entrar con el código de 6 dígitos (opcional).
3. **SMTP propio** (recomendado): el correo integrado de Supabase está muy limitado (pocos emails por hora).
4. *(Plan Pro)* **Password security → Leaked password protection**.

**Acceso:** la app exige iniciar sesión (email + contraseña, o código por email). Cada usuario solo ve los datos de su equipo
(RLS por `team_id`); al cambiar de cuenta en un mismo dispositivo los datos de la anterior se descartan. Si el enlace del email
no abre la app, la cuenta queda verificada igualmente y basta con volver y pulsar «Ya he verificado mi email».

## Vercel

Producción: **https://futbol-david.vercel.app** (proyecto `futbol-david`, enlazado a este repositorio).
Cada push a `main` se despliega automáticamente en producción; las ramas y PR generan vistas previas
(protegidas con Vercel Authentication). Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
ya están configuradas en el proyecto.

## Datos de partida

`SAGRAT_COR_backup.json` (SAGRAT COR · Cadete Sub15 · 2026-27, 17 jugadores) va incluido en la app: en la pantalla de bienvenida
aparece **«Cargar el equipo SAGRAT COR»**, que crea el equipo en tu cuenta con toda la plantilla en un clic. No se aplica solo ni
encima de datos existentes. También se puede importar cualquier otra copia .json.
> ⚠️ **Pendiente de seguridad:** al ir dentro de la app, cualquier visitante de la web puede leer esos datos (nombres de menores).
> La fase de seguridad debe sacarlos del código público (por ejemplo, cargarlos solo desde la base de datos con permisos).
