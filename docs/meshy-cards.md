# The captain's desk: assets to make in Meshy

Mock-up: `docs/ui/desk_compact.png`. The hand of order cards sits half below the bottom edge of the screen
(about 120 px tall); a card rises whole on hover and stays raised while chosen. Order tools on the left,
the hourglass (end turn) and wax seals (action points) on the right, the bottle by the chart.

The game composes each card: **frame** + **illustration** + name + AP cost, all drawn in code, so the
lettering is always crisp. Ask Meshy for pictures only, never for text.

## Settings for every image

- Square, as large as Meshy allows (1024 px or more).
- Isolated on a solid pure black background, no floor, no drop shadow (frame, tools, hourglass, seal).
- Soft warm light from the upper left, the same on every image.
- No text, no letters, no numbers, no logos.
- Make 3–4 variants of each and keep the best; colour differences are evened out afterwards.

## 1. The card frame (one image, used by every card)

```
A single blank playing card from the 1860s, seen perfectly straight from the front, portrait, about 5 units
wide by 7 tall: thick aged ivory card stock with softly worn corners, a fine double border engraved in dark
brown ink with small anchor ornaments in each corner, and a rectangular picture window in the upper 60%
framed by a thin gilt line. The picture window and the space below it are completely empty and plain.
Isolated on a solid pure black background, no shadow. Soft warm light from the upper left. Photorealistic
paper texture. No text, no letters, no numbers, no logos.
```

Optional, for the enemy's hand or a face-down card: the **card back**.

```
The back of a single 1860s playing card, portrait, seen straight from the front: deep oxblood red card with a
gold-ink engraved pattern of a compass rose at the centre ringed by waves and a kraken's tentacles, a thin
gilt border, worn corners. Isolated on a solid pure black background, no shadow. No text, no letters.
```

## 2. One illustration per card

Base prompt — replace `[SCENE]` with the line for each card:

```
A small square illustration for a card in a naval strategy game, in the style of a hand-coloured 1860s
steel engraving: [SCENE]. Fine cross-hatched ink lines, muted sepia, amber and slate-blue tones, dramatic
light, a strong clear silhouette that still reads at a small size. Fills the whole square, no border,
no frame. No text, no letters, no numbers, no logos.
```

| Card | `[SCENE]` |
|---|---|
| Broadside | a ship of the line firing a full broadside, three gun ports flashing, smoke rolling over the water |
| Chain Shot | two cannonballs joined by a chain spinning through the air and tearing into a ship's rigging |
| Cutter's Glass | a small cutter's captain looking through a brass telescope over the bow at the horizon |
| Spyglass | a brass spyglass lying on a sea chart, its lens catching the light, a circle of sight on the chart |
| Long Glass | a long brass telescope on a tripod pointed out to sea, a bright glint in its great lens |
| Fire Ship | a burning hulk drifting towards an enemy line at night, flames and sparks rising |
| Fog Bank | a thick bank of fog rolling over the sea, the masts of a ship half hidden inside it |
| Shipwright | a ship's carpenter hammering oakum into a hull seam with a mallet and caulking iron |
| Trade Winds | a ship running before the wind, sails full and straining, spray at her bow |
| Sea Current | a ship carried along a strong curling sea current, swirling lines in the water around her hull |
| Blood Pact | a captain's hand pressing a bleeding thumb onto a red wax seal above dark water, a ship sinking behind |
| The Kraken | a giant kraken rising from the sea, tentacles wrapped around a three-masted ship |
| Close Escort (Admiral) | a frigate sailing close alongside a merchant brig, shielding her from an enemy's guns |
| Dead Reckoning (Corsair) | a corsair captain plotting with dividers on a chart by lamplight, a pistol beside the chart |

## 3. Pieces on the desk

**Order tools** (three images, round, seen from above):

```
A single [OBJECT] seen from directly above, lying on nothing, isolated on a solid pure black background,
no shadow. Photorealistic, aged and well used, 1860s naval equipment. Soft warm light from the upper left.
No text.
```
- Fire: `cast-iron cannonball with a short length of slow match coiled beside it`
- Sail: `pair of brass navigation dividers, slightly open`
- Turn: `small carved wooden ship's tiller with a brass collar`

**Hourglass** (end turn):

```
A single ship's sand glass seen straight from the side, standing upright: two clear glass bulbs with fine
pale sand, mostly in the lower bulb, held between round turned oak end plates joined by three slender brass
pillars. Isolated on a solid pure black background, no shadow. Photorealistic. Soft warm light from the
upper left. No text.
```

**Action point seal** (one image, the game repeats it):

```
A single round blob of deep red sealing wax seen from directly above, pressed with a simple anchor emblem,
glossy with a slightly irregular melted edge. Isolated on a solid pure black background, no shadow.
Photorealistic. No text, no letters.
```

The bottle (`public/ui/bottle.webp`) is already done.

## 4. Fire order: a cannon instead of the cannonball

```
A single small naval cannon on its wooden carriage, seen from a three-quarter view from above and the side,
muzzle pointing to the right: a dark cast-iron barrel with reinforcing rings and a swelled muzzle, a sturdy
oak carriage with four small wooden trucks (wheels), iron fittings and a coil of rope at the back.
Aged and well used, 1860s ship's gun. Isolated on a solid pure black background, no floor, no shadow.
Photorealistic. Soft warm light from the upper left. No text, no letters, no numbers.
```

## 5. Tooltip background (stretched in nine slices)

A strip of old chart paper pinned with brass, so the corners keep their shape and the middle stretches to any
size. The middle must be plain and even, the edges similar all the way round.

```
A single small rectangular piece of aged nautical chart paper, landscape, about twice as wide as it is
tall, lying perfectly flat, seen straight from above: warm ivory paper slightly darkened and foxed towards
the edges, with a thin engraved double border line in faded brown ink running all the way round, and a
small polished brass corner cap clamped on each of the four corners. The centre is completely plain, even
and empty, with no marks, no stains, no map, no lines. Straight-on orthographic top view, no perspective,
no curl, no shadow, filling about 90% of the frame. Isolated on a solid pure black background. Soft even
light. Photorealistic. No text, no letters, no numbers, no logos.
```

## 6. Order cards: Fire, Sail and Turn

Same base prompt as the other card pictures (section 2). The arrows are symbols, not lettering, so the
"no text" line still applies:

| Card | `[SCENE]` |
|---|---|
| Fire | a single heavy naval cannon on its oak carriage filling the picture, seen close up from the side and a little from the front at the instant it fires: a great tongue of flame and a rolling cloud of smoke bursting from the muzzle, the barrel jolting back in recoil, sparks flying from the touch-hole; only the gun port's dark timbers behind it, no crew |
| Sail | a ship running before the wind under full sail, her bow cutting a white wave, a gull alongside; across the foreground a bold engraved straight arrow pointing forward, drawn like a chart's ink symbol, clearly showing movement ahead |
| Turn | a helmsman heaving on the great double ship's wheel, the ship heeling as she comes about; around the wheel a bold engraved curved arrow sweeping a quarter circle, drawn like a chart's ink symbol, clearly showing rotation |

## 7. The desk along the bottom of the screen

Different from the top bar's oak planks: a captain's chart table of darker wood with brass.

```
A seamless, tileable texture of an old captain's chart table seen straight from above: dark polished
mahogany boards running horizontally, worn smooth and slightly glossy, with fine grain, small dents and
scratches, faint rings left by mugs and a few drops of old candle wax, and a narrow inlaid brass strip running
the full width near the top edge. Even, soft light with no shadows or vignette, so the edges tile without a
seam. Straight-on orthographic top view, no perspective. Photorealistic. No objects, no text, no letters.
Wide format, about four times wider than tall.
```

## 8. Bottle and hourglass resting on the desk (with perspective)

Both stand on the desk at the bottom corners, seen a little from above as if from the captain's chair, so they
need their contact shadow baked in and a gentle three-quarter view.

**Message in a bottle**
```
A single antique message-in-a-bottle standing upright on a dark polished mahogany table, seen from slightly
above at a gentle three-quarter angle as if from a chair at the table, so the bottle's base ellipse and the
table's surface recede towards the back: dark green hand-blown glass with small bubbles, a cork stopper sealed
with dripping red wax, a rolled ivory parchment tied with red thread visible inside. A soft contact shadow
under the bottle on the wood. Only a small patch of tabletop around its base, fading to pure black at the
edges of the frame. Warm candle light from the upper left. Photorealistic. No text, no letters, no labels.
```

**Ship's hourglass**
```
A single ship's sand glass standing upright on a dark polished mahogany table, seen from slightly above at a
gentle three-quarter angle as if from a chair at the table, so its round end plates show as ellipses and the
table recedes towards the back: two clear glass bulbs with fine pale sand, most of it in the lower bulb and a
thin stream falling, held between turned oak end plates joined by three slender brass pillars. A soft contact
shadow under it on the wood. Only a small patch of tabletop around its base, fading to pure black at the edges
of the frame. Warm candle light from the upper left. Photorealistic. No text, no letters.
```

## 9. Bottle and hourglass matching the desk's vanishing point (transparent background)

The desk recedes towards a vanishing point in the middle of the screen, a little above the desk. The bottle
stands in the bottom-left corner, so it is seen from slightly above and from its right (the camera is towards
the centre of the screen); the hourglass stands in the bottom-right corner, seen from slightly above and from
its left. No table in the picture: only the object and a faint shadow, on transparency.

**Bottle (bottom-left corner)**
```
A single antique message-in-a-bottle standing upright, seen from slightly above (about 20 degrees down) and
turned a little so we look at it from its right-hand side, as if the viewer sits up and to the right of it:
the base and the cork show as gentle ellipses, the vertical lines of the bottle lean very slightly towards the
upper right, towards a vanishing point beyond the top-right of the frame. Dark green hand-blown glass with small
bubbles, cork sealed with dripping red wax, a rolled ivory parchment tied with red thread inside. Only the
bottle and a very soft contact shadow directly beneath it; no table, no floor, no backdrop. Transparent
background, PNG with alpha. Warm light from the upper left. Photorealistic. No text, no letters, no labels.
```

**Hourglass (bottom-right corner)**
```
A single ship's sand glass standing upright, seen from slightly above (about 20 degrees down) and turned a
little so we look at it from its left-hand side, as if the viewer sits up and to the left of it: the round end
plates show as gentle ellipses, the brass pillars lean very slightly towards the upper left, towards a
vanishing point beyond the top-left of the frame. Two clear glass bulbs with fine pale sand mostly in the lower
bulb, turned oak end plates, three slender brass pillars. Only the hourglass and a very soft contact shadow
directly beneath it; no table, no floor, no backdrop. Transparent background, PNG with alpha. Warm light from
the upper left. Photorealistic. No text, no letters.
```

If Meshy cannot give transparency, ask for "isolated on a solid pure black background" instead and I cut it out.

## 10. The maelstrom gauge (a brass instrument in layers)

The gauge hangs under the top bar, top right, about 96 px across. To keep the whirlpool turning and the rings
lighting up, it is built from **separate layers** stacked on top of each other: each piece is its own picture,
seen exactly face-on (no perspective), centred, square, on transparency. Same light for all of them: warm, from
the upper left. Ask for 1024 × 1024 so they stay sharp when scaled down.

**a. Bezel (the brass ring, hollow in the middle)**
```
A heavy antique ship's instrument bezel seen exactly face-on: a thick polished brass ring with a knurled outer
edge, six small round rivets evenly spaced, a thin engraved inner border, worn darker in the recesses with a
little verdigris. The middle of the ring is completely empty (transparent): only the ring. Centred, square
frame, filling about 90 percent of it. Transparent background, PNG with alpha. Warm light from the upper left.
Photorealistic, 19th-century naval brasswork. No text, no numbers, no letters.
```

**b. Dial face (behind everything)**
```
A circular instrument dial face seen exactly face-on: deep sea-green enamel turning almost black at the edge,
finely crackled with age, a ring of small engraved tick marks near the rim (no numbers), and in the middle a
faint engraved spiral like a whirlpool, very low contrast so a number can be printed over it. Only the disc.
Centred, square frame, the disc filling about 80 percent of it. Transparent background, PNG with alpha. Soft
light. Photorealistic. No text, no numbers, no letters.
```

**c. Whirlpool (the layer that spins)**
```
A whirlpool seen from directly above, as a separate transparent layer: five curved streaks of pale sea foam
and silvery water spiralling into a dark centre, like water draining in a vortex, the streaks thin and
translucent at their outer ends. Nothing else: no sea around it, no frame. Centred, square, rotationally
balanced so it can spin. Transparent background, PNG with alpha. Painterly realism. No text.
```

**d. Ring lamps (five small jewels on the bezel: one picture lit, one unlit)**
```
A small round faceted garnet jewel set in a tiny brass cup, seen exactly face-on, glowing deep red from
within as if lit, with a bright highlight at the upper left. Only the jewel and its cup. Centred, square.
Transparent background, PNG with alpha. Photorealistic. No text.
```
```
The same small round faceted garnet jewel in its tiny brass cup, seen face-on, but dark and unlit: almost
black red, only a faint highlight. Only the jewel and its cup. Centred, square. Transparent background, PNG
with alpha. Photorealistic. No text.
```

**e. Optional: the hanger (to hang the gauge from the top beam)**
```
A short wrought-iron bracket seen face-on, hanging straight down: a flat plate with two rivets at the top and
a small ring at the bottom, holding a short chain of three iron links. Only the bracket and chain, vertical,
centred in a tall frame. Transparent background, PNG with alpha. Warm light from the upper left.
Photorealistic. No text.
```

The number of rounds and the word under it stay as text drawn by the game, over the dial.

## 11. The covenant's seals (three in the left panel)

Three seals sit in a row under "The covenant". Each has three states, so ask for three pictures of the same
seal, all seen exactly from above, centred, square, on transparency, about 512 × 512. They must not look like
the red wax seals used for action points: these are **black wax with a red kraken**, older and more sinister.

**a. Lit (a seal you hold)**
```
A single round wax seal seen exactly from above: glossy black wax with irregular poured edges, pressed with a
deep circular stamp of a kraken whose tentacles curl around the rim, the impression picked out in dark blood
red, a few tiny bubbles in the wax. Only the seal. Centred, square frame, filling about 85 percent of it.
Transparent background, PNG with alpha. Warm light from the upper left. Photorealistic. No text, no letters.
```

**b. Empty (a seal still to be won)**
```
A faint blind-embossed circle pressed into old parchment, seen exactly from above: the same kraken stamp
design but only as a shallow colourless impression in the paper, with a soft shadow on its lower right edge.
Only the round impression, its surroundings fading to transparent. Centred, square. Transparent background,
PNG with alpha. Photorealistic. No text.
```

**c. Broken (when the Kraken is summoned)**
```
The same round black wax seal with the red kraken stamp, seen from above, cracked clean in two with a jagged
break through the middle and a few small chips of black wax beside it. Only the broken seal and chips.
Centred, square. Transparent background, PNG with alpha. Warm light from the upper left. Photorealistic.
No text.
```

With these, the three seals glow when all three are lit, and clicking them takes up the Kraken's card (already
in the game); when the Kraken is summoned they can crack and fall away using the broken picture.

## 12. Commanders: portraits and power cards

Until these exist, the game shows a wax seal with a symbol for each commander, and the power cards borrow other
cards' pictures.

### Portraits

Five portraits, all in the same style: head and shoulders, three-quarter view, painted like an 18th-century naval
oil portrait, dark background, warm light from the upper left, square, 1024 × 1024. Shown in a round frame in the
panels and on the home. Keep the face centred and leave space round the head. No text.

- **The Tidewarden:**
  ```
  An old weathered sea priest-captain with a grey braided beard threaded with shells, a dark green coat crusted with salt, holding a brass astrolabe engraved with tide lines; calm, patient eyes; behind him, faint in the dark, a slow whirlpool.
  ```
- **The Stormcaller:**
  ```
  A fierce woman captain with wind-torn black hair and a storm-grey greatcoat, one hand raised as if summoning the wind, small sparks of lightning on her fingertips; dark storm clouds and slanting rain in the background.
  ```
- **The Spymaster:**
  ```
  A thin, sharp-featured gentleman in a black velvet coat and a high collar, a folded spyglass in one hand and a sealed letter in the other, a faint knowing smile, candlelight on one side of the face, a chart table with pins half seen behind.
  ```
- **The Gunmaster:**
  ```
  A broad, scarred master gunner with powder-blackened face and forearms, a red neckerchief, a ramrod over the shoulder and a slow match smouldering; a cannon muzzle and drifting gun smoke behind him.
  ```
- **The Deepspeaker:**
  ```
  A pale hooded figure in deep-sea robes of dark teal and black, wet as if just risen from the sea, a necklace of black wax seals stamped with a kraken, eyes faintly glowing sea-green; tentacles barely visible in the darkness behind.
  ```

### Power cards

Same frame and style as the other order cards in section 1: a vertical painted picture, nothing in the bottom quarter
(the name goes there), no text.

- **Hold the Tide / Hasten the Tide:**
  ```
  A great whirlpool at sea seen from a cliff, a robed figure with a raised brass astrolabe holding it back, the water frozen mid-spin with a glowing ring around it.
  ```
- **Squall:**
  ```
  A fleet of sailing ships driven sideways by a violent squall, sails torn, one ship crashing into another, white spray and slanting rain.
  ```
- **Call the Wind:**
  ```
  A woman on a quarterdeck with her arm raised, a great gust visible as swirling streaks of air bending all the sails one way, clouds parting.
  ```
- **Soundings:**
  ```
  A sailor in the bow of a longboat at night, dropping a lead line into dark water, a lantern lighting the knotted rope, faint ship silhouettes far off in the mist.
  ```
- **Double-Shotted:**
  ```
  A cannon firing with two iron balls chained in flight, one smashing through a ship's hull and the second flying on behind it, dramatic gun smoke and fire.
  ```

## 13. The home: a ribbon across the sheet, and an arm of the deep on each side

The home is a single sheet of parchment (the Articles of Engagement). The game's title sits on a **ribbon** across
its head, and two **kraken arms** reach out from behind the sheet's sides. The game draws the title text itself, so
the ribbon must be blank. One tentacle picture is enough: the game mirrors it for the other side.

Save them as `public/ui/home_ribbon.webp` and `public/ui/home_tentacle.webp` (or drop them in `images/` and I
convert them). Until they exist, the game shows a simple drawn ribbon and no tentacles.

**Ribbon (blank, seen face-on)**
```
A long horizontal parchment ribbon banner seen exactly face-on, gently arched upwards in the middle, its two ends
folded back behind it and cut into swallowtails, the folds in shadow. Aged cream parchment with soft creases,
slightly darker edges and a thin hand-inked border line along both long edges. The centre is completely blank and
flat enough to print a title on. Nothing else: no text, no letters, no seal, no background. Wide composition about
5:1, centred, filling the width. Transparent background, PNG with alpha. Warm light from the upper left.
Photorealistic, 18th-century nautical style.
```

**Tentacle (one, curling up and outwards; the game mirrors it for the other side)**
```
A single kraken tentacle rising from the bottom of the frame and curling upwards and outwards to the left, the
tip coiled into a tight spiral at the top; thick at the base, tapering to a fine tip. Wet, glistening dark
red-brown skin with a slightly lighter underside lined with two rows of pale suckers facing the viewer, small
barnacles near the base. The base is cut straight at the bottom edge of the frame, as if coming out from behind
something. Nothing else: no water, no background. Tall composition about 1:2. Transparent background, PNG with
alpha. Warm light from the upper left, deep shadow on the right side. Photorealistic.
```

Optional, if the top of the page looks empty without the old crest:

**Small crest seal (above the ribbon, about 90 px on screen)**
```
A small round wax seal seen from above: deep red wax pressed with an anchor wrapped by a kraken tentacle, a
coil of rope around the rim. Only the seal. Centred, square. Transparent background, PNG with alpha.
Photorealistic. No text.
```

## 14. Commanders: half-length figures behind the panels (replaces the portraits in section 12)

When a commander is chosen, a half-length figure of them stands behind the top of the side panel: yours on the left
(behind "The covenant"), the enemy's on the right (behind "Enemy fleet"). The panel hides them from the waist down,
so **half-length is enough**. The game mirrors the enemy's picture, so **every figure faces right** (towards the
middle of the table) and works for both sides.

The same for all five:
- Waist up, standing, the body turned three-quarters to the right, head and eyes looking right.
- Cut off cleanly at the waist at the bottom edge of the frame.
- Painted like an 18th-century naval oil portrait, with warm light from the upper left.
- Transparent background, PNG with alpha. No frame, no scenery, no text.
- Tall frame, about 3:4 (768 × 1024), with the head in the upper third and a little space above it.

Name the files after the commander (`tidewarden.png`, `stormcaller.png`, `spymaster.png`, `gunmaster.png`,
`deepspeaker.png`) and drop them in `images/`; I convert them to `public/ui/cmd/`. Until then nothing shows there.

**The Tidewarden**
```
Half-length portrait from the waist up of an old weathered sea priest-captain, body turned three-quarters to the
right and looking right: grey braided beard threaded with small shells, a long dark green coat crusted with salt,
a brass astrolabe engraved with tide lines held against his chest; calm, patient eyes. Cut off at the waist at the
bottom of the frame. 18th-century naval oil portrait style, warm light from the upper left. Transparent background,
PNG with alpha. No scenery, no frame, no text. Tall 3:4 frame.
```

**The Stormcaller**
```
Half-length portrait from the waist up of a fierce woman sea captain, body turned three-quarters to the right and
looking right: wind-torn black hair, a storm-grey greatcoat with brass buttons, one hand raised at shoulder height
as if summoning the wind, faint sparks of lightning on her fingertips. Cut off at the waist at the bottom of the
frame. 18th-century naval oil portrait style, warm light from the upper left. Transparent background, PNG with
alpha. No scenery, no frame, no text. Tall 3:4 frame.
```

**The Spymaster**
```
Half-length portrait from the waist up of a thin, sharp-featured gentleman, body turned three-quarters to the right
and looking right with a faint knowing smile: black velvet coat with a high collar and white cravat, a folded
brass spyglass in one hand and a sealed letter with red wax in the other. Cut off at the waist at the bottom of the
frame. 18th-century naval oil portrait style, warm light from the upper left. Transparent background, PNG with
alpha. No scenery, no frame, no text. Tall 3:4 frame.
```

**The Gunmaster**
```
Half-length portrait from the waist up of a broad, scarred master gunner, body turned three-quarters to the right
and looking right: powder-blackened face and forearms, rolled sleeves, a red neckerchief, a leather bandolier of
powder charges, a ramrod resting on his shoulder. Cut off at the waist at the bottom of the frame. 18th-century
naval oil portrait style, warm light from the upper left. Transparent background, PNG with alpha. No scenery, no
frame, no text. Tall 3:4 frame.
```

**The Deepspeaker**
```
Half-length portrait from the waist up of a pale hooded figure, body turned three-quarters to the right and
looking right: deep-sea robes of dark teal and black that look wet, a necklace of black wax seals stamped with a
kraken, eyes faintly glowing sea-green, one hand holding a coil of rope hung with shells. Cut off at the waist at
the bottom of the frame. 18th-century naval oil portrait style, warm light from the upper left. Transparent
background, PNG with alpha. No scenery, no frame, no text. Tall 3:4 frame.
```

## 15. The commanders' power cards (replaces the card list in section 12)

These six cards use the same **base prompt as section 2** (a small square illustration in the style of a
hand-coloured 1860s steel engraving). Fill `[SCENE]` with the line below. Make them square, as the other card
pictures, and name the files as in the first column. The game draws the frame, the name and the AP seal.

| File | Card | `[SCENE]` |
|---|---|---|
| `bind_later.png` | Hold the Tide | a robed old sea-priest on a rocky headland raising a brass astrolabe against a vast whirlpool, the water around it stilled and frozen mid-turn, a pale ring of light holding it back |
| `bind_sooner.png` | Hasten the Tide | the same robed sea-priest on the headland sweeping his arm forward, the whirlpool below spinning faster and wider, foam racing round its rim and a ship tipping at its edge |
| `squall.png` | Squall | a fleet of sailing ships thrown sideways by a sudden squall, sails torn and slanting rain, one ship driven hard against another with splintering timber and white spray |
| `gale.png` | Call the Wind | a woman captain on a quarterdeck with one arm raised to the sky, streaks of wind sweeping across the picture and bending every sail the same way, clouds parting behind her |
| `sound.png` | Soundings | a sailor in the bow of a longboat at night swinging a lead line into black water, a lantern lighting the knotted rope, the faint shapes of distant ships in the mist |
| `double.png` | Double-Shotted | a heavy cannon firing two iron balls that fly one behind the other, the first smashing through a ship's hull in a burst of splinters and the second flying on beyond it, thick gun smoke |

The Deepspeaker has no card of their own: their power changes the Kraken's card, which keeps its picture.

## 16. The account corner and the language switch

The home has two small corner bars:
- **Top left:** the captain's account, showing "Sign in", or the anchor, the captain's name, "Captain's Log" and
  "Sign out".
- **Top right:** the language switch, EN | ES.

Today these are plain dark boxes. They can become pieces of ship's furniture: a small oak board with brass
nameplates screwed onto it, a captain's insignia beside the name, and two cloth signal pennants for the languages.

The game keeps writing the words itself, so every picture must be **blank**. Make them all face-on, transparent
background, warm light from the upper left, no text and no letters. Drop them in `images/` with the names given, and
I will cut and place them.

**a. `nameplate.png` — the plate behind each button (stretched to fit the word)**
```
A single small engraved brass nameplate seen exactly face-on, a long rounded rectangle about 4:1, polished
but worn brass with darker tarnish in the corners, a fine engraved double border line inset from the edge,
a small domed brass screw at each end. The middle is completely blank and flat. Nothing else, no background.
Transparent background, PNG with alpha. Warm light from the upper left. Photorealistic. No text, no letters.
```

**b. `nameplate_hot.png` — the same plate under the pointer**
```
The same small engraved brass nameplate, face-on, freshly polished so it gleams brighter, with a soft warm
highlight across its upper half. Blank middle, a domed screw at each end. Transparent background, PNG with
alpha. Photorealistic. No text, no letters.
```

**c. `account_board.png` — the strip of wood they are fixed to (optional)**
```
A short horizontal strip of dark varnished oak seen face-on, about 6:1, with softly rounded ends, fine grain,
small dents and a thin brass edge band along the top and bottom. Nothing on it. Transparent background, PNG with
alpha. Warm light from the upper left. Photorealistic. No text.
```

**d. `insignia.png` — the captain's mark beside the name (replaces the ⚓ sign)**
```
A small round captain's insignia badge seen exactly face-on: a gilt brass fouled anchor (an anchor wrapped
with a length of rope) on a dark navy enamel disc, ringed by a thin rope-twist gilt border, with a tiny crown
of laurel leaves above the anchor. Polished, slightly worn. Only the badge. Centred, square. Transparent
background, PNG with alpha. Warm light from the upper left. Photorealistic. No text, no letters.
```

Alternative, if a badge feels too military:
```
A small round red wax seal seen from above, pressed with a fouled anchor (an anchor wrapped in rope), glossy
wax with irregular poured edges. Only the seal, centred, square. Transparent background, PNG with alpha.
Photorealistic. No text.
```

**e. `logbook.png` — a small icon for "Captain's Log" (inside its nameplate, left of the words)**
```
A small closed ship's logbook seen face-on, slightly turned: worn brown leather cover with a brass corner on
each corner, a red ribbon bookmark hanging out at the bottom, a brass clasp. Only the book. Centred, square.
Transparent background, PNG with alpha. Warm light from the upper left. Photorealistic. No text, no letters.
```

**f. `pennant.png` and `pennant_raised.png` — the language switch**

Two signal pennants side by side, one per language. The game writes "EN" and "ES" on them, and the one in use hangs
raised.
```
A single small swallow-tailed cloth signal pennant seen face-on, hanging from a short horizontal brass rod
with a ring at each end, made of faded cream sailcloth with a thin red border stitched along its edges, the
cloth gently rippled. The middle of the cloth is plain and blank. Nothing else. Transparent background, PNG with
alpha. Warm light from the upper left. Photorealistic. No text, no letters, no symbols.
```
```
The same small swallow-tailed signal pennant, face-on, but caught by a breeze so it streams out more fully,
the cloth brighter, a deeper red border. Plain blank middle. Transparent background, PNG with alpha.
Photorealistic. No text, no letters, no symbols.
```

### How they come together

- **Top left:**
  - signed out: the insignia, then a "Sign in" nameplate;
  - signed in: the insignia, the name in gilt italic, then "Captain's Log" (with the logbook) and "Sign out", all on
    the oak strip.
- **Top right:** two pennants hanging side by side.
- **Words:** engraved-looking dark text on the plates, drawn by the game. They stay sharp and switch between English
  and Spanish.

## 17. The pointer: normal and over something clickable

**How the pictures are used**
- **Size:** a pointer is drawn tiny, at 32 × 32 px (48 at most), so it must read as a **bold, simple silhouette**.
  Ask for 1024 × 1024 and I shrink it.
- **The tip:** it must sit **exactly in the top-left corner** of the picture, pointing up and to the left at about
  45°. That point is where the click lands.
- **Format:** transparent background, no shadow (I add a small one), no text.
- **Two pictures, the same object:** a resting pointer, and a "hot" one shown over buttons and cards. The hot one
  must keep exactly the same outline and position, so the pointer does not jump.

**Option A (recommended): a brass compass needle**

`cursor.png`
```
A single pointer for a computer game, shaped like a slender antique brass compass needle: a sharp diamond-shaped
point aiming at the top-left corner of the frame at 45 degrees, its tip touching the very corner, widening to a
small round brass pivot cap with a tiny engraved fleur-de-lis, then tapering to a short blunt tail toward the
lower right. Polished gilt brass with dark ink-black outline edges for contrast, one bright highlight along the
upper edge. Bold, simple silhouette that stays readable when shrunk to 32 pixels. Seen exactly from above, flat,
centred along the diagonal. Transparent background, PNG with alpha, no shadow. No text.
```

`cursor_hot.png`
```
The same slender antique brass compass needle pointer, identical outline and position (sharp point in the very
top-left corner at 45 degrees, round pivot cap, short tail to the lower right), but its point is now enamelled
deep wax red with a faint warm glow along the edge, and the brass is brighter, as if lit. Bold simple silhouette
readable at 32 pixels. Seen from above, flat. Transparent background, PNG with alpha, no shadow. No text.
```

**Option B: a quill, and a hand for what can be clicked**

`cursor.png`
```
A single pointer for a computer game shaped like a goose-feather quill pen seen from above, its sharpened metal
nib exactly in the top-left corner of the frame pointing up-left at 45 degrees, the feather sweeping down to the
lower right. Ivory feather with crisp dark ink outlines, a dark iron nib with a drop of black ink at its point.
Bold simple silhouette readable at 32 pixels. Flat, transparent background, PNG with alpha, no shadow. No text.
```

`cursor_hot.png`
```
A pointing hand for a computer game, in a worn brown leather sea captain's glove with a turned-back cuff and a
brass button, the index finger extended so its fingertip touches exactly the top-left corner of the frame,
pointing up-left at 45 degrees, other fingers curled. Crisp dark outline for contrast, bold simple silhouette
readable at 32 pixels. Seen flat. Transparent background, PNG with alpha, no shadow. No text.
```

**Optional: the pointers over the charts** (centred pictures, since their "point" is their centre)
- `cursor_sight.png`, to fire:
  ```
  A brass gunsight ring seen face-on with four short crosshair ticks and a small red centre dot, bold dark outline, simple and readable at 32 pixels, centred. Transparent background, PNG with alpha, no shadow. No text.
  ```
- `cursor_glass.png`, to look:
  ```
  A small brass magnifying spyglass lens with a short handle toward the lower right, the lens catching a highlight, bold dark outline, readable at 32 pixels; the centre of the lens at the centre of the frame. Transparent background, PNG with alpha, no shadow. No text.
  ```
- `cursor_helm.png`, over your ships:
  ```
  A small ship's wheel with eight spokes and turned handles, dark wood with a brass hub, seen face-on, bold dark outline, readable at 32 pixels, centred. Transparent background, PNG with alpha, no shadow. No text.
  ```

Until these arrive, the drawn pointers stay in use; the game switches to the pictures as soon as they exist.
