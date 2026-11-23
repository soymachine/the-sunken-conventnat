// What each commander is called and does, for the home, the HUD and the cards (rules in game/engine.ts).
import { Cmd } from '../game/engine';

export interface CmdInfo { name: string; motto: string; power: string; passive?: string; drawback: string; glyph: string }

export const CMD_INFO: Record<Cmd, CmdInfo> = {
  tidewarden: {
    name: 'The Tidewarden', motto: 'The sea keeps my time, not yours.', glyph: '≋',
    power: 'Bind the Tide (free, twice, from round 14): the maelstrom\'s next ring comes two rounds later, or one sooner.',
    drawback: 'May not buy a Sea Current.',
  },
  stormcaller: {
    name: 'The Stormcaller', motto: 'Every sail on this sea answers to me.', glyph: '꩜',
    power: 'Squall (1 AP, three times): the enemy fleet is driven a square; ships that cannot run are dashed and take a hit, and your own waters are veiled from their next glass. Call the Wind (1 AP, every other round): choose this round\'s wind.',
    passive: 'Your ships are never caught in irons.',
    drawback: 'May not buy Trade Winds.',
  },
  spymaster: {
    name: 'The Spymaster', motto: 'Count the masts before you count the guns.', glyph: '◉',
    power: 'Soundings (free, every six rounds from round 4): learn whether any enemy ship lies on a row or column.',
    drawback: 'Starts with no doubloons, and pays 10 more for every spyglass and Long Glass.',
  },
  gunmaster: {
    name: 'The Gunmaster', motto: 'One broadside is worth ten prayers.', glyph: '✹',
    power: 'Double-Shotted (2 AP, three times): a shot that hits flies on and strikes the next square too.',
    passive: 'Each hit pays 10 doubloons instead of 5.',
    drawback: 'May never use the Long Glass.',
  },
  deepspeaker: {
    name: 'The Deepspeaker', motto: 'The deep remembers every name we give it.', glyph: '⚓',
    power: 'The Kraken answers to two seals instead of three, and holds its patch a turn longer.',
    drawback: 'May never swear a Blood Pact.',
  },
};
