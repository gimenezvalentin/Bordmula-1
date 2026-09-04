# Bórdmula 1

Scorer de **tapas de diario** para la sección de Tomás Rebord: se puntúan las portadas
del 1 al 10 (con decimales), más dos resultados joke — **"Chocó"** y **"Se quedó sin
motor"** — y se lleva una **tabla de campeonato** estilo Fórmula 1 (suma total de puntos).

- **`index.html`** — el scorer. Requiere login. Lo usa Tomás en vivo.
- **`campeonato.html`** — página pública, solo lectura, con la tabla y el histórico.

Frontend estático (sin build) en **GitHub Pages**. Datos y login en **Supabase** (free).
Sin credenciales cargadas, la app corre en **modo demo** y guarda todo en el navegador —
útil para probar la interfaz.

---

## 1. Probar local (modo demo, sin backend)

Los ES modules no cargan por `file://`, hace falta un server:

```bash
python -m http.server 8000
```

Abrí <http://localhost:8000/index.html>. En modo demo entrás sin contraseña.

## 2. Configurar Supabase (una vez)

1. Crear un proyecto free en <https://supabase.com>.
2. **Authentication → Providers → Email**: activar.
   **Authentication → Settings**: desactivar *"Allow new users to sign up"*.
   **Authentication → Users → Add user**: crear el usuario de Tomás (email + contraseña).
3. **SQL Editor → New query**: pegar y correr [`supabase/schema.sql`](supabase/schema.sql)
   (crea las tablas `papers` / `events` / `results`, las políticas RLS y el roster inicial).
4. **Storage → New bucket**: nombre **`tapas`**, marcar **Public bucket**.
   En **Storage → Policies** del bucket `tapas`: permitir `SELECT` a todos y
   `INSERT/UPDATE/DELETE` solo a `authenticated` (hay plantillas en el editor).
5. **Project Settings → API**: copiar *Project URL* y la *anon public key* a
   [`js/config.js`](js/config.js).

## 3. Publicar en GitHub Pages

```bash
git init && git add . && git commit -m "Bórdmula 1"
# crear el repo en GitHub y:
git remote add origin https://github.com/USUARIO/Bordmula_1.git
git push -u origin main
```

En el repo: **Settings → Pages → Build and deployment → Deploy from a branch**,
branch `main`, carpeta `/ (root)`.

- Scorer: `https://USUARIO.github.io/Bordmula_1/index.html`
- Campeonato (para la audiencia): `https://USUARIO.github.io/Bordmula_1/campeonato.html`

> `js/config.js` queda con la URL y la anon key a la vista. Es **correcto**: la anon key
> es pública por diseño; lo que protege los datos es la RLS (lee cualquiera, escribe solo
> con sesión). Por eso los signups están deshabilitados.

## 4. Mantener Supabase despierto

El proyecto free se pausa tras 7 días sin uso. El workflow
[`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) hace un ping cada 3
días. Cargar en **Settings → Secrets and variables → Actions**:

- `SUPABASE_URL` = `https://TU-PROYECTO.supabase.co`
- `SUPABASE_ANON_KEY` = la anon key

---

## Uso durante el programa

1. Entrar a `index.html` y loguearse.
2. Elegir **Fecha** y ponerle nombre al **Gran Premio** (o *Nueva fecha*).
3. Por cada diario: subir / pegar / arrastrar la tapa, y poner la nota con el slider o el
   número. O marcar **Chocó** / **Se quedó sin motor**. Comentario opcional.
   - Todo se guarda como **borrador local** automáticamente.
   - Click en una tapa abre el **visor con zoom** (rueda, arrastrar, doble click, pinch).
4. Tocar **Publicar fecha** → sube puntajes e imágenes a Supabase. Se puede re-publicar la
   misma fecha para corregir.
5. La audiencia mira `campeonato.html`.

**Diarios**: el botón *Diarios* del scorer permite agregar/renombrar/recolorar la lista y
cambiar el orden.

**Respaldo**: *Respaldo* baja un JSON con todo; *Importar* lo restaura (estado local).

---

## Estructura

```
index.html / campeonato.html   páginas
css/styles.css                 estética "Sticker" (crema + cobalto + naranja, contornos negros)
js/
  config.js        credenciales de Supabase (públicas)
  supabase.js      cliente (SDK desde CDN)
  auth.js          login / logout
  data.js          lecturas + roster semilla
  draft.js         borrador local (localStorage + IndexedDB)
  img.js           redimensionado de imágenes
  publish.js       "Publicar" -> Storage + upsert
  scoring.js       cálculo del campeonato (puro)
  zoom.js          visor de imágenes con zoom
  ui-grid.js       grilla de puntuación
  ui-standings.js  timing tower
  ui-history.js    histórico fecha por fecha
  ui-io.js         respaldo JSON
  papers.js        editor del roster
  app.js           orquestador del scorer
  campeonato.js    orquestador de la página pública
supabase/schema.sql
.github/workflows/keepalive.yml
```

## Fase 2 (todavía no)

Scraper automático de tapas (GitHub Action diario desde kiosko.net al bucket `tapas/`).
Hoy la carga es manual.
