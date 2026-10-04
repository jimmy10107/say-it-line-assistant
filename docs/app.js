import { LiveVoice } from './live.js';
const $=id=>document.getElementById(id);
let demo=false, config={}, contacts=[], reminders=[], filter='pending', card=null, attachCard=null, token=sessionStorage.getItem('say-it-session')||'', live=null;
const storeKey='say-it-demo-v1';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=ms=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
function localInput(ms){return new Date(ms+8*3600000).toISOString().slice(0,16);}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
async function api(path,method='GET',data){
 const res=await fetch('./api/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});
 let result;try{result=await res.json();}catch{throw new Error('無法連接後端服務。');}
 if(!res.ok){if(res.status===401&&path!=='login'){token='';sessionStorage.removeItem('say-it-session');showLogin();}throw new Error(result.error||'操作失敗，請稍後再試。');}return result;
}
function showLogin(){if(!$('login-dialog').open)$('login-dialog').showModal();}
function seedDemo(){const now=Date.now();return {contacts:[{id:'demo-self',name:'我自己',nickname:'',active:1},{id:'demo-friend',name:'小花',nickname:'',active:1}],reminders:[{id:crypto.randomUUID(),contact_id:'demo-self',contact_name:'我自己',message:'出門前，記得帶雨傘。',due_at:now+3600000,status:'pending',created_at:now},{id:crypto.randomUUID(),contact_id:'demo-friend',contact_name:'小花',message:'下班後一起吃晚餐。',due_at:now+10800000,status:'pending',created_at:now}]};}
function saveDemo(){try{localStorage.setItem(storeKey,JSON.stringify({contacts,reminders}));}catch{toast('瀏覽器儲存空間不足，示範資料可能無法保存。');}}
async function refresh(){if(!demo){if(!token)return;[contacts,reminders]=await Promise.all([api('contacts'),api('reminders')]);}render();}
function render(){
 const pending=reminders.filter(r=>r.status==='pending'||r.status==='sending');$('pending-count').replaceChildren(document.createTextNode(String(pending.length)),Object.assign(document.createElement('small'),{textContent:'則待提醒'}));$('total-count').textContent=reminders.length;
 const list=reminders.filter(r=>filter==='all'||(filter==='pending'?['pending','sending','failed'].includes(r.status):r.status==='sent')).sort((a,b)=>a.due_at-b.due_at);
 const statuses={pending:demo?'示範・待提醒':'待提醒',sending:'正在發送',sent:demo?'示範・已送出':'LINE 已接受',failed:'發送失敗',cancelled:'已取消'};
 $('reminder-list').innerHTML=list.length?list.map(r=>`<article class="reminder-row"><div class="reminder-icon">${r.card_id?'✧':'◷'}</div><div class="reminder-copy"><h3>${escape(r.message)}</h3><p>${escape(r.contact_name||contacts.find(c=>c.id===r.contact_id)?.nickname||contacts.find(c=>c.id===r.contact_id)?.name||'聯絡人')} <span> · </span> ${statuses[r.status]||escape(r.status)}${r.last_error?' · '+escape(r.last_error):''}</p></div><div class="reminder-time">${formatDate(r.due_at)}<small>台灣時間</small></div>${['pending','failed'].includes(r.status)?`<button class="row-action" data-cancel="${escape(r.id)}">取消</button>`:''}</article>`).join(''):'<div class="empty">這裡還沒有提醒。<br>替未來的自己，記下一件重要的事。</div>';
 $('contact-list').innerHTML=contacts.length?contacts.map(c=>`<article class="contact"><div class="contact-avatar">${escape((c.nickname||c.name).slice(0,1))}</div><h3>${escape(c.nickname||c.name)}</h3><p>${escape(c.name)} · ${c.active?'可接收提醒':'已封鎖官方帳號'}</p><label for="nick-${escape(c.id)}">好記的暱稱</label><input id="nick-${escape(c.id)}" value="${escape(c.nickname||'')}" maxlength="40" placeholder="例如：媽媽、小花"><button class="secondary" data-nickname="${escape(c.id)}">儲存暱稱</button></article>`).join(''):'<div class="empty">尚未有聯絡人加入。<br>請先完成 LINE 連接，再加入官方帳號並傳送一句訊息。</div>';
 $('recipient').innerHTML=contacts.filter(c=>c.active).map(c=>`<option value="${escape(c.id)}">${escape(c.nickname||c.name)}</option>`).join('');
 const connected=[['雲端後端','離開頁面後，仍會繼續執行排程。',!demo],['密碼登入','私人提醒與聯絡人需要登入才能查看。',!demo&&config.password],['Gemini 語音與賀卡','即時語音對話，以及 AI 賀卡生成。',!demo&&config.live],['LINE 官方帳號','透過 Messaging API 接收好友與發送提醒。',!demo&&config.line]];
 $('connection-list').innerHTML=connected.map(([name,desc,ok])=>`<div class="connection"><div><h3>${name}</h3><p>${desc}</p></div><span class="${ok?'':'missing'}">${ok?'已設定':'待設定'}</span></div>`).join('');
 $('logout').hidden=demo||!token;$('reset-demo').hidden=!demo;
}
function view(name){if(!['reminders','contacts','cards','settings'].includes(name))return;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+name);document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.view===name));$('page-name').textContent={reminders:'我的提醒',contacts:'聯絡人',cards:'心意賀卡',settings:'連接設定'}[name];}
function openReminder(draft={}){
 if(!demo&&!token){showLogin();return;}
 if(!contacts.some(c=>c.active)){toast('請先讓聯絡人加入 LINE 官方帳號。');view('contacts');return;}
 $('message').value=draft.message||'';$('due-at').value=localInput(draft.dueAt?Date.parse(draft.dueAt):Date.now()+600000);$('due-at').min=localInput(Date.now()+60000);
 if(draft.contactId)$('recipient').value=draft.contactId;
 attachCard=draft.cardId||null;$('attached-card').hidden=!attachCard;$('reminder-error').textContent='';$('confirm-note').textContent=demo?'這是示範提醒，只會儲存在此瀏覽器，不會傳送 LINE。':'確認後將建立 LINE 排程。LINE 接受訊息不代表對方已閱讀。';
 if(!$('reminder-dialog').open)$('reminder-dialog').showModal();
}
function parseBasic(text){
 const chinese={'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十五':15,'二十':20,'三十':30};
 const match=text.match(/(\d+|十五|二十|三十|[一二兩三四五六七八九十])\s*(分鐘|小時|天)(之後|後)/);
 if(!match)throw new Error('請使用「10 分鐘後」這類時間，或直接按「新增提醒」選擇日期。');
 const count=Number(match[1])||chinese[match[1]], factor={'分鐘':60000,'小時':3600000,'天':86400000}[match[2]];
 const prefix=text.slice(0,match.index).replace(/^(請)?提醒/,'').trim();
 const person=prefix.replace(/^我$/,'我自己');
 const contact=person?contacts.find(c=>(c.nickname||c.name)===person||c.name===person):contacts.find(c=>c.id==='demo-self')||contacts[0];
 if(!contact)throw new Error('找不到「'+person+'」，請在聯絡人頁面設定暱稱，或手動選擇收件人。');
 const message=text.slice(match.index+match[0].length).replace(/^[，,\s]+/,'').trim();if(!message)throw new Error('請補上想提醒的內容。');
 return {message,contactId:contact.id,dueAt:new Date(Date.now()+count*factor).toISOString()};
}
async function command(text){if(!text.trim())return;try{if(live?.connected){live.sendText(text);return;}openReminder(parseBasic(text));}catch(error){toast(error.message);}}
document.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-view]');if(nav)view(nav.dataset.view);
 const f=event.target.closest('[data-filter]');if(f){filter=f.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===f));render();}
 const cancel=event.target.closest('[data-cancel]');if(cancel){cancel.disabled=true;try{if(demo){reminders.find(r=>r.id===cancel.dataset.cancel).status='cancelled';saveDemo();}else await api('reminders/'+cancel.dataset.cancel,'DELETE');await refresh();toast('提醒已取消。');}catch(error){toast(error.message);cancel.disabled=false;}}
 const nick=event.target.closest('[data-nickname]');if(nick){const nickname=$('nick-'+nick.dataset.nickname).value.trim();try{if(demo){contacts.find(c=>c.id===nick.dataset.nickname).nickname=nickname;saveDemo();}else await api('contacts/'+nick.dataset.nickname,'PATCH',{nickname});await refresh();toast('暱稱已儲存。');}catch(error){toast(error.message);}}
 const prompt=event.target.closest('[data-prompt]');if(prompt)$('card-prompt').value=prompt.dataset.prompt;
});
$('new-reminder').onclick=()=>openReminder();$('close-dialog').onclick=()=>$('reminder-dialog').close();$('account').onclick=()=>view('settings');
$('text-command').onsubmit=event=>{event.preventDefault();command($('command').value);};
$('sample-prompt').onclick=()=>{$('command').value='提醒我 10 分鐘後去洗衣服';if(!demo&&!contacts.some(c=>c.name==='我自己'||c.nickname==='我自己')){openReminder({message:'去洗衣服'});return;}command($('command').value);};
$('reminder-form').onsubmit=async event=>{
 event.preventDefault();const submit=event.submitter;submit.disabled=true;$('reminder-error').textContent='';
 try{const dueAt=new Date($('due-at').value+':00+08:00').toISOString();const data={message:$('message').value.trim(),contactId:$('recipient').value,dueAt,cardId:attachCard};
 if(Date.parse(dueAt)<Date.now()+5000||Date.parse(dueAt)>Date.now()+366*86400000)throw new Error('請選擇 5 秒後到一年內的提醒時間。');
 if(demo){reminders.push({id:crypto.randomUUID(),message:data.message,contact_id:data.contactId,contact_name:contacts.find(c=>c.id===data.contactId)?.nickname||contacts.find(c=>c.id===data.contactId)?.name,due_at:Date.parse(dueAt),card_id:data.cardId,status:'pending',created_at:Date.now()});saveDemo();}else await api('reminders','POST',data);
 $('reminder-dialog').close();await refresh();toast(demo?'已儲存示範提醒，不會發送 LINE。':'提醒已排定。');
 }catch(error){$('reminder-error').textContent=error.message;}finally{submit.disabled=false;}
};
$('login-form').onsubmit=async event=>{event.preventDefault();event.submitter.disabled=true;try{const response=await api('login','POST',{password:$('password').value});token=response.token;sessionStorage.setItem('say-it-session',token);$('password').value='';$('login-error').textContent='';$('login-dialog').close();await refresh();toast('歡迎回來。');}catch(error){$('login-error').textContent=error.message;}finally{event.submitter.disabled=false;}};
$('login-dialog').addEventListener('cancel',event=>event.preventDefault());
$('logout').onclick=async()=>{try{await api('logout','POST',{});}catch{}await live?.stop();token='';sessionStorage.removeItem('say-it-session');contacts=[];reminders=[];render();showLogin();};
$('reset-demo').onclick=()=>{const data=seedDemo();contacts=data.contacts;reminders=data.reminders;saveDemo();render();toast('已重設示範資料。');};
$('card-form').onsubmit=async event=>{
 event.preventDefault();if(demo){toast('示範模式不會呼叫付費圖片服務。完成 Gemini 設定後即可生成賀卡。');return;}
 if(!token){showLogin();return;}if(!config.image){toast('請先在後端設定 Gemini 金鑰。');return;}
 const button=$('generate-card');button.disabled=true;button.textContent='正在製作你的賀卡…';
 try{card=await api('cards','POST',{prompt:$('card-prompt').value});$('card-preview').src=card.url;$('card-preview').hidden=false;$('card-placeholder').hidden=true;$('schedule-card').hidden=false;toast('賀卡完成，請先確認畫面與文字。');}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='✧ 生成賀卡';}
};
$('schedule-card').onclick=()=>{if(card)openReminder({message:'送給你的一點祝福。',cardId:card.id});};
$('mic').onclick=async()=>{
 if(demo){toast('示範模式不會開啟麥克風。請用文字或「新增提醒」體驗；設定 Gemini 後可啟用即時語音。');return;}
 if(!token){showLogin();return;}if(!config.live){toast('請先設定 Gemini 金鑰。');return;}
 if(live&&!live.ended){await live.stop();live=null;return;}live=null;
 try{live=new LiveVoice({getToken:()=>api('live-token','POST',{}),contacts:()=>contacts,onStatus:(text,active)=>{$('voice-state').textContent=text;$('mic').classList.toggle('listening',active);$('mic').setAttribute('aria-label',active?'結束語音對話':'開始語音對話');},onTranscript:text=>$('voice-caption').textContent=text,onDraft:openReminder,onCard:prompt=>{view('cards');$('card-prompt').value=prompt;toast('賀卡描述已填入。確認後按「生成賀卡」。');},onError:text=>toast(text)});await live.start();}catch(error){await live?.stop();live=null;toast(error.message);}
};
async function init(){
 $('today').textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'long'}).format(new Date());
 try{const res=await fetch('./api/config',{cache:'no-store'});if(!res.ok||!res.headers.get('content-type')?.includes('application/json'))throw new Error('static');config=await res.json();if(!config.backend)throw new Error('static');}catch{demo=true;}
 if(demo){$('mode-banner').hidden=false;$('delivery-label').textContent='示範資料，不會發送通知';$('image-note').textContent='示範模式不會呼叫 AI 圖片服務，連接後端後即可使用。';let data;try{data=JSON.parse(localStorage.getItem(storeKey));}catch{}if(!Array.isArray(data?.contacts)||!Array.isArray(data?.reminders))data=seedDemo();contacts=data.contacts;reminders=data.reminders;saveDemo();render();}
 else{render();if(!config.password){view('settings');toast('請先完成後端密碼與金鑰設定。');}else if(!token)showLogin();else try{await refresh();}catch(error){toast(error.message);}}
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();setInterval(()=>{if(!demo&&token&&!$('reminder-dialog').open)refresh().catch(()=>{});},30000);
