# Publicar el juego para jugar online (Firebase, plan gratuito)

Contra la computadora el juego funciona sin nada de esto. Para jugar con otra persona hace falta un
proyecto de Firebase en el plan **Spark** (gratuito, sin tarjeta) y publicar la web. Unos 15 minutos.

## Requisitos

- Una cuenta de Google.
- **Node.js 20 o superior** y **git** instalados en tu ordenador.

## 1. Crear el proyecto (consola web)

1. Entra en <https://console.firebase.google.com> y pulsa **Crear un proyecto**. Ponle un nombre
   (por ejemplo `sunken-covenant`). Google Analytics no hace falta: desactívalo.
2. **Compilación → Authentication → Comenzar → Método de acceso → Anónimo → Habilitar → Guardar.**
3. **Compilación → Realtime Database → Crear base de datos.** Elige ubicación (Bélgica,
   `europe-west1`, va bien) y **modo bloqueado**.
4. **Rueda dentada → Configuración del proyecto → Tus apps → icono `</>` (Web).** Ponle un apodo,
   **no** marques Hosting ahí, y pulsa Registrar. Copia el bloque `firebaseConfig` que aparece.

## 2. Preparar el juego en tu ordenador

```bash
git clone -b claude/dreamy-wright-ki736d https://github.com/soymachine/the-sunken-conventnat.git
```

```bash
cd the-sunken-conventnat
```

```bash
npm install
```

Copia `.env.example` a `.env.local` y rellénalo con los valores de `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=...            (apiKey)
VITE_FIREBASE_AUTH_DOMAIN=...        (authDomain)
VITE_FIREBASE_PROJECT_ID=...         (projectId)
VITE_FIREBASE_APP_ID=...             (appId)
VITE_FIREBASE_DATABASE_URL=...       (databaseURL)
```

`.env.local` no se sube a git. Estas claves no son secretas (viajan en el navegador de cada jugador);
lo que protege los datos son las reglas que se publican en el paso 3.

## 3. Publicar

```bash
npx firebase-tools login
```

```bash
npx firebase-tools use --add
```

Elige tu proyecto y, cuando pida un alias, escribe `default`.

```bash
npm run deploy
```

Este último comando compila el juego y publica las **reglas de la base de datos** y la **web**. Al
terminar imprime la dirección pública: `https://<tu-proyecto>.web.app`.

## 4. Jugar

1. Los dos abrís esa dirección en un ordenador.
2. Uno escribe su nombre, elige **Classic** o **Convoy** y pulsa **Create a room**.
3. Le pasa al otro el **código de cuatro caracteres**; el otro lo escribe y pulsa **Join**.
4. Cada uno coloca su flota y gira el cabrestante **Ready**.
5. Si alguien recarga la página, vuelve solo a su asiento (el código queda en la dirección, `#ABCD`).

## Actualizar cuando haya cambios nuevos

```bash
git pull
```

```bash
npm install
```

```bash
npm run deploy
```

## Si algo falla

- **El lobby dice "Online rooms need a Firebase project":** `.env.local` falta o está incompleto.
  Rellénalo y repite `npm run deploy`.
- **Se queda en "Hailing the room…" o da error de permisos:** el acceso anónimo no está habilitado
  (paso 1.2) o las reglas no se publicaron (repite `npm run deploy`).
- **`databaseURL` no aparece en `firebaseConfig`:** crea primero la base de datos (paso 1.3) y vuelve
  a mirar la configuración. Tiene la forma
  `https://<proyecto>-default-rtdb.europe-west1.firebasedatabase.app`.
- **"No room with that code":** el código no existe o tiene un carácter mal; no usa las letras I y O
  ni los números 0 y 1.

## Cómo funciona

- Cada sala es `/rooms/{código}` con un registro de mensajes que solo se puede ampliar, nunca editar.
- `database.rules.json` solo deja leer y escribir a los dos capitanes de la sala, y cada uno solo
  puede firmar mensajes como sí mismo.
- La posición de tu flota **no sale de tu navegador** durante la partida: tu cliente responde a los
  disparos que caen en tus aguas. Al terminar, ambos revelan colocación y movimientos, y cada cliente
  reproduce la partida del otro para comprobar que no mintió. Un tramposo queda señalado al final;
  no se le bloquea en el momento (para eso haría falta un servidor de pago).

## Probar en local sin proyecto

Necesita Java instalado.

```bash
npm run emulators
```

```bash
npm run dev:emu
```

Abre la dirección en dos ventanas de navegador distintas (una normal y otra privada, para que sean
dos jugadores diferentes).
