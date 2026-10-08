import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { listings, priceHistory, searchConfig } from '../db/schema';
import { recomputeAllScores } from '../scoring';
import type { NewListing, ScrapeResult } from '../types';
export async function upsertListings(rows: NewListing[], _source: string): Promise<ScrapeResult> {
  void _source;
  const result: ScrapeResult = {new: 0, updated: 0, errors: []};
  for (const row of rows) {
    try {
      if (!row.vin && !row.externalId && !row.url) throw new Error('Listing needs VIN, source ID or URL for deduplication');
      const condition = row.vin ? eq(listings.vin, row.vin) : row.externalId ? and(eq(listings.source,row.source),eq(listings.externalId,row.externalId)) : and(eq(listings.source,row.source),eq(listings.url,row.url!));
      const now = new Date().toISOString();
      db.transaction(tx => {
        const existing = tx.select().from(listings).where(condition).get();
        const values = Object.fromEntries(Object.entries(row).filter(([,v])=>v != null));
        if (existing) {
          const evidence = {...JSON.parse(existing.evidence || '{}'), ...JSON.parse(row.evidence || '{}')};
          tx.update(listings).set({...values, evidence: JSON.stringify(evidence),lastSeenAt:now}).where(eq(listings.id,existing.id)).run();
          if(row.price != null && row.price !== existing.price) tx.insert(priceHistory).values({listingId:existing.id,price:row.price,observedAt:now}).run();
          result.updated++;
        } else {
          const added=tx.insert(listings).values({...row,firstSeenAt:now,lastSeenAt:now}).returning().get();
          if(row.price != null) tx.insert(priceHistory).values({listingId:added.id,price:row.price,observedAt:now}).run();
          result.new++;
        }
      });
    } catch(e) { result.errors.push(e instanceof Error ? e.message : String(e)); }
  }
  const config=db.select().from(searchConfig).get();
  if(config) recomputeAllScores(db,config);
  return result;
}
