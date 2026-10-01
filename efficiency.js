(function(root){'use strict';
const M=typeof module!=='undefined'?require('./engine.js'):root.Mahjong;
// Distance to a legal standard winning structure. Maximise retained natural tiles;
// held wildcards fill unmatched structure positions. At most four structural
// positions may require wildcards because a natural tile's physical capacity is 4.
const patterns=[];for(let m=0;m<=4;m++){patterns[m]=[[],[]];const seen=[new Set(),new Set()];const counts=Array(9).fill(0);function emit(){for(let p=0;p<=1;p++)for(let rank=0;rank<(p?9:1);rank++){if(p)counts[rank]+=2;const key=counts.join(',');if(!seen[p].has(key)){seen[p].add(key);patterns[m][p].push([...counts]);}if(p)counts[rank]-=2;}}
function generate(start,left){if(!left){emit();return;}for(let type=start;type<16;type++){const tiles=type<9?[type,type,type]:[type-9,type-8,type-7];tiles.forEach(i=>counts[i]++);generate(type,left-1);tiles.forEach(i=>counts[i]--);}}generate(0,m);}
const suitCache=new Map(),distanceCache=new Map();let evaluations=0;
function suitOptions(c,exposed,max){const key=c.join('')+':'+exposed.join('')+':'+max;if(suitCache.has(key))return suitCache.get(key);const out=[];for(let m=0;m<=max;m++){out[m]=[];for(let p=0;p<=1;p++){const best=Array(5).fill(-100);for(const pattern of patterns[m][p]){let matched=0,requiredWild=0;for(let i=0;i<9;i++){matched+=Math.min(c[i],pattern[i]);requiredWild+=Math.max(0,pattern[i]-(4-exposed[i]));}if(requiredWild<=4)best[requiredWild]=Math.max(best[requiredWild],matched);}out[m][p]=best;}}suitCache.set(key,out);return out;}
function shanten(hand,melds=[]){const error=M.validate(hand,melds);if(error)throw Error(error);const n=hand.reduce((a,b)=>a+b,0),size=14-3*melds.length;if(n!==size&&n!==size-1)throw Error(`需 ${size-1} 或 ${size} 张手牌`);const exposed=Array(28).fill(0);melds.flat().forEach(t=>exposed[t]++);const key=hand.join('')+':'+exposed.join('')+':'+melds.length;if(distanceCache.has(key))return distanceCache.get(key);evaluations++;const required=4-melds.length;let dp=new Map([['0,0,0',0]]);for(let s=0;s<3;s++){const options=suitOptions(hand.slice(s*9,s*9+9),exposed.slice(s*9,s*9+9),required);const next=new Map();for(const [key,matched] of dp){const [m,p,w]=key.split(',').map(Number);for(let add=0;add<=required-m;add++)for(let pair=0;pair<=1-p;pair++)for(let wild=0;wild<=4-exposed[27]-w;wild++){const value=options[add][pair][wild];if(value<0)continue;const k=[m+add,p+pair,w+wild].join(',');next.set(k,Math.max(next.get(k)??-100,matched+value));}}dp=next;}let best=-100;for(let w=0;w<=4-exposed[27];w++)best=Math.max(best,dp.get([required,1,w].join(','))??-100);if(best<0)throw Error('无法形成合法标准结构');const value=Math.max(-1,size-best-hand[27]-1);distanceCache.set(key,value);return value;}
function improving(hand,melds=[]){const s=shanten(hand,melds),used=[...hand];melds.flat().forEach(t=>used[t]++);const tiles=[];for(let t=0;t<28;t++){if(used[t]>=4)continue;const h=[...hand];h[t]++;if(shanten(h,melds)<s)tiles.push({tile:t,remaining:4-used[t]});}return {shanten:s,tiles,kinds:tiles.length,copies:tiles.reduce((a,t)=>a+t.remaining,0)};}
function baseAnalyze(hand,melds=[]){const size=14-3*melds.length,n=hand.reduce((a,b)=>a+b,0);if(n===size-1)return {mode:'draw',...improving(hand,melds)};if(n!==size)throw Error(`需 ${size-1} 或 ${size} 张手牌`);const options=[];hand.forEach((v,t)=>{if(!v)return;const h=[...hand];h[t]--;const result=improving(h,melds); // The discarded tile is known unavailable for this next draw.
const draw=result.tiles.find(x=>x.tile===t);if(draw){draw.remaining--;if(draw.remaining===0)result.tiles=result.tiles.filter(x=>x!==draw);result.kinds=result.tiles.length;result.copies=result.tiles.reduce((a,x)=>a+x.remaining,0);}options.push({discard:t,...result});});options.sort((a,b)=>a.shanten-b.shanten||b.copies-a.copies||b.kinds-a.kinds||a.discard-b.discard);return {mode:'discard',win:M.win(hand,melds),options};}
// Potential upper-player chi opportunities are separate from self-draw outs.
// knownUsed includes the proposed own discard, so it cannot reappear as an
// available external tile. No opponent/river probability is inferred.
function chiPotential(hand,melds=[],knownUsed=null,checkpoint=()=>{},effectiveTypes=null){
 const before=shanten(hand,melds),actual=[...hand];melds.flat().forEach(t=>actual[t]++);const used=knownUsed??actual;
 if(hand.reduce((a,b)=>a+b,0)!==13-3*melds.length)throw Error('吃牌机会需要待摸牌数量');
 if(!Array.isArray(used)||used.length!==28||used.some((n,t)=>!Number.isInteger(n)||n<actual[t]||n>4))throw Error('已知牌数无效');
 const tiles=[];if(before<=0||melds.length>=4)return {kinds:0,tiles};
 const candidates=effectiveTypes??Array.from({length:27},(_,t)=>t);for(const t of candidates){checkpoint();if(t===27||used[t]>=4)continue;const suit=Math.floor(t/9)*9,sequences=[];
  for(let start=Math.max(suit,t-2);start<=Math.min(t,suit+6);start++){checkpoint();const sequence=[start,start+1,start+2],take=sequence.filter(x=>x!==t);if(take.some(x=>hand[x]<1))continue;const h=[...hand];take.forEach(x=>h[x]--);const next=[...melds,sequence];if(M.validate(h,next))continue;
   // At a nonwinning full hand the best mandatory discard preserves the
   // matching-distance optimum. A winning structure must still discard after
   // chi, so the ready-state floor is 0, never -1 (self-draw-only rules).
   const distance=Math.max(0,shanten(h,next));if(distance<before)sequences.push({start,shanten:distance});
  }
  if(sequences.length)tiles.push({tile:t,shanten:Math.min(...sequences.map(x=>x.shanten)),sequences});
 }
 return {kinds:tiles.length,tiles};
}
function analyze(hand,melds=[],settings={}){
 const now=settings.now??(()=>globalThis.performance?.now?.()??Date.now()),started=now(),result=baseAnalyze(hand,melds),used=[...hand];melds.flat().forEach(t=>used[t]++);
 const deadline=Math.min(started+3000,now()+(settings.chiBudgetMs??1500)),stopped={};const checkpoint=()=>{if(now()>=deadline)throw stopped;};
 try{if(result.mode==='draw'){const chi=chiPotential(hand,melds,used,checkpoint,result.tiles.map(x=>x.tile));result.chi=chi;}else{const annotations=result.options.map(o=>{const h=[...hand];h[o.discard]--;return chiPotential(h,melds,used,checkpoint,o.tiles.map(x=>x.tile));});result.options.forEach((o,i)=>o.chi=annotations[i]);result.options.sort((a,b)=>a.shanten-b.shanten||b.copies-a.copies||b.kinds-a.kinds||b.chi.kinds-a.chi.kinds||a.discard-b.discard);}result.chiComplete=true;}
 catch(error){if(error!==stopped)throw error;result.chiComplete=false;result.chiReason='time_limit';}
 return result;
}
const api={shanten,improving,analyze,chiPotential,stats:()=>({evaluations,suitCache:suitCache.size,distanceCache:distanceCache.size})};if(typeof module!=='undefined')module.exports=api;else root.Efficiency=api;
})(globalThis);
