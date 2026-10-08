import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings, scrapeRuns, searchConfig } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { explainScore } from '@/lib/deal-policy';
export async function GET() {
 const config=db.select().from(searchConfig).get()!;
 const all=db.select().from(listings).all();
 const rows=all.filter(r=>!r.isDismissed && explainScore(r,config,all).assessment.eligible);
 const sources=new Map<string,number>(); for(const r of rows) sources.set(r.source,(sources.get(r.source)||0)+1);
 const last=db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).get();
 return NextResponse.json({totalListings:rows.length,newCount:rows.filter(r=>r.viewStatus==='new').length,favoritesCount:rows.filter(r=>r.isFavorited).length,avgDealScore:rows.length ? Math.round(rows.reduce((n,r)=>n+explainScore(r,config,all).score,0)/rows.length*10)/10:0,lastScrapeAt:last?.startedAt||null,sourceBreakdown:[...sources].map(([source,count])=>({source,count}))});
}
