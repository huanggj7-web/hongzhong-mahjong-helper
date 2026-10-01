'use strict';
(()=>{
const API='https://hongzhong-family-table.huanggj7.chatgpt.site';
const FRONT='https://huanggj7-web.github.io/hongzhong-mahjong-helper/';
const E=id=>document.getElementById(id),fmt=n=>(n>0?'+':'')+Mahjong.formatCents(n);
const ID=/^[a-f0-9]{32}$/;const defaults=['东','南','西','北'];
let active=null,record=null,snap=null,busy=false,online=false,timer=null,lastSeen=0,failures=0,namesDirty=false,dbPromise,validDraft=false,displayedRoundId=null;
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
function idb(){return dbPromise??=new Promise((resolve,reject)=>{const q=indexedDB.open('hongzhong-room-hosts',1);q.onupgradeneeded=()=>q.result.createObjectStore('hosts',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('浏览器无法保存开桌权限，请允许本地存储后重试'));});}
async function hostStore(mode,value){const db=await idb();return new Promise((resolve,reject)=>{const tx=db.transaction('hosts',mode==='get'?'readonly':'readwrite'),s=tx.objectStore('hosts'),q=mode==='get'?s.get(value):s.put(value);let result;q.onsuccess=()=>{result=q.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('开桌权限未能保存，请重试'));});}
function text(id,value){E(id).textContent=value;}
function share(){return FRONT+'#room='+active;}
function status(message,error=false){text('room-status',message);E('room-status').classList.toggle('error',error);text('room-action-status',error?message:(record?.pending?'上次提交待确认':''));E('room-action-status').classList.toggle('error',error);}
function lock(){const disabled=busy||!online||!record||!snap||!!record?.pending;
 for(const id of ['room-save','room-undo','room-save-names'])E(id).disabled=disabled||(id==='room-undo'&&!snap?.rounds.length)||(id==='room-save'&&!validDraft);
 E('room-retry').hidden=!record?.pending;E('room-retry').disabled=busy||!navigator.onLine;
 E('room-create').disabled=busy;E('room-entry').hidden=!record;E('room-save-names').hidden=!record;
 text('room-role',record?'点积分牌选择自摸的人，再调本局码和杠':'实时看分 · 由开桌人记账');
 E('room-names').querySelectorAll('input').forEach(n=>n.disabled=!record||busy);
 E('room-board').querySelectorAll('button').forEach(n=>n.disabled=!record||busy);
 document.querySelectorAll('[data-step-target]').forEach(button=>{const input=E(button.dataset.stepTarget),n=Number(input.value||0),max=button.dataset.stepTarget==='room-codes'?100:4;button.disabled=!record||busy||(button.dataset.step==='-1'&&n<=0)||(button.dataset.step==='1'&&n>=max);});
 E('room-base').disabled=!record||busy;
}
function roomNames(){return [...E('room-names').querySelectorAll('input')].map(n=>n.value.trim());}
function draft(){const winner=E('room-winner').value;if(winner==='')throw Error('请选择谁自摸');const r=Mahjong.calculate(E('room-base').value,Number(winner),E('room-codes').value,[0,1,2,3].map(i=>E('room-kong-'+i).value));return {baseCents:r.baseCents,winner:r.winner,codes:r.codes,kongs:r.kongs};}
function preview(){const box=E('room-preview');box.replaceChildren();validDraft=false;
 const selected=E('room-winner').value;E('room-board').querySelectorAll('button').forEach(card=>{const chosen=card.dataset.player===selected;card.classList.toggle('selected',chosen);card.setAttribute('aria-pressed',String(chosen));const tag=card.querySelector('.room-choice');if(tag)tag.textContent=chosen?'本局自摸':'点选自摸';});
 try{const d=draft(),r=Mahjong.calculate(Mahjong.formatCents(d.baseCents),d.winner,d.codes,d.kongs);validDraft=true;
 const lead=document.createElement('strong');lead.textContent=(snap?.names[d.winner]||defaults[d.winner])+' 自摸 · 基数 '+Mahjong.formatCents(d.baseCents);box.append(lead);
 const row=document.createElement('div');row.className='room-delta-preview';r.deltaCents.forEach((v,i)=>{const n=document.createElement('span');n.textContent=(snap?.names[i]||defaults[i])+' '+fmt(v);row.append(n);});box.append(row);
 }catch(e){box.textContent=e.message;}lock();
}
const rankOf=(totals,index)=>1+totals.filter(n=>n>totals[index]).length;
function renderBoard(s){const board=E('room-board'),focused=board.contains(document.activeElement)?document.activeElement.dataset.player:null,last=s.rounds.at(-1),previous=s.totalsCents.map((n,i)=>n-(last?.deltaCents[i]||0));const allZero=s.totalsCents.every(n=>n===0),hadRanking=s.rounds.length>1&&previous.some(n=>n!==0);const celebrate=displayedRoundId&&last?.id&&last.id!==displayedRoundId&&s.events.at(-1)?.kind==='round';displayedRoundId=last?.id||null;
 board.replaceChildren();[0,1,2,3].sort((a,b)=>s.totalsCents[b]-s.totalsCents[a]||a-b).forEach(i=>{const rank=rankOf(s.totalsCents,i),tied=s.totalsCents.filter(n=>n===s.totalsCents[i]).length>1;
 const card=document.createElement('button');card.type='button';card.className='room-score-card'+(!allZero&&rank===1?' leader':'');card.dataset.player=String(i);card.disabled=!record||busy;card.setAttribute('aria-label',s.names[i]+'，当前积分 '+fmt(s.totalsCents[i])+(record?'，选为自摸人':''));
 const top=document.createElement('span');top.className='room-card-heading';const name=document.createElement('b');name.textContent=s.names[i];const badge=document.createElement('span');badge.className='room-rank';badge.textContent=allZero?'同一起点':rank===1?(tied?'♛ 并列领先':'♛ 领先'):'第 '+rank+' 名';top.append(name,badge);
 const total=document.createElement('strong');total.className='room-total';total.id='room-points-'+i;total.textContent=fmt(s.totalsCents[i]);
 const detail=document.createElement('span');detail.className='room-card-detail';const movement=hadRanking&&!allZero?rankOf(previous,i)-rank:0;detail.textContent=last?'上局 '+fmt(last.deltaCents[i])+(movement>0?' · 升'+movement:movement<0?' · 降'+(-movement):''):'新开局 · 等待首局';
 card.append(top,total,detail);if(record){const choice=document.createElement('span');choice.className='room-choice';choice.textContent='点选自摸';card.append(choice);}card.onclick=()=>{E('room-winner').value=String(i);preview();};board.append(card);
 });if(focused!=null)board.querySelector('[data-player="'+focused+'"]')?.focus({preventScroll:true});if(celebrate){board.classList.add('just-scored');setTimeout(()=>board.classList.remove('just-scored'),450);}
}
function render(s){snap=s;lastSeen=Date.now();online=true;failures=0;E('room-current').hidden=false;E('local-score').hidden=true;E('room-link').value=share();text('room-limit','保存至 '+new Date(s.expiresAt).toLocaleDateString()+'；最多 '+s.maxEvents+' 次操作。仅把链接分享给同桌。');
 const wrap=E('room-names');if(!wrap.children.length){s.names.forEach((name,i)=>{const row=document.createElement('label');row.className='room-player';const title=document.createElement('span');title.textContent='第 '+(i+1)+' 家';const n=document.createElement('input');n.maxLength=12;n.setAttribute('aria-label','共享房间第 '+(i+1)+' 位昵称');n.oninput=()=>{namesDirty=true;};row.append(title,n);wrap.append(row);});}
 [...wrap.querySelectorAll('input')].forEach((n,i)=>{if(!namesDirty)n.value=s.names[i];text('room-kong-label-'+i,s.names[i]+' 杠');});
 const winner=E('room-winner'),chosen=winner.value;winner.replaceChildren(new Option('请选择',''));s.names.forEach((n,i)=>winner.append(new Option(n,String(i))));winner.value=chosen;renderBoard(s);
 text('room-round-count','已记 '+s.rounds.length+' 局 · '+new Date(lastSeen).toLocaleTimeString()+' 更新');
 const history=E('room-history');history.replaceChildren();s.events.slice(-12).reverse().forEach(e=>{const div=document.createElement('div');div.className='history-row';if(e.kind==='round')div.textContent=s.names[e.winner]+' 自摸 · 基数 '+Mahjong.formatCents(e.baseCents)+' · '+e.codes+' 码 · '+e.deltaCents.map((n,i)=>s.names[i]+' '+fmt(n)).join(' · ');else if(e.kind==='undo')div.textContent='已撤销一局 · '+e.deltaCents.map((n,i)=>s.names[i]+' '+fmt(n)).join(' · ');else if(e.kind==='names'&&Array.isArray(e.names))div.textContent='昵称已更新：'+e.names.join('、');else div.textContent='暂无法显示这条记录；总分以云端确认结果为准';history.append(div);});
 status(record?.pending?'有一笔提交结果待确认，请点“确认上次提交”':'已连接 · 云端已确认');preview();
}
async function fetchJSON(path,options={}){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(API+path,{...options,credentials:'omit',cache:'no-store',signal:controller.signal});let data;try{data=await response.json();}catch{throw Error('云端暂不可用，请稍后再试');}if(!response.ok){const e=Error(data.error||'云端请求失败');e.status=response.status;throw e;}return data;}finally{clearTimeout(timeout);}}
function schedule(){clearTimeout(timer);if(active&&!document.hidden)timer=setTimeout(poll,Math.min(30000,2500*Math.max(1,2**failures)));}
async function poll(){if(!active||busy||document.hidden){schedule();return;}const id=active;try{const s=await fetchJSON('/api/rooms/'+id);if(active===id)render(s);}catch(e){if(active===id){online=false;failures=Math.min(failures+1,4);const stale=lastSeen?'；上次更新 '+new Date(lastSeen).toLocaleTimeString():'';status((navigator.onLine?e.message:'当前离线')+stale+'。未同步时不能记账，可返回本机单独记分。',true);lock();}}finally{schedule();}}
async function sign(command){const raw=JSON.stringify(command),path='/api/rooms/'+active;const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},record.key,new TextEncoder().encode('mahjong-room-v1\nPOST\n'+path+'\n'+raw)));let str='';sig.forEach(b=>str+=String.fromCharCode(b));return {path,raw,signature:btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};}
async function submit(op,data){if(!record||!active)throw Error('只有开桌设备可以记账');if(record.pending)throw Error('请先确认上次提交结果');if(!online||!snap)throw Error('请等待重新连接后再记账');record.pending={op,requestId:randomId(),expectedRevision:snap.revision,data};await hostStore('put',record);return retryPending();}
async function retryPending(){if(busy||!record?.pending)return;busy=true;lock();status('正在提交，请等待云端确认');const id=active,command=record.pending;
 try{const signed=await sign(command),s=await fetchJSON(signed.path,{method:'POST',headers:{'Content-Type':'application/json','X-Room-Signature':signed.signature},body:signed.raw});if(active!==id)return;record.pending=null;await hostStore('put',record);if(command.op==='round'){E('room-winner').value='';E('room-codes').value='0';[0,1,2,3].forEach(i=>E('room-kong-'+i).value='0');}if(command.op==='names')namesDirty=false;render(s);status(command.op==='undo'?'撤销已由云端确认':'已由云端确认保存');}
 catch(e){online=false;if(e.status&&e.status<500){record.pending=null;await hostStore('put',record);status(e.message+'；输入已保留，请更新后重新确认',true);}else status('提交结果尚未确认，请保留此页面并点“确认上次提交”。不会重复记账。',true);}
 finally{busy=false;lock();schedule();}
}
async function openRoom(id){if(!ID.test(id)){status('房间链接不正确',true);return;}clearTimeout(timer);active=id;snap=null;record=null;lastSeen=0;online=false;namesDirty=false;displayedRoundId=null;E('room-names').replaceChildren();E('room-board').replaceChildren();E('room-history').replaceChildren();text('room-round-count','正在读取…');E('room-current').hidden=false;E('local-score').hidden=true;E('room-lobby').hidden=true;E('room-link').value=share();location.hash='room='+id;status('正在读取共享房间');try{record=await hostStore('get',id)||null;}catch{}lock();await poll();document.querySelector('[data-tab="score"]').click();}
async function create(){if(busy)return;busy=true;E('room-create').disabled=true;try{if(!crypto.subtle)throw Error('此浏览器不支持安全开桌，请换较新的浏览器');const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);active=randomId();record={id:active,key:keys.privateKey,pending:{op:'create',requestId:randomId(),expectedRevision:0,data:{publicKey,names:[...defaults]}}};await hostStore('put',record);location.hash='room='+active;E('room-current').hidden=false;E('room-lobby').hidden=true;E('local-score').hidden=true;busy=false;await retryPending();}catch(e){status(e.message,true);}finally{busy=false;lock();}}
function local(){if(busy)return;displayedRoundId=null;clearTimeout(timer);active=null;record=null;snap=null;online=false;namesDirty=false;history.replaceState(null,'',location.pathname+location.search);E('room-current').hidden=true;E('room-lobby').hidden=false;E('local-score').hidden=false;status('本机记分独立保留，不会自动上传或并入共享房间');}
E('room-create').onclick=create;E('room-local').onclick=local;E('room-join').onclick=()=>{const value=E('room-join-link').value.trim();const match=/(?:#room=)?([a-f0-9]{32})$/.exec(value);if(match)openRoom(match[1]);else status('请粘贴完整房间链接',true);};
E('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText(share());status('看分链接已复制；开桌权限不会包含在链接里');}catch{E('room-link').select();status('请长按链接并复制');}};
E('room-save').onclick=()=>{try{const d=draft();submit('round',d).catch(e=>status(e.message,true));}catch(e){status(e.message,true);}};
E('room-undo').onclick=()=>{const last=snap?.rounds.at(-1);if(last&&confirm('撤销共享房间当前最后一局？所有看分人都会看到撤销结果。'))submit('undo',{targetId:last.id}).catch(e=>status(e.message,true));};
E('room-save-names').onclick=()=>submit('names',{names:roomNames()}).catch(e=>status(e.message,true));E('room-retry').onclick=retryPending;
['room-winner','room-codes',...defaults.map((_,i)=>'room-kong-'+i)].forEach(id=>E(id).oninput=preview);
try{const base=localStorage.getItem('hongzhong-room-base');if(base){Mahjong.baseCents(base);E('room-base').value=base;}}catch{}
function baseChanged(){try{const cents=Mahjong.baseCents(E('room-base').value);text('room-base-label',Mahjong.formatCents(cents));localStorage.setItem('hongzhong-room-base',Mahjong.formatCents(cents));}catch{}preview();}
E('room-base').oninput=baseChanged;text('room-base-label',E('room-base').value);
E('room-config-toggle').onclick=()=>{E('room-settings').open=!E('room-settings').open;if(E('room-settings').open)E('room-settings').scrollIntoView({block:'nearest'});};
document.querySelectorAll('[data-step-target]').forEach(button=>button.onclick=()=>{const target=E(button.dataset.stepTarget),max=button.dataset.stepTarget==='room-codes'?100:4,current=Number(target.value||0);target.value=String(Math.max(0,Math.min(max,(Number.isInteger(current)?current:0)+Number(button.dataset.step))));preview();});
window.addEventListener('online',()=>{if(active)poll();});window.addEventListener('offline',()=>{online=false;status('当前离线，共享记账已暂停；现有输入保留',true);lock();});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&active)poll();});
window.addEventListener('hashchange',()=>{const match=/^#room=([a-f0-9]{32})$/.exec(location.hash);if(match&&match[1]!==active)openRoom(match[1]);});
const start=/^#room=([a-f0-9]{32})$/.exec(location.hash);if(start)openRoom(start[1]);else local();
})();
