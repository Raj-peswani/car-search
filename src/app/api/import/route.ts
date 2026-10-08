import { NextRequest, NextResponse } from 'next/server';
import { importSchema } from '@/lib/import-schema';
import { normalizeMcpListing } from '@/lib/scrapers/normalize';
import { upsertListings } from '@/lib/scrapers/dedup';
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({error:'Origin rejected'}, {status:403});
  const text = await req.text();
  if (text.length > 2_000_000) return NextResponse.json({error:'Maximum import size is 2 MB'}, {status:413});
  try {
    const parsed = importSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({error:parsed.error.issues[0].message}, {status:400});
    return NextResponse.json(await upsertListings(parsed.data.map(normalizeMcpListing), 'import'));
  } catch { return NextResponse.json({error:'Invalid JSON or import failed'}, {status:400}); }
}
