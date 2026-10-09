import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoDevSearchUrl, normalizeAutoDevListing, searchAutoDev } from '../src/lib/scrapers/auto-dev';
import { assessListing, evidenceOf } from '../src/lib/deal-policy';
import type { SearchConfig, Listing } from '../src/lib/types';
const config={zip:'92648',radiusMiles:100,priceMax:1200000,mileageMax:120000,yearMin:2014,yearMax:2026,makesModels:'["Toyota Corolla","Honda Civic"]'} as SearchConfig;
const fixture={vehicle:{vin:'1HGCR2F30EA000001',year:2016,make:'Honda',model:'Civic'},retailListing:{price:11000,miles:85000,vdp:'https://dealer.example/car',dealer:'Example dealer',city:'Irvine',state:'CA',zip:'92614',carfaxUrl:'https://www.carfax.com/example'}};
test('official query forwards hard filters, used status and paging without credentials in URL',()=>{
  const url=autoDevSearchUrl(config,2);
  assert.equal(url.origin,'https://api.auto.dev');assert.equal(url.searchParams.get('zip'),'92648');
  assert.equal(url.searchParams.get('distance'),'100');assert.equal(url.searchParams.get('retailListing.price'),'1-12000');
  assert.equal(url.searchParams.get('retailListing.miles'),'0-120000');assert.equal(url.searchParams.get('vehicle.year'),'2014-2026');
  assert.equal(url.searchParams.get('retailListing.used'),'true');assert.equal(url.searchParams.get('page'),'2');
  assert.equal(url.searchParams.get('vehicle.make'),'Toyota,Honda');assert.equal(url.searchParams.has('apiKey'),false);
});
test('API normalization preserves cents, URL and radius evidence without inventing title/history',()=>{
  const row=normalizeAutoDevListing(fixture,config)!;
  assert.equal(row.price,1100000);assert.equal(row.mileage,85000);assert.equal(row.url,fixture.retailListing.vdp);
  assert.equal(row.noAccidents,undefined);assert.equal(evidenceOf(row).titleStatus,undefined);
  assert.equal(evidenceOf(row).distanceMiles,undefined);assert.equal(evidenceOf(row).radiusFilterMiles,100);
  const assessment=assessListing(row as Listing,config);
  assert.ok(assessment.unknown.includes('Title unverified'));assert.ok(!assessment.unknown.includes('Distance from selected ZIP unverified'));
  assert.ok(assessListing(row as Listing,{...config,radiusMiles:20}).unknown.includes('Distance from selected ZIP unverified'));
});
test('fetch authenticates only via header, preserves legitimate empty results and limits scans to three pages',async()=>{
  let calls=0;
  const fetcher=(async (url,init)=>{calls++;assert.ok(String(url).startsWith('https://api.auto.dev/listings?'));assert.equal((init!.headers as Record<string,string>).Authorization,'Bearer fake-test-key');assert.equal(init!.redirect,'error');return Response.json({data:Array(20).fill(fixture),links:{next:'https://api.auto.dev/listings?page=99'}});}) as typeof fetch;
  assert.equal((await searchAutoDev(config,{apiKey:'fake-test-key',fetcher})).length,60);assert.equal(calls,3);
  assert.equal((await searchAutoDev(config,{apiKey:'fake-test-key',fetcher:(async()=>Response.json({data:[]})) as typeof fetch})).length,0);
});
test('authentication, quota and malformed response errors do not silently become zero results',async()=>{
  for(const status of [401,403,429,500]) await assert.rejects(searchAutoDev(config,{apiKey:'fake-test-key',fetcher:(async()=>new Response('',{status})) as typeof fetch}),/auto.dev/);
  await assert.rejects(searchAutoDev(config,{apiKey:'fake-test-key',fetcher:(async()=>Response.json({error:'broken'})) as typeof fetch}),/unexpected response/);
});
