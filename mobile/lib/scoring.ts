export const SCORE_VERSION = 'truworth-v1.1';

export type Motive = 'need' | 'joy' | 'image';

export type ScoreInput = {
  item: string;
  brand?: string;
  retailer?: string;
  price: number;
  upkeep: number;
  uses: number;
  effort: number;
  joy: number;
  minutes: number;
  hourValue: number;
  motive: Motive;
  alternative?: string;
  source_url?: string;
  canonical_url?: string;
  image_url?: string;
  currency?: string;
};

export type ScoreResult = {
  score: number;
  total: number;
  perUse: number;
  valueIndex: number;
  timeValue: number;
  version: string;
};

export function score(input: ScoreInput): ScoreResult {
  const price = Number(input.price || 0);
  const upkeep = Number(input.upkeep || 0);
  const uses = Number(input.uses || 0);
  const effort = Number(input.effort || 0);
  const joy = Number(input.joy || 0);
  const minutes = Number(input.minutes || 0);
  const hourValue = Number(input.hourValue || 0);

  if (!String(input.item || '').trim() || ![price, upkeep, uses, effort, joy, minutes, hourValue].every(Number.isFinite) || price < 0 || upkeep < 0 || uses < 1 || !Number.isInteger(uses) || effort < 0 || joy < 1 || joy > 10 || minutes < 0 || hourValue < 0 || !['need', 'joy', 'image'].includes(input.motive)) {
    throw new Error('Check the purchase details and try again.');
  }

  const total = price + upkeep;
  const perUse = total / uses;
  const friction = Math.max(0.25, effort);
  const valueIndex = uses * joy / friction;
  const timeValue = uses * minutes / 60 * hourValue;
  let value = Math.round(
    Math.min(26, Math.log2(uses + 1) * 3.9) +
    joy / 10 * 24 +
    25 / (1 + perUse / 18) +
    15 / (1 + effort / Math.max(1, uses) * 3) +
    Math.min(10, (minutes / 60 * hourValue) / 12 * 10) -
    (input.motive === 'image' ? 12 : 0)
  );
  value = Math.max(0, Math.min(100, value));
  return { score: value, total, perUse, valueIndex, timeValue, version: SCORE_VERSION };
}

export function labelForScore(value: number): string {
  if (value >= 80) return 'Excellent fit';
  if (value >= 68) return 'Strong fit';
  if (value >= 55) return 'Promising';
  if (value >= 42) return 'Think it through';
  return 'Low fit';
}

export function verdictForScore(value: number): { title: string; body: string } {
  if (value >= 80) return { title: 'Worth it', body: 'This looks like a strong purchase for the way you expect to use it.' };
  if (value >= 68) return { title: 'Looks worth it', body: 'It scores well overall, with a few assumptions worth checking.' };
  if (value >= 55) return { title: 'Promising', body: 'There is value here, but compare one alternative before rushing.' };
  if (value >= 42) return { title: 'Think twice', body: 'The purchase is more tempting than convincing right now.' };
  return { title: 'Skip for now', body: 'This purchase does not score well based on the details you entered.' };
}
