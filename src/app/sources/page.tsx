'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTriggerScrape } from '@/hooks/use-scrape';
import Link from 'next/link';
export default function SourcesPage() {
  const [key,setKey]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
  const client=useQueryClient(),scan=useTriggerScrape();
  const status=useQuery({queryKey:['sources'],queryFn:()=>fetch('/api/sources').then(r=>r.json()),refetchInterval:10000});
  return <div className="max-w-2xl space-y-5">
    <h1 className="text-2xl font-bold">Connect live listings</h1>
    <p>Auto.dev searches dealer inventory using your ZIP, radius, selected cars, year, price and mileage. Each manual scan uses at most three API calls. Automatic scanning stays off.</p>
    <ol className="list-decimal pl-5 space-y-3">
      <li><a className="underline text-primary" href="https://www.auto.dev/pricing" target="_blank" rel="noreferrer">Create an auto.dev Free account</a> and copy its API key. Check the provider’s current limits before choosing a plan.</li>
      <li>Paste the key below. It is saved only in this local app’s ignored .env.local file and sent to api.auto.dev during scans.</li>
      <li>Click Scan Now, then open Listings.</li>
    </ol>
    <label className="block text-sm font-medium">Auto.dev API key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} className="mt-2 block border rounded w-full p-3" /></label>
    <button disabled={saving || !key} className="rounded px-4 py-2 bg-primary text-primary-foreground disabled:opacity-50" onClick={async()=>{setSaving(true);try{const r=await fetch('/api/sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key})});const d=await r.json();if(!r.ok) throw new Error(d.error);setKey('');setMessage('Key saved. Click Scan Now to verify live access.');client.invalidateQueries({queryKey:['sources']});}catch(e){setMessage(e instanceof Error?e.message:'Connection failed');}finally{setSaving(false);}}}>Save connection</button>
    <p role="status">{message}</p>
    <div className="border rounded p-4 space-y-2">
      <p>{status.data?.configured ? 'Key configured; verify access with a scan.' : 'Waiting for an API key. No live listing access yet.'}</p>
      {status.data?.lastRun && <p>Last auto.dev scan: {status.data.lastRun.status}; {status.data.lastRun.newCount || 0} new, {status.data.lastRun.updatedCount || 0} updated. {status.data.lastRun.error || ''}</p>}
      <button disabled={!status.data?.configured || scan.isPending} className="border rounded px-4 py-2 disabled:opacity-50" onClick={()=>scan.mutate(undefined,{onSuccess:()=>setMessage('Scan started. Results and status will update.'),onError:e=>setMessage(e.message)})}>Scan Now</button>
      <Link href="/listings" className="ml-4 underline">View listings</Link>
    </div>
    <p className="text-sm text-muted-foreground">API tests use fixtures until your key is connected. Missing title/history stays unverified. Cars.com, AutoTrader and KBB remain unavailable; their zero-result checks do not provide a live feed.</p>
  </div>;
}
