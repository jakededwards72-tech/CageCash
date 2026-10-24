import test from "node:test";
import assert from "node:assert/strict";
import {decimal,normalizeMarkets,normalizeOddsEvents,matchOddsGame} from "../lib/nba-pricing.mjs";
const pair=(key,one,two,book="fanduel")=>({key,last_update:"2026-10-24T12:00:00Z",outcomes:[one,two]});
const book=(id,away=-110,home=-110,spread=2.5)=>({key:id,title:id,markets:[
  pair("h2h",{name:"LA Clippers",price:away},{name:"Miami Heat",price:home}),
  pair("spreads",{name:"LA Clippers",point:-spread,price:-110},{name:"Miami Heat",point:spread,price:-110}),
  pair("totals",{name:"Over",point:225.5,price:-110},{name:"Under",point:225.5,price:-110})
]});
const game={id:"abcdef01234567",away_team:"LA Clippers",home_team:"Miami Heat",
  commence_time:"2026-10-24T23:30:00Z",bookmakers:[book("fanduel",+120,-110),book("draftkings"),book("betmgm"),book("caesars")]};
test("American odds conversion",()=>{
  assert.equal(decimal(100),2);
  assert.equal(decimal(-100),2);
  assert.ok(Math.abs(decimal(-110)-1.9090909)<0.00001);
  assert.equal(decimal(0),null);
});
test("No invented fair price without two independent peer books",()=>{
  const one=normalizeMarkets({...game,bookmakers:[book("a")]});
  assert.equal(one.find(m=>m.market==="h2h")?.fairProbability,null);
  const two=normalizeMarkets({...game,bookmakers:[book("a"),book("b")]});
  assert.equal(two.find(m=>m.market==="h2h")?.ev,null);
});
test("Best price is compared to books EXCLUDING itself",()=>{
  const out=normalizeMarkets(game);
  const away=out.find(m=>m.market==="h2h"&&m.side==="away");
  assert.equal(away?.bestBook.bookmakerID,"fanduel");
  assert.equal(away?.peerBooks,3);
  assert.ok(Math.abs((away?.fairProbability??0)-0.5)<0.001);
  assert.ok((away?.ev??0)>0);
});
test("Do not compare spreads at unlike point values",()=>{
  const out=normalizeMarkets({...game,bookmakers:[book("a",-110,-110,2.5),book("b",-110,-110,3.5),book("c",-110,-110,3.5)]});
  const lines=out.filter(m=>m.market==="spreads"&&m.side==="away");
  assert.equal(lines.length,2);
  assert.ok(lines.every(m=>m.ev===null));
});
test("Player props pair only same athlete, market and line",()=>{
  const mk=(name,point)=>pair("player_points",{name:"Over",description:name,point,price:-110},{name:"Under",description:name,point,price:-110});
  const raw={...game,bookmakers:[{key:"a",markets:[mk("Player Alpha",18.5)]},{key:"b",markets:[mk("Player Alpha",18.5)]},{key:"c",markets:[mk("Player Beta",18.5)]}]};
  const out=normalizeMarkets(raw,["player_points"]);
  assert.equal(out.length,4);
  assert.ok(out.every(x=>x.ev===null));
});
test("Scoreboard identity correctly matches LA Clippers alias",()=>{
  const odd=normalizeOddsEvents([game]);
  const matched=matchOddsGame({away:{name:"Los Angeles Clippers"},home:{name:"Miami Heat"}},odd);
  assert.equal(matched?.eventId,"abcdef01234567");
});
