export type Item = 'spyglass' | 'longglass' | 'current' | 'fireship' | 'fog' | 'shipwright' | 'winds';

export const ITEMS: Record<Item, { name: string; price: number; ap: number; blurb: string }> = {
  spyglass: { name: 'Spyglass', price: 30, ap: 1, blurb: 'Count hulls in a 5×5 patch of enemy water' },
  current: { name: 'Sea Current', price: 50, ap: 1, blurb: 'Carry your whole fleet one square in a direction' },
  longglass: { name: 'Long Glass', price: 45, ap: 2, blurb: 'See a 2×2 patch of enemy water clearly for the rest of your turn' },
  fireship: { name: 'Fire Ship', price: 50, ap: 2, blurb: 'Strike five squares in a cross' },
  fog: { name: 'Fog Bank', price: 40, ap: 1, blurb: 'Blind enemy spyglasses over a 5×5 patch of yours' },
  shipwright: { name: 'Shipwright', price: 60, ap: 2, blurb: 'Repair one damaged section' },
  winds: { name: 'Trade Winds', price: 40, ap: 0, blurb: 'One extra action point this turn' },
};
/** What each item does, told in full for the quartermaster's tooltip. */
export const ITEM_HELP: Record<Item, string> = {
  current: 'Ride a sea current: pick a direction and your whole fleet drifts one square that way, at no cost to any ship\'s sailing. Ships held by the Kraken or pinned by chain shot, or blocked by the edge or another ship, stay where they are.',
  longglass: 'A brass telescope of great power: pick a 2×2 patch of enemy water and see it as it truly is, every hull in it drawn plain, until your turn ends. A fog bank there hides it.',
  spyglass: 'Pick the centre of a 5×5 patch of enemy water: you learn how many ship sections lie inside it. A fog bank there answers only "?".',
  fireship: 'Send a burning hulk into enemy water: it strikes five squares at once, the one you pick and the four around it in a cross.',
  fog: 'Hide a 5×5 patch of your own water for two rounds: enemy spyglasses and the cutter\'s glass read only "?" there.',
  shipwright: 'Pick a damaged section of one of your ships to patch it up. The merchantman\'s plundered cargo cannot be repaired.',
  winds: 'Use it at once: one extra action point this turn, at no cost in action points. Once per turn.',
};
export const ITEM_IDS = Object.keys(ITEMS) as Item[];
export const MAX_ITEMS = 3;
export const START_DOUBLOONS = 30;
