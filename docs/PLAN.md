# The Sunken Covenant — Plan de desarrollo

## Contexto

Juego naval 1 contra 1, multiplayer en navegador, inspirado en *hundir la flota* pero con barcos
del siglo XIX, puntos de acción, movimiento de barcos, sub-objetivos, power-ups y el Kraken.
El repo está **vacío** (rama `claude/dreamy-wright-ki736d`, sin commits), así que se parte de cero.

Decisiones ya tomadas contigo:

| Tema | Decisión |
|---|---|
| Render | three.js, 3D, formas simples (low-poly procedural) en la primera versión |
| Multiplayer | **Firebase Realtime Database**, plan gratuito Spark |
| Turnos | **Alternos**, 3 puntos de acción (AP) por turno |
| Idioma UI | Inglés |
| Bocetos | Página HTML/SVG ilustrada |
| Estética | Negro + ámbar/pergamino, grabado del XIX, UI de madera y latón con maquinaria que gira |

**Primer entregable (lo que se hace al aprobar este plan):** `PLAN.md` en el repo + página de bocetos.
El juego en sí se construye después, por fases.

---

## 1. Diseño de juego

### Núcleo
- Cada jugador tiene sus aguas: cuadrícula **16×16** (ampliada desde 10×10). Gana quien hunde toda la flota rival.
- Colocación secreta inicial, luego turnos alternos con **3 AP** y temporizador de 75 s.
- Los AP no gastados **no** se acumulan (salvo 1 con el power-up *Trade Winds*).

### Acciones y coste
| Acción | AP | Efecto |
|---|---|---|
| Fire | 1 | Cañonazo a una casilla enemiga |
| Sail | 1 | Avanza/retrocede un barco 1 casilla sobre su eje |
| Turn | 1 | Rota un barco 90° sobre su centro (si cabe) |
| Ability | 1–3 | Habilidad de clase o power-up |

Reglas que hacen interesante moverse:
- Las casillas tocadas viajan con el barco; los "agua" del rival quedan **obsoletos**.
- Un barco dañado deja una **estela de restos** en la casilla que abandona (pista visible para el rival).
- Un barco con 2+ impactos no puede rotar.

### Flota (siglo XIX), cada clase con identidad propia
| Barco | Tamaño | Rasgo |
|---|---|---|
| Ship of the Line | 5 | *Broadside*: 2 AP, dispara una línea de 3 casillas |
| Frigate | 4 | *Chain Shot*: 2 AP, el barco alcanzado no puede moverse el próximo turno |
| Ironclad | 3 | *Armour*: el primer impacto recibido no cuenta (pero revela "clang") |
| Schooner | 3 | *Swift*: se mueve 2 casillas por 1 AP |
| Cutter | 2 | *Spyglass*: 1 AP, dice cuántas casillas ocupadas hay en un área 3×3 |

### Sub-objetivos
- **Treasure / Shipwrecks**: aparecen en ambas aguas, **visibles para los dos**. Para cobrarlos hay
  que poner un barco encima → el rival sabe adónde vas (puede bombardear o minar la zona). Dan doblones.
- **Covenant Seals** (3 por partida): reliquias sumergidas. Reunir **3** permite **invocar al Kraken**.
  Mecánica de remontada: al perder un barco recibes 1 sello ("the drowned pay their toll").
- **Admiralty Orders**: 1 misión secreta activa por jugador ("sink a ship within 3 turns",
  "land 3 hits in a row", "collect a treasure with the Cutter") → recompensa en doblones/power-up.
- **Lighthouse**: casilla especial; mantener un barco adyacente 2 turnos revela una fila del rival.

### Power-ups (se compran con doblones en el *Quartermaster*)
Spyglass (escaneo 3×3) · Sea Mine (trampa en aguas propias que daña a quien navegue… y delata disparos) ·
Fire Ship (impacto en cruz) · Fog Bank (zona 3×3 propia inmune a escaneos 2 turnos) ·
Shipwright (repara 1 casilla) · Trade Winds (+1 AP el turno siguiente) · Decoy (falso "hit" flotante).

### El Kraken
- Coste: 3 sellos + 3 AP. Eliges una zona **3×3** enemiga.
- Durante 2 turnos: los tentáculos golpean 3 casillas aleatorias de la zona por turno y los barcos
  dentro quedan **atrapados** (no pueden moverse).
- El rival ve la zona burbujear un turno antes (*omen*) si posee un Lighthouse → contrajuego.

### Eventos dinámicos (ritmo moderno)
- **Storm**: frente que cruza el mapa; casillas bajo tormenta no se pueden disparar ni escanear.
- **Tide**: cada 5 rondas, corriente que desplaza 1 casilla los tesoros/restos.
- **Maelstrom (muerte súbita)**: desde la ronda 20, el borde del mapa se hunde anillo a anillo;
  garantiza partidas de 10–15 min.

Estas mecánicas entran por capas (ver fases); los números se ajustan jugando.

---

## 2. Dirección visual y UI

- **Paleta**: tinta `#0d0b08`, sepia oscuro `#2a2116`, ámbar `#d9a441`, pergamino `#e8d5a3`,
  latón `#b08d3c`, acento rojo lacre `#8c2f1b` solo para impactos.
- **Mundo 3D**: el mar como una **carta náutica viva** — plano de pergamino con líneas de rumbo,
  shader de trazo/grabado (hatching), olas dibujadas a tinta, niebla sepia. Barcos low-poly
  procedurales (casco + mástiles + velas) con contorno de tinta. Kraken: tentáculos de tubo
  segmentado animados.
- **UI de madera y latón** (HTML/CSS sobre el canvas):
  - **Telégrafo de máquinas** de latón: palanca que gira para elegir Fire / Sail / Turn / Ability.
  - **3 fichas de AP** como monedas/balas que caen en una bandeja al gastarse.
  - **Rosa de los vientos** giratoria como indicador de turno y temporizador.
  - **Cabrestante** que rota para pasar turno; **catalejo** extensible para el escaneo.
  - Cuaderno de bitácora (log de jugadas) en pergamino con tipografía de grabado
    (IM Fell English / Cinzel, vía Google Fonts).

Boceto de la pantalla de partida:

```
┌──────────────────────────────────────────────────────────────┐
│ [rosa de vientos/turno]   THE SUNKEN COVENANT   [sellos ◉◉○] │
│ ┌─────────┐   ╔══════════ ENEMY WATERS ══════════╗ ┌───────┐ │
│ │ Captain │   ║   carta náutica 3D, cuadrícula   ║ │ Log   │ │
│ │ Orders  │   ║   grabada, tormenta, tesoros     ║ │ book  │ │
│ │ Doubloon│   ╠══════════ YOUR WATERS ═══════════╣ │       │ │
│ └─────────┘   ║   tus barcos, estelas, minas     ║ └───────┘ │
│               ╚══════════════════════════════════╝           │
│ [telégrafo: FIRE·SAIL·TURN·ABILITY]  [AP ●●●]  [cabrestante] │
└──────────────────────────────────────────────────────────────┘
```

### Entregable de bocetos
`docs/sketches/index.html` — una sola página autocontenida (HTML + SVG + CSS, sin dependencias)
con 5 láminas: (1) pantalla de partida, (2) lobby/crear sala, (3) colocación de flota,
(4) invocación del Kraken, (5) hoja de componentes UI (telégrafo, rosa, cabrestante, fichas AP,
paleta y tipografías). Se publica además como Artifact para verla en el navegador.

---

## 3. Arquitectura técnica

- **Stack**: Vite + TypeScript + three.js; Vitest para tests; Firebase JS SDK (Auth anónima + RTDB);
  despliegue en **Firebase Hosting** (gratis). Sin Cloud Functions (requieren plan de pago).
- **Estructura**:
  ```
  src/game/      lógica pura y determinista (reglas, AP, flota, habilidades, Kraken) — sin three ni red
  src/net/       adaptador Firebase (salas, presencia, sincronización) + adaptador local (hot-seat/bot)
  src/render/    escena three.js (mar-carta, barcos, efectos, cámara)
  src/ui/        HUD de madera/latón (DOM + CSS), lobby, colocación
  docs/          PLAN.md, sketches/
  database.rules.json, firebase.json
  ```
- **Modelo multiplayer** (información oculta sin servidor de pago):
  - `/rooms/{code}/public` — turno, AP, log de acciones, casillas reveladas, tesoros, eventos.
  - `/rooms/{code}/private/{uid}` — posiciones de la flota; reglas RTDB: solo lectura/escritura del dueño.
  - **El defensor resuelve**: el atacante escribe la acción; el cliente del defensor responde
    hit/miss/sunk. Reglas RTDB validan turno y AP.
  - Anti-trampas ligero: cada jugador publica un **hash** de su colocación y de cada movimiento;
    al terminar se revelan y el otro cliente verifica la partida completa.
  - Presencia con `onDisconnect`; reconexión leyendo el estado de la sala; RNG con semilla
    compartida (Kraken, eventos) para que ambos clientes vean lo mismo.
- **Necesario por tu parte** (fase 2): crear un proyecto Firebase gratuito (puedo guiarte o
  hacerlo con las herramientas de Firebase de esta sesión, con tu confirmación).

---

## 4. Fases

0. **Plan y bocetos** ← *esto es lo que se ejecuta ahora*: `docs/PLAN.md` (este documento) +
   `docs/sketches/index.html`, commit y push a `claude/dreamy-wright-ki736d`.
1. **Vertical slice local**: scaffold Vite/TS, `src/game` con reglas núcleo (colocar, disparar,
   mover, AP, victoria) y tests; escena 3D básica; partida hot-seat contra un bot simple.
2. **Multiplayer**: Firebase (auth anónima, salas con código, reglas, presencia, reconexión), deploy.
3. **Profundidad**: rasgos de clase, tesoros, doblones, power-ups, Admiralty Orders.
4. **El Kraken y eventos**: sellos, invocación, storm, tide, maelstrom.
5. **Pulido**: UI mecánica animada, shader de grabado, sonido, tutorial, equilibrio.
6. *(Futuro)* modelos 3D detallados, ranking, espectadores.

---

## 5. Verificación

- **Fase 0**: abrir `docs/sketches/index.html` con Playwright/Chromium, capturar pantalla a
  ancho escritorio y móvil, comprobar que las 5 láminas se ven y no hay errores de consola.
- **Fases 1+**: `npm test` (Vitest sobre `src/game`), `npm run build`, y prueba end-to-end con
  Playwright abriendo dos pestañas contra el **emulador de Firebase** para jugar una partida completa.

---

## Estado (actualizado)

- **Hecho:** fase 0 (plan y bocetos), fase 1 (partida contra la computadora), fase 2 (salas online
  con Firebase, reconexión, verificación al final) y fase 3 (rasgos de clase, tesoros y doblones,
  power-ups, Órdenes del Almirantazgo). Mapa de 16×16.
- **Cambios respecto al plan original:** escaneos y niebla cubren 5×5 en vez de 3×3 por el mapa
  grande; no hay minas ni señuelos; los sellos del pacto se dejan para la fase 4 junto al Kraken.
- **Pendiente:** fase 4 (Kraken, sellos, tormenta, marea, remolino), fase 5 (pulido, sonido, tutorial,
  temporizador de turno), fase 6 (modelos 3D detallados).
