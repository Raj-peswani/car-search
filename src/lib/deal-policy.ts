import type { Listing, SearchConfig } from './types';

export const VEHICLES = ['Toyota Corolla', 'Toyota Camry', 'Toyota Yaris', 'Honda Civic', 'Honda Accord', 'Honda Fit', 'Hyundai Elantra', 'Hyundai Sonata'];
export interface Evidence {
  titleStatus?: string; description?: string; ownerCount?: number; dealerRating?: number;
  radiusFilterMiles?: number; distanceBasis?: string; carfaxUrl?: string;
  distanceMiles?: number; searchZip?: string; listedAt?: string; mandatoryFeesCents?: number;
  salvage?: boolean; rebuilt?: boolean; lemon?: boolean; flood?: boolean; frameDamage?: boolean; structuralDamage?: boolean;
}
export function evidenceOf(row: { evidence?: string | null }): Evidence {
  try { return JSON.parse(row.evidence || '{}'); } catch { return {}; }
}
export function riskFlags(row: { evidence?: string | null }): string[] {
  const e = evidenceOf(row);
  const flags = ['salvage', 'rebuilt', 'lemon', 'flood', 'frameDamage', 'structuralDamage'].filter(k => e[k as keyof Evidence] === true);
  // Ignore explicit negations; ambiguous damage language still requires review.
  const text = `${e.titleStatus || ''} ${e.description || ''}`.toLowerCase()
    .replace(/\b(?:no|not|never|without)\s+(?:a\s+)?(?:salvage|rebuilt|lemon|flood(?: damage)?|frame damage|structural damage)\b/g, '')
    .replace(/\b(?:salvage|rebuilt|lemon|flood|frame damage|structural damage)\s*:\s*(?:no|false)\b/g, '');
  for (const word of ['salvage', 'rebuilt', 'lemon', 'flood', 'frame damage', 'structural damage']) if (new RegExp(`\\b${word}\\b`).test(text)) flags.push(word);
  return [...new Set(flags)];
}
export function feeFlags(row: { evidence?: string | null }): string[] {
  const e = evidenceOf(row), t = e.description || '';
  const flags: string[] = [];
  if ((e.mandatoryFeesCents || 0) > 0) flags.push(`Disclosed mandatory add-ons: $${((e.mandatoryFeesCents || 0) / 100).toLocaleString()}`);
  if (/reconditioning|protection package|mandatory.*(?:package|fee)|dealer add[- ]?ons|nitrogen|paint protection|anti[- ]?theft|gps fee/i.test(t)) flags.push('Possible mandatory dealer add-ons');
  if (/down payment|after.*down|with.*(?:financing|trade)|requires? financing|finance.*(?:only|price)|cash price.*higher|conditional price/i.test(t)) flags.push('Advertised price may be conditional');
  return flags;
}
export function assessListing(row: Listing, config: SearchConfig) {
  const e = evidenceOf(row), excluded: string[] = [], unknown: string[] = [];
  const allowed: string[] = JSON.parse(config.makesModels || JSON.stringify(VEHICLES));
  const name = `${row.make || ''} ${row.model || ''}`.toLowerCase();
  if (!row.make || !row.model) unknown.push('Make/model missing');
  else if (!allowed.some(v => name === v.toLowerCase() || name.startsWith(v.toLowerCase() + ' '))) excluded.push('Vehicle outside selected models');
  if (row.price == null || row.price <= 0) unknown.push('Advertised price missing');
  else if (row.price > (config.priceMax ?? 1200000)) excluded.push('Above price limit');
  if (row.mileage == null || row.mileage < 0) unknown.push('Mileage missing');
  else if (row.mileage > Math.min(config.mileageMax ?? 120000, 120000)) excluded.push('Above hard mileage limit');
  if (!row.year) unknown.push('Year missing');
  else if (row.year < Math.max(config.yearMin ?? 2014, 2014) || row.year > (config.yearMax ?? new Date().getFullYear())) excluded.push('Year outside range');
  excluded.push(...riskFlags(row).map(f => `Reported ${f}`));
  if (e.searchZip !== config.zip) unknown.push('Distance from selected ZIP unverified');
  else if (e.distanceMiles != null) { if (e.distanceMiles > (config.radiusMiles ?? 100)) excluded.push('Outside search radius'); }
  else if (e.radiusFilterMiles == null || e.radiusFilterMiles > (config.radiusMiles ?? 100)) unknown.push('Distance from selected ZIP unverified');
  if (!e.titleStatus) unknown.push('Title unverified');
  const flags = feeFlags(row);
  return { eligible: !excluded.length, verified: !excluded.length && !unknown.length, excluded, unknown, flags, preferredMileage: row.mileage != null && row.mileage < 100000 };
}

export function comparableRows(row: Listing, rows: Listing[], now = new Date()) {
  return rows.filter(r => r.id !== row.id && r.make?.toLowerCase() === row.make?.toLowerCase()
    && r.model?.toLowerCase().split(' ')[0] === row.model?.toLowerCase().split(' ')[0]
    && r.year != null && row.year != null && Math.abs(r.year - row.year) <= 2
    && r.mileage != null && row.mileage != null && Math.abs(r.mileage - row.mileage) <= 30000
    && (r.price || 0) > 0 && !riskFlags(r).length && !feeFlags(r).length
    && evidenceOf(r).searchZip === evidenceOf(row).searchZip && evidenceOf(r).searchZip != null
    && (evidenceOf(r).distanceMiles ?? evidenceOf(r).radiusFilterMiles ?? Infinity) <= 150
    && !r.isDismissed && now.getTime() - Date.parse(r.lastSeenAt) < 30 * 86400000
    && r.source.startsWith('demo') === row.source.startsWith('demo'));
}
export function explainScore(row: Listing, config: SearchConfig, rows: Listing[] = [], now = new Date()) {
  const e = evidenceOf(row), peers = comparableRows(row, rows, now);
  const prices = peers.map(p => p.price!).sort((a,b) => a-b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length >= 3 ? (prices.length % 2 ? prices[mid] : (prices[mid-1]+prices[mid])/2) : null;
  const age = row.year ? Math.max(0, now.getFullYear() - row.year) : null;
  const days = e.listedAt ? Math.max(0, (now.getTime() - Date.parse(e.listedAt))/86400000) : null;
  const parts = {
    market: median && row.price ? Math.max(0, Math.min(4, 2 + 8 * (median-row.price)/median)) : 2,
    mileage: row.mileage != null ? Math.max(0, Math.min(2, 2 * (120000-row.mileage)/120000)) : 1,
    history: (e.titleStatus?.toLowerCase() === 'clean' ? 0.6 : 0) + (row.oneOwner || e.ownerCount === 1 ? 0.5 : e.ownerCount === 2 ? 0.25 : 0) + (row.personalUse ? 0.4 : 0) + (row.noAccidents ? 0.5 : 0),
    dealer: e.dealerRating != null ? Math.max(0, Math.min(1, (e.dealerRating-3)/2)) : 0.5,
    age: age != null ? Math.max(0, Math.min(0.5, 0.5 * (20-age)/20)) : 0.25,
    daysOnMarket: days != null && Number.isFinite(days) ? Math.min(0.5, days/120) : 0.25,
  };
  const assessment = assessListing(row, config);
  const penalty = assessment.flags.length ? 1 : 0;
  const score = assessment.eligible ? Math.round(Math.max(0, Object.values(parts).reduce((a,b) => a+b, 0)-penalty)*10)/10 : 0;
  return { score, parts, penalty, marketMedianCents: median, comparableCount: peers.length,
    marketBasis: median ? 'Local asking-price median; same make/model, ±2 years, ±30k miles, seen in 30 days' : 'Insufficient comparables; neutral market component',
    daysOnMarket: days, daysObserved: Math.max(0, Math.floor((now.getTime()-Date.parse(row.firstSeenAt))/86400000)), assessment };
}
