'use client';
import { useState } from 'react';
import Link from 'next/link';
export default function ImportPage() {
  const [text,setText] = useState(''), [message,setMessage] = useState('');
  return <div className="space-y-5 max-w-3xl">
    <Link href="/sources" className="underline text-primary">Connect a live auto.dev feed</Link>
    <h1 className="text-2xl font-bold">Import listings & source status</h1>
    <p>Paste a JSON array from a permitted export or your own research. Price is in dollars; mileage and distance are in miles. Include searchZip with distanceMiles to identify its center. Omitted history stays unknown.</p>
    <pre className="text-xs bg-muted rounded p-4 overflow-auto">{JSON.stringify([{source:'manual',id:'your-id',year:2016,make:'Toyota',model:'Corolla',price:10500,mileage:85000,location:'Irvine, CA',titleStatus:'clean',distanceMiles:20,searchZip:'92648',dealerRating:4.2,ownerCount:1,personalUse:true}],null,2)}</pre>
    <label className="block">Listings JSON<textarea aria-label="Listings JSON" value={text} onChange={e=>setText(e.target.value)} className="block border rounded w-full h-60 p-3 font-mono text-sm" /></label>
    <button className="bg-primary text-primary-foreground rounded px-4 py-2" onClick={async()=>{try {const r=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:text});const d=await r.json();setMessage(r.ok ? `Imported ${d.new} new; updated ${d.updated}. ${d.errors.join('; ')}` : d.error);}catch{setMessage('Import failed');}}}>Import listings</button>
    <p role="status">{message}</p><Link href="/listings" className="underline">View deals</Link>
    <div className="border rounded p-4 space-y-2 text-sm">
      <p><strong>JSON import:</strong> supported and tested; favorites, notes, deduplication and price history work locally.</p>
      <p><strong>Cars.com / AutoTrader / KBB:</strong> each returned zero listings in the October 8, 2026 ordinary-browser check. Parsers are preserved in vendor/car-deals-mcp with stealth and browser security overrides removed. Disabled by default; no verified live feed.</p>
      <p><strong>Facebook:</strong> automated access unsupported and disabled. Use permitted exports. CarGurus, Craigslist, eBay and auto.dev have no adapters in this repo.</p>
    </div>
  </div>;
}
