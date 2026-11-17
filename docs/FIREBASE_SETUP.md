# Activar el multiplayer (Firebase, plan gratuito)

El juego funciona sin esto contra la computadora. Para las salas online hace falta un proyecto de
Firebase en el plan **Spark** (gratuito, sin tarjeta). Son unos 10 minutos.

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> y pulsa **Add project**. Google Analytics no hace falta.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Realtime Database → Create database.** Elige la región y empieza en **locked mode**.
4. **Project settings (rueda dentada) → Your apps → Web (`</>`)**. Registra la app y copia el objeto `firebaseConfig`.

## 2. Conectar el juego

Copia `.env.example` a `.env.local` y rellénalo con los valores de `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=https://<proyecto>-default-rtdb.<region>.firebasedatabase.app
```

`.env.local` no se sube a git. Estas claves no son secretas (viajan en el navegador de cada jugador);
lo que protege los datos son las reglas del paso 3.

## 3. Publicar las reglas y el juego

```bash
npx firebase-tools login
```

```bash
npx firebase-tools use --add
```

```bash
npm run build
```

```bash
npx firebase-tools deploy --only database,hosting
```

El último comando imprime la dirección pública (`https://<proyecto>.web.app`). Compártela con tu rival:
uno pulsa **Create a room**, le pasa el código de cuatro caracteres y el otro pulsa **Join**.

## Cómo funciona

- Cada sala es `/rooms/{código}` con un registro de mensajes que solo se puede ampliar, nunca editar.
- `database.rules.json` solo deja leer y escribir a los dos capitanes de la sala, y cada uno solo
  puede firmar mensajes como sí mismo.
- La posición de tu flota **no sale de tu navegador** durante la partida: tu cliente responde a los
  disparos que caen en tus aguas. Al terminar, ambos revelan colocación y movimientos, y cada cliente
  reproduce la partida del otro para comprobar que no mintió. Un tramposo queda señalado al final;
  no se le bloquea en el momento (para eso haría falta un servidor de pago).
- Si recargas la página vuelves a tu asiento: el código de sala queda en la dirección (`#ABCD`) y tu
  flota se guarda en el navegador.

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
