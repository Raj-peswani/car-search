import { NextRequest, NextResponse } from 'next/server';
import { connectedAutoDevKey, saveAutoDevKey } from '@/lib/source-connection';
import { db } from '@/lib/db';
import { scrapeRuns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { isLocalConnectionRequest } from '@/lib/local-request';
export async function GET() {
  const lastRun=db.select().from(scrapeRuns).where(eq(scrapeRuns.source,'auto.dev')).orderBy(desc(scrapeRuns.startedAt)).get();
  return NextResponse.json({configured:Boolean(connectedAutoDevKey()),lastRun:lastRun || null});
}
export async function POST(req: NextRequest) {
  if (!isLocalConnectionRequest(req.headers.get('origin'), req.headers.get('host'))) return NextResponse.json({error:'Use the local app to connect.'},{status:403});
  try {
    const body=await req.json();
    if (typeof body.apiKey!=='string') return NextResponse.json({error:'Enter your auto.dev API key.'},{status:400});
    saveAutoDevKey(body.apiKey.trim());
    return NextResponse.json({configured:true});
  } catch { return NextResponse.json({error:'Could not save the key. Check its format.'},{status:400}); }
}
