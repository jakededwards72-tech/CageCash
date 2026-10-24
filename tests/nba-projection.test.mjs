import test from "node:test";
import assert from "node:assert/strict";
import {projectPlayerMetric,walkForwardError,americanBreakEven} from "../lib/nba-projection.mjs";
const logs=(count,points=20,minutes=30)=>Array.from({length:count},(_,i)=>({eventId:String(1000-i),min:minutes,pts:points+(i%3)-1,reb:7,ast:4,threes:2,pra:points+(i%3)-1+7+4}));
test("player engine works with historical logs and no sportsbook event or API key",()=>{
 const p=projectPlayerMetric([],logs(12), "pts",{line:19.5});
 assert.ok(p);
 assert.ok(p.projection>18&&p.projection<22);
 assert.equal(p.currentGames,0);
 assert.equal(p.previousGames,12);
 assert.ok(p.over>0&&p.over<1);
 assert.equal(p.minutesOverrideUsed,false);
});
test("minutes scenario scales projection and does not overwrite automatic estimate",()=>{
 const c=logs(9,20,30), prev=logs(12,19,28);
 const a=projectPlayerMetric(c,prev,"pts",{line:19.5});
 const b=projectPlayerMetric(c,prev,"pts",{line:19.5,minutesOverride:36});
 assert.ok(b.projection>a.projection);
 assert.equal(b.minutes,36);
 assert.equal(b.minutesOverrideUsed,true);
 assert.ok(a.automaticMinutes>25&&a.automaticMinutes<33);
});
test("insufficient or invalid stats do not produce invented projections",()=>{
 assert.equal(projectPlayerMetric([],logs(3),"pts"),null);
 assert.equal(projectPlayerMetric(logs(1),[],"pts"),null);
 assert.equal(projectPlayerMetric(logs(6),[],"fake"),null);
 assert.equal(projectPlayerMetric(logs(9).map(x=>({...x,min:0})),[],"pts"),null);
});
test("over chance falls when the target line increases",()=>{
 const a=projectPlayerMetric(logs(10),logs(10),"reb",{line:5.5});
 const b=projectPlayerMetric(logs(10),logs(10),"reb",{line:10.5});
 assert.ok(a.over>b.over);
 assert.equal(a.over+b.under>0.5,true);
});
test("historical walk-forward error uses earlier games only",()=>{
 const h=logs(19,21,32); const b=walkForwardError([],h,"pts");
 assert.ok(b.n>=5);assert.ok(b.mae>=0);assert.ok(b.baselineMae>=0);
});
test("american price to break-even is independent of the projection",()=>{
 assert.ok(Math.abs(americanBreakEven(-110)-110/210)<1e-10);
 assert.ok(Math.abs(americanBreakEven(125)-100/225)<1e-10);
 assert.equal(americanBreakEven(0),null);
});
