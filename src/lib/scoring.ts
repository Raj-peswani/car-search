import type { Listing, SearchConfig } from './types';
import type { DB } from './db';
import { listings } from './db/schema';
import { eq } from 'drizzle-orm';
import { explainScore } from './deal-policy';
export function computeDealScore(row: Listing, config: SearchConfig, database?: DB): number {
  return explainScore(row, config, database?.select().from(listings).all() || []).score;
}
export function recomputeAllScores(database: DB, config: SearchConfig): number {
  const rows = database.select().from(listings).all();
  database.transaction(tx => { for (const row of rows) tx.update(listings).set({dealScore: explainScore(row, config, rows).score}).where(eq(listings.id, row.id)).run(); });
  return rows.length;
}
