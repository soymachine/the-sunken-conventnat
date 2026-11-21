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
