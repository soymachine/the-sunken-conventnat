// Two languages, English (the source) and Spanish. The game writes English; a watcher swaps every text node and
// label for its Spanish before the frame is painted (mutation observers run before rendering), so nothing ever
// flickers. Switching back restores the English it replaced. Players' own words (names, bottle notes) are left
// alone: mark such elements with translate="no".
export type Lang = 'en' | 'es';

const DIR: Record<string, string> = { east: 'este', south: 'sur', west: 'oeste', north: 'norte' };
const SHIPS: Record<string, string> = {
  'Ship of the Line': 'Navío de línea', Frigate: 'Fragata', Ironclad: 'Acorazado', Schooner: 'Goleta', Cutter: 'Cúter', Merchantman: 'Mercante',
};
const ship = (s: string) => SHIPS[s] ?? s;
/** "el Navío de línea" / "la Fragata": the article the ship's name takes. */
const the = (s: string) => (/^(Fragata|Goleta)/.test(ship(s)) ? 'la ' : 'el ') + ship(s);

const EXACT: Record<string, string> = {
  // Home
  'A competitive multiplayer naval strategy game inspired by the golden age of sailing warfare.': 'Un juego multijugador competitivo de estrategia naval inspirado en la edad de oro de la guerra a vela.',
  "Captain's name": 'Nombre del capitán', 'Sign your name': 'Firma con tu nombre', 'Kind of battle': 'Tipo de batalla',
  Classic: 'Clásica', 'Sink the whole enemy fleet.': 'Hunde toda la flota enemiga.', Convoy: 'Convoy',
  'One escorts the cargo home, the other plunders it. Roles are drawn by lot.': 'Uno escolta la carga hasta puerto, el otro la saquea. Los papeles se sortean.',
  'Play the machine': 'Jugar contra la máquina', 'or sail against a friend': 'o navega contra un amigo', 'Create a room': 'Crear una sala',
  Join: 'Unirse', 'Your room': 'Tu sala', 'Copy code': 'Copiar código', 'Copy invite link': 'Copiar enlace', CODE: 'CÓDIGO', 'Room code': 'Código de sala',
  Copied: 'Copiado', 'Link copied': 'Enlace copiado', 'A room code has four characters.': 'El código de sala tiene cuatro caracteres.',
  'Send the code or the link to your rival. The battle begins as soon as they join…': 'Envía el código o el enlace a tu rival. La batalla empieza en cuanto se una…',
  'Online rooms need a Firebase project — see docs/FIREBASE_SETUP.md.': 'Las salas online necesitan un proyecto de Firebase: mira docs/FIREBASE_SETUP.md.',
  'Hailing the room…': 'Llamando a la sala…',
  // Settings
  Settings: 'Ajustes', Sound: 'Sonido', On: 'Sí', Off: 'No', '3D quality': 'Calidad 3D', Auto: 'Auto', High: 'Alta', Low: 'Baja', Language: 'Idioma',
  'Auto steps down by itself if the game runs slowly. Low drops shadows, glow and the print grade.': 'Auto baja la calidad sola si el juego va lento. Baja quita sombras, brillos y el tono de grabado.',
  Debug: 'Depuración', Sky: 'Cielo', 'Sun rays': 'Rayos de sol', Aurora: 'Aurora', Clear: 'Despejado', Pointer: 'Puntero', Brass: 'Latón', Quill: 'Pluma', System: 'Sistema',
  // Panels and desk
  'The covenant': 'El pacto', 'Admiralty orders': 'Órdenes del Almirantazgo', Money: 'Dinero', 'Buy ›': 'Comprar ›', 'Your fleet': 'Tu flota', Quartermaster: 'Intendente',
  'Enemy fleet': 'Flota enemiga', 'Cast a bottle': 'Lanzar botella', 'End turn': 'Fin del turno', Ready: 'Listo', 'To your station': 'A tu puesto', 'Back to port': 'Volver a puerto',
  FIRE: 'FUEGO', SAIL: 'NAVEGAR', TURN: 'VIRAR', ABILITY: 'HABILIDAD', Maelstrom: 'Maelstrom', 'Action points': 'Puntos de acción', Doubloons: 'Doblones',
  'Orders and action points': 'Órdenes y puntos de acción', 'A message in a bottle': 'Un mensaje en una botella', 'One a turn, for the other captain\'s eyes. It costs nothing.': 'Una por turno, para los ojos del otro capitán. No cuesta nada.',
  'Keep it': 'Guardarla', 'Seal & cast': 'Sellar y lanzar', 'A bottle washes up on your waters': 'Una botella llega a tus aguas', 'Fold it away': 'Guardarla',
  'Fair winds, and a fair fight…': 'Buenos vientos, y que gane el mejor…', 'Deploy your fleet': 'Despliega tu flota', 'Battle over': 'Fin de la batalla',
  'Your turn': 'Tu turno', 'Enemy turn': 'Turno enemigo', 'The enemy moves': 'Mueve el enemigo', rounds: 'rondas', spent: 'agotado', next: 'próxima', round: 'ronda',
  'Click a ship to lift it, move it over your waters and click again to set it down.': 'Haz clic en un barco para levantarlo, muévelo por tus aguas y vuelve a hacer clic para dejarlo.',
  'to rotate it.': 'para girarlo.', 'Sealed until the battle begins.': 'Lacradas hasta que empiece la batalla.', 'The other captain': 'El otro capitán', 'The machine': 'La máquina',
  'Arrange your fleet, then turn the capstan.': 'Coloca tu flota y luego gira el cabrestante.', 'Fleet committed. Waiting for the other captain…': 'Flota comprometida. Esperando al otro capitán…',
  'Send the other captain a short note.': 'Envía una nota breve al otro capitán.', 'You did not cast a bottle on your turn: you may still send one now.': 'No lanzaste botella en tu turno: aún puedes enviar una ahora.',
  'One bottle a turn: yours is cast. You may cast another once your next turn begins.': 'Una botella por turno: ya lanzaste la tuya. Podrás lanzar otra cuando empiece tu próximo turno.',
  'fires three squares in a row.': 'dispara a tres casillas en línea.', 'a hit pins the enemy ship for a turn.': 'un impacto inmoviliza al barco enemigo un turno.',
  'the first hit glances off her iron plate; under steam, the wind never stops her.': 'el primer impacto rebota en su blindaje; a vapor, el viento nunca la detiene.',
  'sails two squares instead of one.': 'navega dos casillas en vez de una.', "the Cutter's Glass counts hulls in a 5×5 patch of enemy water.": 'el catalejo del cúter cuenta cascos en una zona de 5×5 de agua enemiga.',
  'she carries the cargo the Corsair plunders.': 'lleva la carga que saquea la Corsaria.', Armour: 'Blindaje', Swift: 'Veloz', Undamaged: 'Sin daños',
  'Brave words for a captain with so much water left to lose.': 'Palabras valientes para un capitán con tanta agua por perder.', 'The sea keeps its own counsel, and so do I.': 'El mar guarda sus secretos, y yo también.',
  'Fair winds to you, while they last.': 'Buenos vientos para ti, mientras duren.', 'Your bottle sank before I could read it. A pity.': 'Tu botella se hundió antes de que pudiera leerla. Una lástima.',
  'Strike your colours and I may be merciful.': 'Arría tu bandera y quizá tenga piedad.', 'I have read your note. I am unmoved.': 'He leído tu nota. No me conmueve.',
  'Seals summon the Kraken': 'Los sellos invocan al Kraken', 'The maelstrom': 'El Maelstrom', 'The sea closes in': 'El mar se cierra',
  'The Kraken will answer.': 'El Kraken responderá.', 'A seal is afloat in your waters now.': 'Hay un sello flotando en tus aguas.',
  'Three seals summon the Kraken. A red wax seal surfaces in your waters every few rounds: sail a ship onto it to take it. Each ship you lose also pays one.': 'Tres sellos invocan al Kraken. Cada pocas rondas aflora un sello de lacre rojo en tus aguas: lleva un barco hasta él para cogerlo. Cada barco que pierdes también te da uno.',
  'Choose Summon the Kraken above the helm (3 AP), then a 3×3 patch of enemy water. It strikes now and again on their next turn, and holds the ships it finds.': 'Elige Invocar al Kraken (3 PA) y luego una zona de 3×3 de agua enemiga. Ataca ahora y otra vez en su próximo turno, y retiene los barcos que encuentra.',
  'Your commander': 'Tu comandante', 'Their commander': 'Su comandante', Sunk: 'Hundido', Afloat: 'A flote', 'Pinned by chain shot': 'Inmovilizado por palanqueta',
  'Your commander forswears it.': 'Tu comandante renuncia a ello.', 'The quartermaster opens once the battle begins.': 'El intendente abre cuando empiece la batalla.',
  'Wait for your turn.': 'Espera a tu turno.', 'Not now.': 'Ahora no.', 'Trade Winds already blew this turn.': 'Los alisios ya soplaron este turno.',
  'The Kraken is already abroad.': 'El Kraken ya anda suelto.', 'The maelstrom is spent.': 'El Maelstrom se ha agotado.', 'You have bound the tide twice already.': 'Ya has atado la marea dos veces.',
  'The tide can be bound from round 14.': 'La marea se puede atar desde la ronda 14.', 'All three squalls are spent.': 'Has gastado las tres turbonadas.', 'All three charges are spent.': 'Has gastado las tres cargas.',
  'Your last ship cannot be given up.': 'No puedes entregar tu último barco.', 'She cannot turn now.': 'Ahora no puede virar.', 'She cannot make way now.': 'Ahora no puede avanzar.',
  'Turn her': 'Virarla', 'Sail her': 'Navegarla', Cargo: 'Carga', 'Home port': 'Puerto', 'Season closes': 'Fin de temporada', 'The Kraken': 'El Kraken', Victory: 'Victoria', Defeat: 'Derrota',
  'The last crate is yours and the merchantman is going down.': 'La última caja es tuya y el mercante se hunde.', 'The merchantman is plundered and sunk.': 'El mercante ha sido saqueado y hundido.',
  'The season closed with the cargo still at sea.': 'La temporada terminó con la carga aún en el mar.', 'The season closed before the cargo reached home.': 'La temporada terminó antes de que la carga llegara a puerto.',
  'The maelstrom is spent: five rings have gone under and the middle 6×6 of each chart remains.': 'El Maelstrom se ha agotado: se han hundido cinco anillos y queda el 6×6 central de cada carta.',
  'No commander: plain Classic, as it has always been played.': 'Sin comandante: la Clásica de siempre.', 'Choose your commander': 'Elige a tu comandante',
  'Optional. Each brings a power and a drawback; the other captain sees your choice when the battle begins.': 'Opcional. Cada uno trae un poder y una desventaja; el otro capitán verá tu elección cuando empiece la batalla.',
  None: 'Ninguno', 'Take command': 'Tomar el mando',
  // Cards and items
  Fire: 'Fuego', Sail: 'Navegar', Turn: 'Virar', Broadside: 'Andanada', 'Chain shot': 'Palanqueta', 'Cutter’s glass': 'Catalejo del cúter', "Cutter's glass": 'Catalejo del cúter',
  'Summon the Kraken': 'Invocar al Kraken', 'Blood Pact': 'Pacto de sangre', 'Hold the Tide': 'Contener la marea', 'Hasten the Tide': 'Apremiar la marea', Squall: 'Turbonada',
  'Call the Wind': 'Llamar al viento', Soundings: 'Sondeo', 'Double-Shotted': 'Doble carga', Spyglass: 'Catalejo', 'Sea Current': 'Corriente marina', 'Long Glass': 'Anteojo',
  'Fire Ship': 'Brulote', 'Fog Bank': 'Banco de niebla', Shipwright: 'Carpintero', 'Trade Winds': 'Vientos alisios', 'Close Escort': 'Escolta cerrada', 'Dead Reckoning': 'Navegación a estima',
  'One shot at a square of enemy water.': 'Un disparo a una casilla de agua enemiga.',
  'Pick one of your ships, then a square ahead of her bow. With the wind she makes a square more; square-rigged ships cannot sail into it.': 'Elige uno de tus barcos y luego una casilla delante de su proa. Con el viento a favor avanza una casilla más; los de velas cuadradas no pueden navegar contra él.',
  'Pick one of your ships and swing her bow a quarter to port or starboard about her middle. Ships with two hits cannot turn.': 'Elige uno de tus barcos y gira su proa un cuarto a babor o estribor sobre su centro. Los barcos con dos impactos no pueden virar.',
  'Fire three squares in a row at once. Press R to swing the line between across and down.': 'Dispara a tres casillas en línea a la vez. Pulsa R para girar la línea entre horizontal y vertical.',
  'A single shot of chained balls: a ship it hits is pinned and cannot sail or turn on her next turn.': 'Un disparo de balas encadenadas: el barco que alcance queda inmovilizado y no puede navegar ni virar en su próximo turno.',
  "Train the cutter's glass on a 5×5 patch of enemy water: you learn how many ship sections lie inside it.": 'Apunta el catalejo del cúter a una zona de 5×5 de agua enemiga: sabrás cuántas secciones de barco hay dentro.',
  'Once a battle: give one of your damaged ships to the deep. She sinks at once and the deep pays two covenant seals (her toll and the pact). Not the merchantman, nor your last ship.': 'Una vez por batalla: entrega al abismo uno de tus barcos dañados. Se hunde al instante y el abismo paga dos sellos del pacto (su tributo y el pacto). Ni el mercante ni tu último barco.',
  'Break three covenant seals and wake the Kraken under a 3×3 patch of enemy water. It strikes now and again on their next turn, and the ships it finds cannot move meanwhile.': 'Rompe tres sellos del pacto y despierta al Kraken bajo una zona de 3×3 de agua enemiga. Ataca ahora y otra vez en su próximo turno, y los barcos que encuentre no pueden moverse mientras tanto.',
  'Click the side of your chart the wind should blow towards this round.': 'Haz clic en el lado de tu carta hacia el que debe soplar el viento esta ronda.',
  'Click a square of enemy water: you learn whether any ship lies on its row (press R for its column).': 'Haz clic en una casilla de agua enemiga: sabrás si hay algún barco en su fila (pulsa R para su columna).',
  'Count hulls in a 5×5 patch of enemy water': 'Cuenta cascos en una zona de 5×5 de agua enemiga', 'Carry your whole fleet one square in a direction': 'Lleva toda tu flota una casilla en una dirección',
  'See a 2×2 patch of enemy water clearly for the rest of your turn': 'Ve una zona de 2×2 de agua enemiga con claridad el resto de tu turno', 'Strike five squares in a cross': 'Golpea cinco casillas en cruz',
  'Blind enemy spyglasses over a 5×5 patch of yours': 'Ciega los catalejos enemigos sobre una zona de 5×5 tuya', 'Repair one damaged section': 'Repara una sección dañada', 'One extra action point this turn': 'Un punto de acción extra este turno',
  "Ride a sea current: pick a direction and your whole fleet drifts one square that way, at no cost to any ship's sailing. Ships held by the Kraken or pinned by chain shot, or blocked by the edge or another ship, stay where they are.": 'Aprovecha una corriente marina: elige una dirección y toda tu flota deriva una casilla hacia allí, sin gastar la navegación de ningún barco. Los barcos retenidos por el Kraken, inmovilizados por palanqueta o bloqueados por el borde u otro barco se quedan donde están.',
  'A brass telescope of great power: pick a 2×2 patch of enemy water and see it as it truly is, every hull in it drawn plain, until your turn ends. A fog bank there hides it.': 'Un telescopio de latón de gran alcance: elige una zona de 2×2 de agua enemiga y mírala tal como es, con cada casco a la vista, hasta que acabe tu turno. Un banco de niebla allí la oculta.',
  'Pick the centre of a 5×5 patch of enemy water: you learn how many ship sections lie inside it. A fog bank there answers only "?".': 'Elige el centro de una zona de 5×5 de agua enemiga: sabrás cuántas secciones de barco hay dentro. Si hay un banco de niebla solo responde «?».',
  'Send a burning hulk into enemy water: it strikes five squares at once, the one you pick and the four around it in a cross.': 'Lanza un casco en llamas contra el agua enemiga: golpea cinco casillas a la vez, la que eliges y las cuatro de alrededor en cruz.',
  "Hide a 5×5 patch of your own water for two rounds: enemy spyglasses and the cutter's glass read only \"?\" there.": 'Oculta una zona de 5×5 de tu agua durante dos rondas: los catalejos enemigos y el del cúter solo leen «?» allí.',
  "Pick a damaged section of one of your ships to patch it up. The merchantman's plundered cargo cannot be repaired.": 'Elige una sección dañada de uno de tus barcos para repararla. La carga saqueada del mercante no se puede reparar.',
  'Use it at once: one extra action point this turn, at no cost in action points. Once per turn.': 'Úsalo al momento: un punto de acción extra este turno, sin coste. Una vez por turno.',
  'Once: until your next turn, the first hit on the merchantman is turned aside.': 'Una vez: hasta tu próximo turno, el primer impacto en el mercante se desvía.', 'Once: learn the column the merchantman is in.': 'Una vez: sabrás en qué columna está el mercante.',
  // Ships, traits
  'Ship of the Line': 'Navío de línea', Frigate: 'Fragata', Ironclad: 'Acorazado', Schooner: 'Goleta', Cutter: 'Cúter', Merchantman: 'Mercante',
  // Orders
  'Sink an enemy ship.': 'Hunde un barco enemigo.', 'Land three hits in a row.': 'Consigue tres impactos seguidos.', 'Collect a treasure with your Cutter.': 'Recoge un tesoro con tu Cúter.',
  'Take no damage for two enemy turns running.': 'No recibas daño durante dos turnos enemigos seguidos.',
  // Commanders
  'The Tidewarden': 'El Guardamareas', 'The Stormcaller': 'La Llamatormentas', 'The Spymaster': 'El Maestro Espía', 'The Gunmaster': 'El Maestro Artillero', 'The Deepspeaker': 'La Voz del Abismo',
  Tidewarden: 'Guardamareas', Stormcaller: 'Llamatormentas', Spymaster: 'Maestro Espía', Gunmaster: 'Artillero', Deepspeaker: 'Voz del Abismo',
  'The sea keeps my time, not yours.': 'El mar lleva mi tiempo, no el tuyo.', 'Every sail on this sea answers to me.': 'Cada vela de este mar me obedece.',
  'Count the masts before you count the guns.': 'Cuenta los mástiles antes de contar los cañones.', 'One broadside is worth ten prayers.': 'Una andanada vale más que diez plegarias.',
  'The deep remembers every name we give it.': 'El abismo recuerda cada nombre que le damos.',
  "Bind the Tide (2 AP, twice, from round 14): the maelstrom's next ring comes two rounds later, or one sooner.": 'Atar la marea (2 PA, dos veces, desde la ronda 14): el próximo anillo del Maelstrom llega dos rondas más tarde, o una antes.',
  'May not buy a Sea Current.': 'No puede comprar Corriente marina.',
  "Squall (1 AP, three times): the enemy fleet is driven a square; ships that cannot run are dashed and take a hit, and your own waters are veiled from their next glass. Call the Wind (1 AP, every other round): choose this round's wind.": 'Turbonada (1 PA, tres veces): la flota enemiga es empujada una casilla; los barcos que no pueden moverse chocan y reciben un impacto, y tus aguas quedan veladas a su próximo catalejo. Llamar al viento (1 PA, una ronda sí y otra no): elige el viento de la ronda.',
  'Your ships are never caught in irons.': 'Tus barcos nunca quedan bloqueados por el viento en contra.', 'May not buy Trade Winds.': 'No puede comprar Vientos alisios.',
  'Soundings (free, every five rounds): learn whether any enemy ship lies on a row or column.': 'Sondeo (gratis, cada cinco rondas): sabrás si hay algún barco enemigo en una fila o columna.',
  'Starts with no doubloons, and pays 10 more for every spyglass and Long Glass.': 'Empieza sin doblones y paga 10 más por cada catalejo y anteojo.',
  'Double-Shotted (2 AP, three times): a shot that hits flies on and strikes the next square too.': 'Doble carga (2 PA, tres veces): un disparo que impacta sigue volando y golpea también la casilla siguiente.',
  'Each hit pays 10 doubloons instead of 5.': 'Cada impacto paga 10 doblones en vez de 5.', 'May never use the Long Glass.': 'Nunca puede usar el anteojo.',
  'The Kraken answers to two seals instead of three, and holds its patch a turn longer.': 'El Kraken acude con dos sellos en vez de tres y retiene su zona un turno más.',
  'The Kraken strikes once, not twice; no Blood Pact.': 'El Kraken ataca una vez, no dos; sin Pacto de sangre.',
  'The Admiral': 'El Almirante', 'The Corsair': 'La Corsaria',
  'Bring the merchantman from the Colony, on the western edge of your chart, to the Home Port on the eastern edge with at least one crate aboard — or sink every corsair.': 'Lleva el mercante desde la Colonia, en el borde oeste de tu carta, hasta el Puerto en el borde este con al menos una caja a bordo, o hunde a todos los corsarios.',
  'Plunder all three crates from the merchantman before she reaches the Home Port, or keep her at sea until the season closes.': 'Saquea las tres cajas del mercante antes de que llegue a Puerto, o mantenlo en el mar hasta que termine la temporada.',
  // Log
  'The Kraken strikes your waters.': 'El Kraken ataca tus aguas.', 'The Kraken strikes.': 'El Kraken ataca.', 'Chain shot fouls your rigging — that ship is pinned.': 'La palanqueta enreda tu aparejo: ese barco queda inmovilizado.',
  'Your chain shot pins the ship.': 'Tu palanqueta inmoviliza el barco.', 'You bring a ship about.': 'Viras un barco.', 'You shift a ship.': 'Mueves un barco.',
  'Treasure hauled aboard — but your ship was sighted.': 'Tesoro a bordo, pero han avistado tu barco.', 'Your bottle is cast. It drifts towards the other captain.': 'Has lanzado tu botella. Va a la deriva hacia el otro capitán.',
  'Fog rolls over your waters.': 'La niebla cubre tus aguas.', 'Your shipwrights patch a section.': 'Tus carpinteros reparan una sección.', 'Enemy shipwrights are at work.': 'Los carpinteros enemigos trabajan.',
  'The trade winds fill your sails: one more point.': 'Los alisios hinchan tus velas: un punto más.', 'Close Escort: your frigates close around the merchantman.': 'Escolta cerrada: tus fragatas rodean al mercante.',
  'The Admiral orders a close escort: the next hit on the merchantman will be turned aside.': 'El Almirante ordena escolta cerrada: el próximo impacto en el mercante se desviará.',
  'The Corsair works her dead reckoning…': 'La Corsaria calcula a estima…', "The enemy's log checks out: every shot was answered truthfully.": 'El cuaderno enemigo cuadra: cada disparo se respondió con verdad.',
  'High tide': 'Marea alta', 'Three covenant seals! The Kraken will answer: choose Summon the Kraken above the helm.': '¡Tres sellos del pacto! El Kraken responderá: elige Invocar al Kraken.',
  'The maelstrom swallows another ring of the chart!': '¡El Maelstrom se traga otro anillo de la carta!', 'The enemy is at the helm. Watch your waters…': 'El enemigo está al timón. Vigila tus aguas…',
  'That water has gone into the maelstrom: aim inside the chart that remains.': 'Esa agua se la ha tragado el Maelstrom: apunta dentro de la carta que queda.',
  'Pick one of your damaged ships (not the merchantman, nor your last).': 'Elige uno de tus barcos dañados (ni el mercante ni el último).', 'Nothing to repair there.': 'No hay nada que reparar ahí.',
  'A covenant seal. Sail a ship onto it to take it — the enemy will see where you were.': 'Un sello del pacto. Lleva un barco hasta él para cogerlo; el enemigo verá dónde estabas.',
  'An enemy seal. You cannot take it, but one of their ships may come for it.': 'Un sello enemigo. No puedes cogerlo, pero alguno de sus barcos puede venir a por él.',
  'Enemy treasure. You cannot take it, but one of their ships may come for it.': 'Tesoro enemigo. No puedes cogerlo, pero alguno de sus barcos puede venir a por él.',
  'Debug tools work only against the machine.': 'Las herramientas de depuración solo funcionan contra la máquina.', 'One bottle a turn: yours is already cast.': 'Una botella por turno: ya lanzaste la tuya.',
  'The merchantman must start in the Colony: columns A to C.': 'El mercante debe empezar en la Colonia: columnas A a C.', 'lost at sea (disconnected)': 'perdido en el mar (desconectado)',
  'Fire — pick a square in enemy waters. One point a shot.': 'Fuego: elige una casilla en aguas enemigas. Un punto por disparo.',
  'Sail — pick one of your ships, then a square ahead of her bow. Ships cannot back up.': 'Navegar: elige uno de tus barcos y luego una casilla delante de su proa. Los barcos no pueden ir marcha atrás.',
  'Turn — pick one of your ships, then click on the side her bow should swing to: an arrow marks each choice (or press Q for port, E for starboard).': 'Virar: elige uno de tus barcos y haz clic en el lado hacia el que debe girar la proa; una flecha marca cada opción (o pulsa Q para babor, E para estribor).',
  'Broadside — three squares in a line. Press R to swing the line.': 'Andanada: tres casillas en línea. Pulsa R para girar la línea.', 'Chain shot — a hit pins that ship for its next turn.': 'Palanqueta: un impacto inmoviliza ese barco en su próximo turno.',
  'Cutter’s glass — count hull sections in a 5×5 patch of enemy water.': 'Catalejo del cúter: cuenta secciones de casco en una zona de 5×5 de agua enemiga.', 'Spyglass — count hull sections in a 5×5 patch of enemy water.': 'Catalejo: cuenta secciones de casco en una zona de 5×5 de agua enemiga.',
  'Long Glass — pick a 2×2 patch of enemy water to see it plainly until your turn ends.': 'Anteojo: elige una zona de 2×2 de agua enemiga para verla claramente hasta que acabe tu turno.', 'Fire ship — five squares in a cross.': 'Brulote: cinco casillas en cruz.',
  'Fog bank — pick the centre of a 5×5 patch of your own water.': 'Banco de niebla: elige el centro de una zona de 5×5 de tu agua.',
  'Summon the Kraken — pick the centre of a 3×3 patch of enemy water. It strikes now and again next turn, and holds the ships it finds.': 'Invocar al Kraken: elige el centro de una zona de 3×3 de agua enemiga. Ataca ahora y otra vez el próximo turno, y retiene los barcos que encuentra.',
  'Shipwright — pick a damaged section of one of your ships.': 'Carpintero: elige una sección dañada de uno de tus barcos.', 'Blood Pact — pick one of your damaged ships to give to the deep for two seals.': 'Pacto de sangre: elige uno de tus barcos dañados para entregarlo al abismo a cambio de dos sellos.',
  'Sea Current — click towards the side of your chart the fleet should drift to.': 'Corriente marina: haz clic hacia el lado de tu carta al que debe derivar la flota.',
  'Squall — click the side of the enemy chart the wind should drive their fleet towards.': 'Turbonada: haz clic en el lado de la carta enemiga hacia el que el viento debe empujar su flota.',
  'Call the Wind — click the side of your chart the wind should blow towards this round.': 'Llamar al viento: haz clic en el lado de tu carta hacia el que debe soplar el viento esta ronda.',
  'Soundings — click a square of enemy water to sound its row. Press R to sound its column instead.': 'Sondeo: haz clic en una casilla de agua enemiga para sondear su fila. Pulsa R para sondear su columna.',
  'Double-Shotted — pick a square of enemy water. If it hits, the ball flies on one square further. Press R to turn which way.': 'Doble carga: elige una casilla de agua enemiga. Si impacta, la bala sigue una casilla más. Pulsa R para cambiar la dirección.',
  'into the wind': 'contra el viento', 'she cannot sail into the wind — turn her across it': 'no puede navegar contra el viento: vírala de través', 'she is holed and taking water': 'tiene una vía de agua',
  'the Kraken holds her': 'el Kraken la retiene', 'she is pinned by chain shot': 'está inmovilizada por palanqueta', 'she is too badly damaged': 'está demasiado dañada', 'there is no sea room': 'no hay espacio en el mar',
  'How to play ›': 'Cómo se juega ›', 'How to play': 'Cómo se juega',
  'Flat calm': 'Calma chicha', 'flat calm': 'calma chicha', east: 'este', south: 'sur', west: 'oeste', north: 'norte', 'The wind': 'El viento', Wind: 'Viento',
  'A flat calm this round: the wind helps and hinders no ship.': 'Calma chicha esta ronda: el viento no ayuda ni frena a ningún barco.',
  // Maelstrom gauge and misc
  Captain: 'Capitán', 'The enemy': 'El enemigo',
};

/** Patterns for sentences that carry numbers, squares or names. Each group may itself be translated (tr). */
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(.*) Needs your (.+) afloat\.$/, (m) => `${tr(m[1])} Necesita tu ${ship(m[2])} a flote.`],
  [/^(.*) Bought from the quartermaster; used up once played\.$/, (m) => `${tr(m[1])} Comprado al intendente; se gasta al jugarlo.`],
  [/^Your captain's power\. (.*)$/, (m) => `El poder de tu capitán. ${tr(m[1])}`],
  [/^Your (.+) has been sunk\.$/, (m) => `Tu ${ship(m[1])} ha sido hundido.`],
  [/^(\d+) of (\d+) seals$/, (m) => `${m[1]} de ${m[2]} sellos`],
  [/^(\d+) covenant seals? · (\d+) doubloons$/, (m) => `${m[1]} sello${m[1] === '1' ? '' : 's'} del pacto · ${m[2]} doblones`],
  [/^(\d+) AP$/, (m) => `${m[1]} PA`],
  [/^(.+), (\d+) AP$/, (m) => `${tr(m[1])}, ${m[2]} PA`],
  [/^(\d+) doubloons · (\d+) AP$/, (m) => `${m[1]} doblones · ${m[2]} PA`],
  [/^Reward (\d+) doubloons · (\d+) rounds? left$/, (m) => `Recompensa ${m[1]} doblones · quedan ${m[2]} rondas`],
  [/^Round (\d+) · Wind (.) (\w+)$/, (m) => `Ronda ${m[1]} · Viento ${m[2]} ${DIR[m[3]] ?? m[3]}`],
  [/^Round (\d+) · wind (\w+)$/, (m) => `Ronda ${m[1]} · viento ${DIR[m[2]] ?? m[2]}`],
  [/^Round (\d+) · (Flat calm|flat calm)$/, (m) => `Ronda ${m[1]} · calma chicha`],
  [/^Round (\d+)$/, (m) => `Ronda ${m[1]}`],
  [/^Storm over rows? (\d+)(?:–(\d+))? · no guns or glasses there$/, (m) => `Tormenta sobre ${m[2] ? `las filas ${m[1]}–${m[2]}` : `la fila ${m[1]}`} · ni cañones ni catalejos allí`],
  [/^You need (\d+) more doubloons\.$/, (m) => `Te faltan ${m[1]} doblones.`],
  [/^Your hold is full: (\d+) items at most\. Use one first\.$/, (m) => `Tu bodega está llena: ${m[1]} objetos como máximo. Usa uno antes.`],
  [/^Needs (\d+) action points?; you have (\d+)\.$/, (m) => `Necesita ${m[1]} punto${m[1] === '1' ? '' : 's'} de acción; tienes ${m[2]}.`],
  [/^Again in (\d+) rounds?\.$/, (m) => `De nuevo en ${m[1]} ronda${m[1] === '1' ? '' : 's'}.`],
  [/^(\d+) of (\d+) left\.$/, (m) => `Quedan ${m[1]} de ${m[2]}.`],
  [/^The maelstrom's next ring comes two rounds later\. (.*)$/, (m) => `El próximo anillo del Maelstrom llega dos rondas más tarde. ${tr(m[1])}`],
  [/^The maelstrom's next ring comes a round sooner\. (.*)$/, (m) => `El próximo anillo del Maelstrom llega una ronda antes. ${tr(m[1])}`],
  [/^Click the side of the enemy chart the wind should drive their fleet towards: every ship moves a square, and a ship that cannot is dashed and takes a hit\. Their next glass on your waters sees only spray\. (.*)$/, (m) => `Haz clic en el lado de la carta enemiga hacia el que el viento debe empujar su flota: cada barco se mueve una casilla y el que no puede choca y recibe un impacto. Su próximo catalejo sobre tus aguas solo verá espuma. ${tr(m[1])}`],
  [/^Fire at a square; if it hits, the ball flies on and strikes the next square too \(press R to turn which way\)\. (.*)$/, (m) => `Dispara a una casilla; si impacta, la bala sigue y golpea también la siguiente (pulsa R para cambiar la dirección). ${tr(m[1])}`],
  [/^(\d+) of (\d+) sections hit$/, (m) => `${m[1]} de ${m[2]} secciones tocadas`],
  [/^(\d+) hit · (\d+) holed$/, (m) => `${m[1]} tocada · ${m[2]} con vía de agua`],
  // Log lines
  [/^Your shot at (\w+) — only water\.$/, (m) => `Tu disparo en ${m[1]}: solo agua.`],
  [/^Your shot at (\w+) — wreckage, no new damage\.$/, (m) => `Tu disparo en ${m[1]}: restos, sin daño nuevo.`],
  [/^Your shot at (\w+) holes her below the waterline — she is taking water!$/, (m) => `Tu disparo en ${m[1]} le abre una vía de agua: ¡se está hundiendo!`],
  [/^Your shot at (\w+) is turned aside — iron plate, or an escort\.$/, (m) => `Tu disparo en ${m[1]} se desvía: blindaje o escolta.`],
  [/^Your shot at (\w+) rings off iron plate — an Ironclad!$/, (m) => `Tu disparo en ${m[1]} rebota en el blindaje: ¡un Acorazado!`],
  [/^Your shot at (\w+) strikes the merchantman — a crate is yours!$/, (m) => `Tu disparo en ${m[1]} alcanza al mercante: ¡una caja es tuya!`],
  [/^Your shot at (\w+) — a hit!$/, (m) => `Tu disparo en ${m[1]}: ¡impacto!`],
  [/^Your shot at (\w+) — the enemy (.+) goes down!$/, (m) => `Tu disparo en ${m[1]}: ¡hundes ${the(m[2])} enemig${/^(Fragata|Goleta)/.test(ship(m[2])) ? 'a' : 'o'}!`],
  [/^Enemy shot at (\w+) — only water\.$/, (m) => `Disparo enemigo en ${m[1]}: solo agua.`],
  [/^Enemy shot at (\w+) — wreckage\.$/, (m) => `Disparo enemigo en ${m[1]}: restos.`],
  [/^Enemy shot at (\w+) holes a ship below the waterline — she is taking water and slows\.$/, (m) => `Disparo enemigo en ${m[1]}: vía de agua en un barco, que va más lento.`],
  [/^Enemy shot at (\w+) glances off your Ironclad\.$/, (m) => `Disparo enemigo en ${m[1]}: rebota en tu Acorazado.`],
  [/^Enemy shot at (\w+) — the merchantman is hit and a crate is lost\.$/, (m) => `Disparo enemigo en ${m[1]}: alcanzan al mercante y se pierde una caja.`],
  [/^Enemy shot at (\w+) — a hit on your fleet\.$/, (m) => `Disparo enemigo en ${m[1]}: impacto en tu flota.`],
  [/^Enemy shot at (\w+) — your (.+) is lost\.$/, (m) => `Disparo enemigo en ${m[1]}: pierdes ${the(m[2])}.`],
  [/^The maelstrom takes your (.+)\.$/, (m) => `El Maelstrom se lleva ${the(m[1])}.`],
  [/^The maelstrom takes the enemy (.+)\.$/, (m) => `El Maelstrom se lleva ${the(m[1])} enemig${/^(Fragata|Goleta)/.test(ship(m[1])) ? 'a' : 'o'}.`],
  [/^The maelstrom tears at your fleet at (\w+)\.$/, (m) => `El Maelstrom destroza tu flota en ${m[1]}.`],
  [/^The maelstrom tears at an enemy ship at (\w+)\.$/, (m) => `El Maelstrom destroza un barco enemigo en ${m[1]}.`],
  [/^You break (two|three) seals\. The Kraken rises at (\w+)!$/, (m) => `Rompes ${m[1] === 'two' ? 'dos' : 'tres'} sellos. ¡El Kraken emerge en ${m[2]}!`],
  [/^(.+) breaks (two|three) seals — the Kraken rises under your ships at (\w+)!$/, (m) => `${m[1]} rompe ${m[2] === 'two' ? 'dos' : 'tres'} sellos: ¡el Kraken emerge bajo tus barcos en ${m[3]}!`],
  [/^(.+) has committed a fleet\.$/, (m) => `${m[1] === 'The machine' ? 'La máquina' : m[1]} ha comprometido su flota.`],
  [/^(.+) shifts a ship, unseen\.$/, (m) => `${tr(m[1])} mueve un barco sin ser visto.`],
  [/^Wreckage drifts at (\w+)\.$/, (m) => `Restos a la deriva en ${m[1]}.`],
  [/^Under full sail your merchantman is sighted in row (\d+)\.$/, (m) => `A toda vela, avistan tu mercante en la fila ${m[1]}.`],
  [/^A laden ship is sighted under full sail in row (\d+)\.$/, (m) => `Se avista un barco cargado a toda vela en la fila ${m[1]}.`],
  [/^(.+) lifts a treasure at (\w+) — a ship is there\.$/, (m) => `${tr(m[1])} recoge un tesoro en ${m[2]}: hay un barco allí.`],
  [/^(.+) gives the (.+) to the deep in a blood pact, and two seals rise\.$/, (m) => `${tr(m[1])} entrega ${the(m[2])} al abismo en un pacto de sangre, y surgen dos sellos.`],
  [/^A current carries your fleet (\w+)\.$/, (m) => `Una corriente lleva tu flota hacia el ${DIR[m[1]]}.`],
  [/^(.+) rides a sea current — their whole fleet drifts (\w+)\.$/, (m) => `${tr(m[1])} aprovecha una corriente: toda su flota deriva hacia el ${DIR[m[2]]}.`],
  [/^(.+) levels a long glass at (\w+): they see that water plainly this turn\.$/, (m) => `${tr(m[1])} apunta un anteojo a ${m[2]}: ve esa agua con claridad este turno.`],
  [/^The long glass meets only fog at (\w+)\.$/, (m) => `El anteojo solo encuentra niebla en ${m[1]}.`],
  [/^Through the long glass: (.+) at (\w+)!$/, (m) => `Por el anteojo: ¡${m[1].split(' and ').map(ship).join(' y ')} en ${m[2]}!`],
  [/^Through the long glass: open water at (\w+)\.$/, (m) => `Por el anteojo: agua abierta en ${m[1]}.`],
  [/^(.+) trains a spyglass on (\w+)\.$/, (m) => `${tr(m[1])} apunta un catalejo a ${m[2]}.`],
  [/^Spyglass on (\w+): nothing but fog\.$/, (m) => `Catalejo en ${m[1]}: solo niebla.`],
  [/^Spyglass on (\w+): (\d+) hull sections?\.$/, (m) => `Catalejo en ${m[1]}: ${m[2]} sección${m[2] === '1' ? '' : 'es'} de casco.`],
  [/^You buy (.+)\.$/, (m) => `Compras ${tr(m[1])}.`],
  [/^(.+) buys (.+)\.$/, (m) => `${tr(m[1])} compra ${tr(m[2])}.`],
  [/^Fog rolls over enemy waters near (\w+)\.$/, (m) => `La niebla cubre aguas enemigas cerca de ${m[1]}.`],
  [/^You bind the tide: the next ring comes (two rounds later|a round sooner)\.$/, (m) => `Atas la marea: el próximo anillo llega ${m[1] === 'a round sooner' ? 'una ronda antes' : 'dos rondas más tarde'}.`],
  [/^(.+) binds the tide: the maelstrom's next ring comes (two rounds later|a round sooner)\.$/, (m) => `${tr(m[1])} ata la marea: el próximo anillo del Maelstrom llega ${m[2] === 'a round sooner' ? 'una ronda antes' : 'dos rondas más tarde'}.`],
  [/^A squall drives the enemy fleet (\w+)\.$/, (m) => `Una turbonada empuja la flota enemiga hacia el ${DIR[m[1]]}.`],
  [/^(.+) calls down a squall — your fleet is driven (\w+)!$/, (m) => `${tr(m[1])} desata una turbonada: ¡tu flota es empujada hacia el ${DIR[m[2]]}!`],
  [/^You call the wind: it blows (\w+) this round\.$/, (m) => `Llamas al viento: sopla hacia el ${DIR[m[1]]} esta ronda.`],
  [/^(.+) calls the wind: it blows (\w+) this round\.$/, (m) => `${tr(m[1])} llama al viento: sopla hacia el ${DIR[m[2]]} esta ronda.`],
  [/^(.+) takes soundings along (row \d+|column \w)\.$/, (m) => `${tr(m[1])} sondea ${m[2].replace('row', 'la fila').replace('column', 'la columna')}.`],
  [/^Soundings along (row \d+|column \w): (there are ships on that line!|no ship lies on that line\.)$/, (m) => `Sondeo en ${m[1].replace('row', 'la fila').replace('column', 'la columna')}: ${m[2].startsWith('there') ? '¡hay barcos en esa línea!' : 'no hay ningún barco en esa línea.'}`],
  [/^(.+) catches the trade winds\.$/, (m) => `${tr(m[1])} aprovecha los alisios.`],
  [/^The Corsair has your merchantman's column: (\w)\.$/, (m) => `La Corsaria conoce la columna de tu mercante: ${m[1]}.`],
  [/^Dead Reckoning: the merchantman is in column (\w)\.$/, (m) => `Navegación a estima: el mercante está en la columna ${m[1]}.`],
  [/^(.+) fulfils secret orders: (\d+) doubloons\.$/, (m) => `${tr(m[1])} cumple órdenes secretas: ${m[2]} doblones.`],
  [/^The enemy's log does not add up: (.+)\.$/, (m) => `El cuaderno enemigo no cuadra: ${m[1]}.`],
  [/^High tide! Every five rounds the sea carries all the treasure and seals a square (\w+)\.$/, (m) => `¡Marea alta! Cada cinco rondas el mar arrastra todos los tesoros y sellos una casilla hacia el ${DIR[m[1]]}.`],
  [/^The flotsam drifts a square (\w+)$/, (m) => `Los restos derivan una casilla hacia el ${DIR[m[1]]}`],
  [/^A covenant seal is yours: (\d) of 3\. Three summon the Kraken\.$/, (m) => `Un sello del pacto es tuyo: ${m[1]} de 3. Tres invocan al Kraken.`],
  [/^The sea darkens at the edges: from round (\d+) the maelstrom swallows the outer ring every other round\. Bring your ships in!$/, (m) => `El mar se oscurece en los bordes: desde la ronda ${m[1]} el Maelstrom se traga el anillo exterior cada dos rondas. ¡Trae tus barcos hacia dentro!`],
  [/^The (.+) cannot turn to (port|starboard) — (.+)\.$/, (m) => `${the(m[1]).replace(/^./, (x) => x.toUpperCase())} no puede virar a ${m[2] === 'port' ? 'babor' : 'estribor'}: ${tr(m[3])}.`],
  [/^The (.+) cannot turn — (.+)\.$/, (m) => `${the(m[1]).replace(/^./, (x) => x.toUpperCase())} no puede virar: ${tr(m[2])}.`],
  [/^The (.+) cannot make way — (.+)\.$/, (m) => `${the(m[1]).replace(/^./, (x) => x.toUpperCase())} no puede avanzar: ${tr(m[2])}.`],
  [/^The (.+) is pinned by chain shot this turn\.$/, (m) => `${the(m[1]).replace(/^./, (x) => x.toUpperCase())} está inmovilizado por palanqueta este turno.`],
  [/^You give the (.+) to the deep\. Two seals rise in her place\.$/, (m) => `Entregas ${the(m[1])} al abismo. Surgen dos sellos en su lugar.`],
  [/^Treasure worth (\d+) doubloons\. Sail a ship onto it to collect — the enemy will see where you were\.$/, (m) => `Tesoro de ${m[1]} doblones. Lleva un barco hasta él para recogerlo; el enemigo verá dónde estabas.`],
  [/^No action points left — your turn ends in (\d+)…$/, (m) => `Sin puntos de acción: tu turno acaba en ${m[1]}…`],
  [/^Room (\w+)\. Arrange your fleet, then turn the capstan\.$/, (m) => `Sala ${m[1]}. Coloca tu flota y luego gira el cabrestante.`],
  [/^Returning to room (\w+)…$/, (m) => `Volviendo a la sala ${m[1]}…`],
  [/^You are invited to room (\w+)\. Sign your name and press Join\.$/, (m) => `Te han invitado a la sala ${m[1]}. Firma con tu nombre y pulsa Unirse.`],
  [/^Orders fulfilled: (.+) \+(\d+) doubloons\.$/, (m) => `Órdenes cumplidas: ${tr(m[1])} +${m[2]} doblones.`],
  [/^Orders lapsed: (.+)$/, (m) => `Órdenes caducadas: ${tr(m[1])}`],
  [/^The wind blows (\w+) this round\. A ship sailing with it makes a square more; square-rigged ships \(Ship of the Line, Frigate\) cannot sail into it, and fore-and-aft rigs lose a square against it\. Across the wind it changes nothing, and the Ironclad's steam ignores it\. It veers each round, and one round in five is a flat calm\.$/, (m) => `El viento sopla hacia el ${DIR[m[1]]} esta ronda. Un barco que navega a favor avanza una casilla más; los de velas cuadradas (Navío de línea, Fragata) no pueden navegar contra él, y los de vela cangreja pierden una casilla en contra. De través no cambia nada, y el vapor del Acorazado lo ignora. Cambia cada ronda, y una de cada cinco hay calma chicha.`],
  [/^Version (.+)$/, (m) => `Versión ${m[1]}`],
  [/^Debug: (.+)\.$/, (m) => `Depuración: ${m[1].replace('doubloons', 'doblones').replace('seals', 'sellos').replace('action points', 'puntos de acción')}.`],
  [/^The enemy fleet lies on the seabed after (\d+) rounds\.$/, (m) => `La flota enemiga yace en el fondo del mar tras ${m[1]} rondas.`],
  [/^Your last ship went down in round (\d+)\.$/, (m) => `Tu último barco se hundió en la ronda ${m[1]}.`],
  [/^The merchantman made the Home Port with (\d) of 3 crates aboard\.$/, (m) => `El mercante llegó a Puerto con ${m[1]} de 3 cajas a bordo.`],
  [/^The merchantman slipped past you with (\d) of 3 crates\.$/, (m) => `El mercante se te escapó con ${m[1]} de 3 cajas.`],
  [/^(\d+) columns? east$/, (m) => `${m[1]} columna${m[1] === '1' ? '' : 's'} al este`],
  [/^in (\d+) rounds?$/, (m) => `en ${m[1]} ronda${m[1] === '1' ? '' : 's'}`],
  [/^after round (\d+)$/, (m) => `tras la ronda ${m[1]}`],
  [/^holds (your|enemy) ships$/, (m) => (m[1] === 'your' ? 'retiene tus barcos' : 'retiene barcos enemigos')],
  [/^From round 20 the maelstrom swallows the outer ring of both charts every other round, sinking whatever lies there, until the middle 6×6 remains\. (\d) of 5 rings drowned\. (.*)$/, (m) => `Desde la ronda 20 el Maelstrom se traga el anillo exterior de ambas cartas cada dos rondas, hundiendo lo que haya allí, hasta que quede el 6×6 central. ${m[1]} de 5 anillos hundidos. ${tr(m[2])}`],
  [/^The next ring goes under at the start of the next round — the marked squares\.$/, () => 'El próximo anillo se hunde al empezar la próxima ronda: las casillas marcadas.'],
  [/^The next ring goes under in (\d+) rounds\.$/, (m) => `El próximo anillo se hunde dentro de ${m[1]} rondas.`],
  [/^The lot has fallen: you sail as (.+)\.?$/, (m) => `La suerte está echada: navegas como ${tr(m[1])}`],
  // "Broadside: fires three squares in a row." — a name and its explanation.
  [/^(.+): (.+)$/, (m) => (EXACT[m[1]] || SHIPS[m[1]] ? `${tr(m[1])}: ${tr(m[2])}` : '')],
];

const cache = new Map<string, string>();
/** The Spanish for an English text (the text itself when nothing matches). */
export function tr(s: string): string {
  if (!s) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  let out = EXACT[s];
  if (out === undefined) for (const [re, f] of PATTERNS) { const m = s.match(re); if (m) { const r = f(m); if (r) { out = r; break; } } }
  out ??= s;
  if (cache.size > 4000) cache.clear();
  cache.set(s, out);
  return out;
}

const KEY = 'tsc:lang';
let lang: Lang = (() => {
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'es') return v; } catch { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
})();
export const getLang = () => lang;

// The English each node or attribute held, and the Spanish we last wrote there (to tell our writes from the game's).
const original = new WeakMap<Node, string>(), written = new WeakMap<Node, string>();
const attrOriginal = new WeakMap<Element, Record<string, string>>();
const ATTRS = ['title', 'placeholder', 'aria-label'];
// <html translate="no"> keeps the browser's own translator away; inside the page, translate="no" marks players' words.
const skip = (n: Node) => {
  const el = n.nodeType === 1 ? (n as Element) : n.parentElement;
  if (!el || el.closest('script, style, .tuner, textarea')) return true;
  const no = el.closest('[translate="no"]');
  return !!no && no !== document.documentElement;
};

function doText(n: Text) {
  if (skip(n)) return;
  const v = n.nodeValue ?? '';
  if (written.get(n) !== v) original.set(n, v); // the game wrote something new
  const src = original.get(n) ?? v, lead = src.match(/^\s*/)![0], tail = src.match(/\s*$/)![0], core = src.trim();
  const want = lang === 'es' && core ? lead + tr(core) + tail : src;
  if (want !== v) n.nodeValue = want;
  written.set(n, want);
}
function doAttrs(el: Element) {
  if (skip(el)) return;
  const o = attrOriginal.get(el) ?? {};
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    if (o[a] === undefined || (v !== o[a] && v !== tr(o[a]))) o[a] = v;
    const want = lang === 'es' ? tr(o[a]) : o[a];
    if (want !== v) el.setAttribute(a, want);
  }
  attrOriginal.set(el, o);
}
function walk(root: Node) {
  if (root.nodeType === 3) { doText(root as Text); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) doAttrs(root as Element);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? doText(n as Text) : doAttrs(n as Element);
}

let observer: MutationObserver | null = null;
/** Start watching the page (once), translating as the game writes. */
export function startI18n() {
  document.documentElement.lang = lang;
  if (observer) return;
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') doAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  walk(document.body);
}
/** Switch language: everything on the page is rewritten at once. */
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  walk(document.body);
}
