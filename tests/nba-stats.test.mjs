import test from "node:test";
import assert from "node:assert/strict";
import {parseGameLog,describeLogs} from "../lib/nba-stats.mjs";
const sample={
 labels:["MIN","FG","3PT","FT","REB","AST","STL","BLK","PTS"],
 events:{"401":{gameDate:"2026-10-20T23:00:00Z",opponent:{abbreviation:"BOS"},gameResult:"W"},
         "402":{gameDate:"2026-10-25T23:00:00Z",opponent:{abbreviation:"MIA"},gameResult:"L"}},
 seasonTypes:[{displayName:"Regular Season",categories:[{events:[
   {eventId:"401",stats:["36","12-24","4-10","4-4","5","7","1","0","32"]},
   {eventId:"402",stats:["30","10-20","3-7","2-2","4","6","0","1","25"]}
 ]}]}]
};
test("ESPN game logs respect the exact pregame cutoff",()=>{
 const games=parseGameLog(sample,"2026-10-24T23:00:00Z");
 assert.equal(games.length,1);
 assert.equal(games[0].pts,32);
 assert.equal(games[0].threes,4);
 assert.equal(games[0].pra,44);
 assert.equal(games[0].opponent,"BOS");
});
test("Cutoff prevents future games contaminating a historical matchup",()=>{
 assert.equal(parseGameLog(sample,"2026-10-20T23:00:00Z").length,0);
});
test("Current and prior season remain separately labelled",()=>{
 const current=parseGameLog(sample,"2026-10-24T23:00:00Z");
 const prior=[{...current[0],pts:20,reb:8,ast:4,pra:32}];
 const m=describeLogs(current,prior);
 assert.equal(m.pts.last5,32);
 assert.equal(m.pts.prior10,20);
 assert.equal(m.pts.currentGames,1);
});
