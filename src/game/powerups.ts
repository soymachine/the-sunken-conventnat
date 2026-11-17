export type Item = 'spyglass' | 'fireship' | 'fog' | 'shipwright' | 'winds';

export const ITEMS: Record<Item, { name: string; price: number; ap: number; blurb: string }> = {
  spyglass: { name: 'Spyglass', price: 30, ap: 1, blurb: 'Count hulls in a 5×5 patch of enemy water' },
  fireship: { name: 'Fire Ship', price: 50, ap: 2, blurb: 'Strike five squares in a cross' },
  fog: { name: 'Fog Bank', price: 40, ap: 1, blurb: 'Blind enemy spyglasses over a 5×5 patch of yours' },
  shipwright: { name: 'Shipwright', price: 60, ap: 2, blurb: 'Repair one damaged section' },
  winds: { name: 'Trade Winds', price: 40, ap: 0, blurb: 'One extra action point this turn' },
};
export const ITEM_IDS = Object.keys(ITEMS) as Item[];
export const MAX_ITEMS = 3;
export const START_DOUBLOONS = 30;
