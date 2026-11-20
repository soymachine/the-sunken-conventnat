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
