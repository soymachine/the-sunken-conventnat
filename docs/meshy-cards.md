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
