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
function baseCents(value){const s=String(value).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('基数须大于 0，最多两位小数');const [whole,fraction='']=s.split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<1||n>10000000)throw Error('基数须在 0.01～100000 之间');return n;}
function nonnegative(value,label,max){const s=String(value??'').trim();if(s==='')return 0;if(!/^\d+$/.test(s)||!Number.isSafeInteger(Number(s))||Number(s)>max)throw Error(`${label}须为 0～${max} 的整数`);return Number(s);}
function calculate(base,winner,codes,kongs){const b=baseCents(base);if(!Number.isInteger(winner)||winner<0||winner>3)throw Error('请选择自摸的人');const m=nonnegative(codes,'奖码数',100);if(!Array.isArray(kongs)||kongs.length!==4)throw Error('请录入四家杠次数');const k=kongs.map(v=>nonnegative(v,'杠次数',4)),sum=k.reduce((a,v)=>a+v,0),pay=b*(1+m);const selfdraw=Array.from({length:4},(_,i)=>i===winner?3*pay:-pay),kong=k.map(v=>b*(4*v-sum)),deltaCents=selfdraw.map((v,i)=>v+kong[i]);return {kind:'auto-v2',baseCents:b,winner,codes:m,kongs:k,deltaCents,selfdraw,kong};}
function validRound(r){if(Array.isArray(r))return r.length===4&&r.every(n=>Number.isSafeInteger(n)&&Number.isSafeInteger(n*100))&&r.reduce((a,b)=>a+b,0)===0;try{if(r?.kind!=='auto-v2'||!Number.isSafeInteger(r.baseCents)||!Array.isArray(r.deltaCents))return false;const v=calculate(formatCents(r.baseCents),r.winner,r.codes,r.kongs);return v.deltaCents.length===r.deltaCents.length&&v.deltaCents.every((n,i)=>n===r.deltaCents[i]);}catch{return false;}}
function totalsCents(rounds){return rounds.reduce((a,r)=>{if(!validRound(r))throw Error('存在无效积分记录');return a.map((v,i)=>{const n=v+(Array.isArray(r)?r[i]*100:r.deltaCents[i]);if(!Number.isSafeInteger(n))throw Error('累计积分超出安全范围');return n;});},[0,0,0,0]);}
function totals(rounds){return totalsCents(rounds).map(n=>n/100);}
function formatCents(n){if(!Number.isSafeInteger(n))throw Error('积分超出安全范围');const abs=Math.abs(n);return (n<0?'-':'')+Math.floor(abs/100)+(abs%100?'.'+String(abs%100).padStart(2,'0').replace(/0$/,''):'');}
const api={labels,validate,win,waits,discards,record,totals,baseCents,calculate,validRound,totalsCents,formatCents};if(typeof module!=='undefined')module.exports=api;else root.Mahjong=api;
})(globalThis);
