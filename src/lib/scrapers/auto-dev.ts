import { normalizeMcpListing } from './normalize';
import type { NewListing, SearchConfig } from '../types';

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function numeric(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined; }
function httpUrl(value: unknown): string | undefined { return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined; }

export function autoDevSearchUrl(config: SearchConfig, page = 1): URL {
  if (!config.zip || !/^\d{5}$/.test(config.zip)) throw new Error('Set a valid search ZIP first.');
  const vehicles: string[] = JSON.parse(config.makesModels || '[]');
  if (!vehicles.length) throw new Error('Select vehicles in Settings first.');
  const url = new URL('https://api.auto.dev/listings');
  url.search = new URLSearchParams({
    zip: config.zip, distance: String(config.radiusMiles ?? 100),
    'vehicle.make': [...new Set(vehicles.map(v => v.split(' ')[0]))].join(','),
    'vehicle.model': [...new Set(vehicles.map(v => v.split(' ').slice(1).join(' ')))].join(','),
    'vehicle.year': `${Math.max(2014, config.yearMin ?? 2014)}-${config.yearMax ?? new Date().getFullYear()}`,
    'retailListing.price': `1-${Math.min(12000, Math.floor((config.priceMax ?? 1200000)/100))}`,
    'retailListing.miles': `0-${Math.min(120000, config.mileageMax ?? 120000)}`,
    'retailListing.used': 'true', 'retailListing.state': 'CA',
    limit: '20', page: String(page), sort: 'updatedAt.desc',
  }).toString();
  return url;
}

export function normalizeAutoDevListing(value: unknown, config: SearchConfig): NewListing | null {
  const row=object(value), vehicle=object(row.vehicle), retail=object(row.retailListing);
  const vin = typeof vehicle.vin === 'string' ? vehicle.vin : typeof row.vin === 'string' ? row.vin : undefined;
  if (!vin) return null;
  // Do not infer title, owners or history from the existence of a CARFAX link.
  const result = normalizeMcpListing({
    source:'auto.dev', vin, id:vin, year:numeric(vehicle.year), make:vehicle.make, model:vehicle.model,
    trim:vehicle.trim, price:numeric(retail.price), mileage:numeric(retail.miles),
    url:httpUrl(retail.vdp), imageUrl:httpUrl(retail.primaryImage),
    location:[retail.city, retail.state, retail.zip].filter(v=>typeof v === 'string').join(', '),
    dealerName:typeof retail.dealer === 'string' ? retail.dealer : undefined, dealerType:'dealer',
  });
  result.evidence = JSON.stringify({
    searchZip:config.zip, radiusFilterMiles:config.radiusMiles ?? 100,
    distanceBasis:'auto.dev ZIP/radius query; exact distance not supplied',
    carfaxUrl:httpUrl(retail.carfaxUrl),
  });
  return result;
}

export async function searchAutoDev(config: SearchConfig, options: {apiKey?: string; fetcher?: typeof fetch} = {}): Promise<NewListing[]> {
  const key=options.apiKey || process.env.AUTO_DEV_API_KEY;
  if (!key) throw new Error('Connect auto.dev on the Live Sources page to search real inventory.');
  const fetcher=options.fetcher || fetch, rows: NewListing[] = [];
  // At most three calls per manual scan. No automatic retries or paid upgrades.
  for(let page=1;page<=3;page++) {
    const response=await fetcher(autoDevSearchUrl(config,page),{
      headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},
      signal:AbortSignal.timeout(30000), redirect:'error', cache:'no-store',
    });
    if (!response.ok) {
      const reason=response.status===401 || response.status===403 ? 'API key rejected or listings access unavailable' : response.status===429 ? 'API quota or rate limit reached' : `Service returned HTTP ${response.status}`;
      throw new Error(`auto.dev: ${reason}.`);
    }
    const payload=object(await response.json());
    if(!Array.isArray(payload.data)) throw new Error('auto.dev returned an unexpected response; no listings were imported.');
    rows.push(...payload.data.map(v=>normalizeAutoDevListing(v,config)).filter((r):r is NewListing=>r!==null));
    if(payload.data.length < 20 || !object(payload.links).next) break;
  }
  return rows;
}
