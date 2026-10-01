(function(root){
'use strict';
const labels=Array.from({length:27},(_,i)=>`${i%9+1}${['万','筒','条'][Math.floor(i/9)]}`).concat('红中');
function validate(hand,melds=[]){
 if(!Array.isArray(hand)||hand.length!==28||hand.some(n=>!Number.isInteger(n)||n<0||n>4))return '每种牌须为 0～4 张';
 if(!Array.isArray(melds)||melds.length>4)return '副露最多四组';
 const total=[...hand];
 for(const m of melds){if(!Array.isArray(m)||![3,4].includes(m.length)||m.some(t=>!Number.isInteger(t)||t<0||t>27))return '副露格式错误'; const s=[...m].sort((a,b)=>a-b);if(!(s.every(t=>t===s[0])||(s.length===3&&s[0]<27&&Math.floor(s[0]/9)===Math.floor(s[2]/9)&&s[1]===s[0]+1&&s[2]===s[0]+2)))return '副露须为顺子、刻子或杠';for(const t of m)total[t]++;}
 if(total.some(n=>n>4))return '手牌与副露合计：每种牌最多四张';return '';
}
function win(hand,melds=[]){
 if(validate(hand,melds)||hand.reduce((a,b)=>a+b,0)!==14-3*melds.length)return false;
 const c=hand.slice(0,27),memo=new Map();
 function sets(w){const key=c.join('')+':'+w;if(memo.has(key))return memo.get(key);const i=c.findIndex(n=>n>0);if(i<0)return w%3===0;let ok=false;
 for(let take=Math.min(3,c[i]);take>=1&&!ok;take--){if(3-take<=w){c[i]-=take;ok=sets(w-3+take);c[i]+=take;}}
 if(!ok){const suit=Math.floor(i/9)*9;for(let start=Math.max(suit,i-2);start<=Math.min(i,suit+6)&&!ok;start++){let missing=0;const used=[];for(let t=start;t<start+3;t++){if(c[t]>0){c[t]--;used.push(t);}else missing++;}if(missing<=w)ok=sets(w-missing);for(const t of used)c[t]++;}}
 memo.set(key,ok);return ok;}
 const w=hand[27];if(w>=2&&sets(w-2))return true;for(let i=0;i<27;i++){for(let take=Math.min(2,c[i]);take>=1;take--){if(2-take>w)continue;c[i]-=take;const ok=sets(w-2+take);c[i]+=take;if(ok)return true;}}return false;
}
function waits(hand,melds=[]){if(validate(hand,melds)||hand.reduce((a,b)=>a+b,0)!==13-3*melds.length)return [];const totals=[...hand];for(const m of melds)for(const t of m)totals[t]++;const out=[];for(let t=0;t<28;t++){if(totals[t]>=4)continue;const h=[...hand];h[t]++;if(win(h,melds))out.push(t);}return out;}
function discards(hand,melds=[]){if(validate(hand,melds)||hand.reduce((a,b)=>a+b,0)!==14-3*melds.length)return [];return hand.flatMap((n,t)=>{if(!n)return [];const h=[...hand];h[t]--;const draws=waits(h,melds);return draws.length?[{tile:t,draws}]:[];});}
function record(rounds,delta){if(delta.length!==4||delta.some(n=>!Number.isSafeInteger(n))||delta.reduce((a,b)=>a+b,0)!==0)throw Error('四人增减须为整数，合计为 0');return [...rounds,[...delta]];}
function totals(rounds){return rounds.reduce((a,r)=>a.map((v,i)=>v+r[i]),[0,0,0,0]);}
function dice(random=Math.random){return [1+Math.floor(random()*6),1+Math.floor(random()*6)];}
const api={labels,validate,win,waits,discards,record,totals,dice};if(typeof module!=='undefined')module.exports=api;else root.Mahjong=api;
})(globalThis);
