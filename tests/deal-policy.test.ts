import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessListing, explainScore, riskFlags, feeFlags } from '../src/lib/deal-policy';
import { normalizeMcpListing } from '../src/lib/scrapers/normalize';
import { importSchema } from '../src/lib/import-schema';
import type { Listing, SearchConfig } from '../src/lib/types';
const now = new Date('2026-10-08T12:00:00Z');
const config = {zip:'92648', radiusMiles:100,priceMax:1200000,mileageMax:120000,yearMin:2014,yearMax:2026,makesModels:'["Toyota Corolla"]'} as SearchConfig;
const base = {id:1,source:'manual',year:2016,make:'Toyota',model:'Corolla',price:1100000,mileage:95000,firstSeenAt:now.toISOString(),lastSeenAt:now.toISOString(),evidence:JSON.stringify({titleStatus:'clean',distanceMiles:25,searchZip:'92648'})} as Listing;
test('price, mileage, year and radius boundaries are enforced',()=>{
  assert.equal(assessListing({...base,price:1200000,mileage:120000,year:2014},config).eligible,true);
  for (const change of [{price:1200001},{mileage:120001},{year:2013},{make:'Ford'},{evidence:JSON.stringify({distanceMiles:101,searchZip:'92648'})}]) assert.equal(assessListing({...base,...change},config).eligible,false);
  assert.equal(assessListing({...base,mileage:100000},config).preferredMileage,false);
});
test('unknown history or distance cannot be called verified',()=>{
  assert.equal(assessListing({...base,evidence:null},config).verified,false);
  assert.equal(assessListing(base,{...config,zip:'90210'}).verified,false);
});
test('damage flags and negated history',()=>{
  for (const description of ['salvage title','rebuilt title','lemon buyback','flood damage','frame damage','structural damage']) assert.equal(assessListing({...base,evidence:JSON.stringify({description})},config).eligible,false);
  assert.deepEqual(riskFlags({evidence:JSON.stringify({description:'No salvage, no flood damage, no frame damage'})}),[]);
  assert.equal(feeFlags({evidence:JSON.stringify({description:'Price after down payment. Mandatory protection package.'})}).length,2);
});
test('market comparison excludes self, damage, stale peers and unrelated models',()=>{
  const peers=[2,3,4].map(id=>({...base,id,price:1200000}));
  const explained=explainScore(base,config,[base,...peers,{...base,id:5,price:100000,evidence:JSON.stringify({salvage:true})}],now);
  assert.equal(explained.comparableCount,3);assert.equal(explained.marketMedianCents,1200000);
  assert.ok(explained.parts.market>2);
  assert.equal(explainScore(base,config,[base],now).marketMedianCents,null);
  assert.ok(explainScore({...base,mileage:80000},config,[],now).score > explainScore({...base,mileage:110000},config,[],now).score);
});
test('normalization and import validation keep money units and reject corrupt evidence',()=>{
  const n=normalizeMcpListing({title:'2016 Toyota Corolla',price:'$11,000',mileage:'95,000 mi',dealerName:'Dealer',oneOwner:true});
  assert.equal(n.price,1100000);assert.equal(n.mileage,95000);assert.equal(n.dealerName,'Dealer');assert.equal(n.oneOwner,true);
  assert.equal(importSchema.safeParse([{source:'manual',id:'a',dealerRating:'5'}]).success,false);
  assert.equal(importSchema.safeParse([{source:'manual',id:'a',url:'javascript:alert(1)'}]).success,false);
});
