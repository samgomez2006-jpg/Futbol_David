# Mi Equipo FC ⚽

App para entrenadores de fútbol: plantilla, partidos (alineación, goles, tarjetas, minutos), entrenamientos,
evaluaciones, objetivos, convocatorias y análisis automático.
**Una sola base de código** para **web (Vercel)**, **iOS** y **Android** (Capacitor), con **Supabase** para cuentas y
sincronización entre dispositivos.

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

Pasos manuales en el panel de Supabase (**Authentication**):

1. **URL Configuration** → *Site URL*: la URL de Vercel (p. ej. `https://futbol-david.vercel.app`) y añádela en *Redirect URLs* junto a `http://localhost:5173/**`.
2. **Email Templates → Magic Link**: añade el código al email para poder entrar desde las apps nativas, p. ej.
   `<p>Tu código de acceso: <strong>{{ .Token }}</strong></p>` (el enlace sigue funcionando en web).
3. Opcional: configura un SMTP propio (*Authentication → SMTP*); el de Supabase está limitado a unos pocos emails por hora.

## Vercel

Importa el repositorio en Vercel (framework *Vite*, se detecta solo gracias a `vercel.json`) y añade las variables
`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (valores en `.env.example`). Cada push a `main` despliega
producción y cada PR genera una URL de vista previa.
