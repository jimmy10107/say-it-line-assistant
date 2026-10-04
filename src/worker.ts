import { GoogleGenAI, Modality } from '@google/genai';
import { AppError, validateReminder, retryDelay, sha256, passwordHash, safeEqual, verifyLineSignature } from './core';
interface Env {
  DB: D1Database; CARDS?: R2Bucket; ASSETS: Fetcher;
  PASSWORD_HASH: string; PASSWORD_SALT: string; GEMINI_API_KEY: string;
  LINE_CHANNEL_SECRET: string; LINE_CHANNEL_ACCESS_TOKEN: string;
  GEMINI_LIVE_MODEL: string; GEMINI_IMAGE_MODEL: string; GEMINI_TEXT_MODEL: string; PUBLIC_ORIGIN: string;
}
function json(data: unknown, status = 200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function body(request: Request) {
  const text = await request.text();
  if (text.length > 12000) throw new AppError(413, '輸入內容太長。');
  try { return JSON.parse(text); } catch { throw new AppError(400, '資料格式有誤。'); }
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new AppError(403, '請從 App 網址操作。');
}
async function authenticate(request: Request, env: Env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[0-9a-f-]{72}$/.test(token)) throw new AppError(401, '請先登入。');
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash=?').bind(await sha256(token)).first<{expires_at:number}>();
  if (!row || row.expires_at < Date.now()) throw new AppError(401, '登入已逾時，請重新登入。');
  return token;
}
async function login(request: Request, env: Env) {
  if (!env.PASSWORD_HASH || !env.PASSWORD_SALT) throw new AppError(503, '尚未設定登入密碼，請完成後端設定。');
  const ip = await sha256(request.headers.get('CF-Connecting-IP') || 'local');
  const now = Date.now();
  await env.DB.prepare('INSERT INTO login_attempts(ip,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END').bind(ip, now+900000, now, now, now+900000).run();
  const limit = await env.DB.prepare('SELECT attempts FROM login_attempts WHERE ip=?').bind(ip).first<{attempts:number}>();
  if ((limit?.attempts || 0) > 10) throw new AppError(429, '登入嘗試過多，請在 15 分鐘後再試。');
  const input = await body(request);
  if (typeof input.password !== 'string' || input.password.length > 256 || !safeEqual(await passwordHash(input.password, env.PASSWORD_SALT), env.PASSWORD_HASH)) throw new AppError(401, '密碼不正確。');
  const token = crypto.randomUUID()+crypto.randomUUID();
  await env.DB.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)').bind(await sha256(token), now+43200000).run();
  return json({token});
}
async function lineWebhook(request: Request, env: Env) {
  if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) throw new AppError(503, 'LINE 尚未設定。');
  const raw = await request.text();
  if (raw.length > 1000000) throw new AppError(413, '請求過大。');
  if (!await verifyLineSignature(raw, request.headers.get('x-line-signature') || '', env.LINE_CHANNEL_SECRET)) throw new AppError(401, 'LINE 簽章驗證失敗。');
  let payload; try {payload=JSON.parse(raw);} catch {throw new AppError(400,'資料格式有誤。');}
  for (const event of payload.events || []) {
    const userId = event.source?.userId;
    if (!/^U[0-9a-f]{32}$/.test(userId || '')) continue;
    if (!['follow','unfollow','message'].includes(event.type)) continue;
    if (event.webhookEventId) {
      const exists = await env.DB.prepare('SELECT id FROM webhook_events WHERE id=?').bind(event.webhookEventId).first();
      if (exists) continue;
    }
    if (event.type === 'unfollow') {
      await env.DB.prepare('UPDATE contacts SET active=0 WHERE id=?').bind(userId).run();
    } else {
      const result = await fetch('https://api.line.me/v2/bot/profile/'+userId, {headers:{Authorization:'Bearer '+env.LINE_CHANNEL_ACCESS_TOKEN}});
      if (!result.ok) throw new AppError(502, 'LINE 聯絡人讀取失敗，請稍後重送事件。');
      const profile = await result.json() as {displayName:string};
      await env.DB.prepare('INSERT INTO contacts(id,name,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=1').bind(userId, profile.displayName, Date.now()).run();
    }
    if (event.webhookEventId) await env.DB.prepare('INSERT OR IGNORE INTO webhook_events(id,created_at) VALUES(?,?)').bind(event.webhookEventId, Date.now()).run();
  }
  return json({ok:true});
}
async function api(request: Request, env: Env) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (method !== 'GET') sameOrigin(request);
  if (path === '/api/config' && method === 'GET') return json({backend:true, password:!!env.PASSWORD_HASH, live:!!env.GEMINI_API_KEY, line:!!env.LINE_CHANNEL_ACCESS_TOKEN && !!env.LINE_CHANNEL_SECRET && !!env.PUBLIC_ORIGIN, image:!!env.GEMINI_API_KEY});
  if (path === '/api/login' && method === 'POST') return login(request, env);
  if (path === '/api/line/webhook' && method === 'POST') return lineWebhook(request, env);
  const token = await authenticate(request, env);
  if (path === '/api/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run(); return json({ok:true});
  }
  if (path === '/api/contacts' && method === 'GET') return json((await env.DB.prepare('SELECT id,name,nickname,active FROM contacts ORDER BY created_at').all()).results);
  if (path.startsWith('/api/contacts/') && method === 'PATCH') {
    const input=await body(request), id=path.slice('/api/contacts/'.length);
    if (typeof input.nickname !== 'string' || input.nickname.trim().length > 40) throw new AppError(400,'暱稱最多 40 個字。');
    const result=await env.DB.prepare('UPDATE contacts SET nickname=? WHERE id=?').bind(input.nickname.trim(),id).run();
    if (!result.meta.changes) throw new AppError(404,'找不到聯絡人。'); return json({ok:true});
  }
  if (path === '/api/reminders' && method === 'GET') return json((await env.DB.prepare('SELECT r.*,COALESCE(NULLIF(c.nickname,\'\'),c.name) contact_name FROM reminders r JOIN contacts c ON c.id=r.contact_id ORDER BY due_at DESC LIMIT 200').all()).results);
  if (path === '/api/reminders' && method === 'POST') {
    if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.LINE_CHANNEL_SECRET || !env.PUBLIC_ORIGIN) throw new AppError(503,'請先完成 LINE 連接與正式網址設定。');
    const r = validateReminder(await body(request));
    const contact = await env.DB.prepare('SELECT id FROM contacts WHERE id=? AND active=1').bind(r.contactId).first();
    if (!contact) throw new AppError(400,'這位聯絡人尚未加入，或已封鎖官方帳號。');
    if (r.cardId && !await env.DB.prepare('SELECT id FROM cards WHERE id=?').bind(r.cardId).first()) throw new AppError(400,'找不到賀卡，請重新產生。');
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO reminders(id,contact_id,message,due_at,card_id,next_attempt,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,r.contactId,r.message,r.dueAt,r.cardId,r.dueAt,Date.now()).run();
    return json({id},201);
  }
  if (path.startsWith('/api/reminders/') && method === 'DELETE') {
    const result=await env.DB.prepare("UPDATE reminders SET status='cancelled' WHERE id=? AND status IN ('pending','failed')").bind(path.slice('/api/reminders/'.length)).run();
    if (!result.meta.changes) throw new AppError(409,'提醒已送出、正在發送或已取消。'); return json({ok:true});
  }
  if (path === '/api/cards' && method === 'POST') {
    if (!env.GEMINI_API_KEY) throw new AppError(503,'請先設定 Gemini 金鑰。');
    const input=await body(request);
    if (typeof input.prompt !== 'string' || input.prompt.trim().length < 2 || input.prompt.length > 1200) throw new AppError(400,'請用 2–1200 個字描述賀卡。');
    const client = new GoogleGenAI({apiKey:env.GEMINI_API_KEY});
    const interaction = await client.interactions.create({model:env.GEMINI_IMAGE_MODEL,input:'請製作一張完整的繁體中文賀卡，適合 LINE 分享。'+input.prompt,store:false});
    const img=interaction.output_image;
    if (!img?.data || !['image/png','image/jpeg','image/webp'].includes(img.mime_type || '')) throw new AppError(502,'模型未回傳圖片，請調整描述後再試。');
    const bytes=Uint8Array.from(atob(img.data),x=>x.charCodeAt(0));
    if (bytes.length > 10000000) throw new AppError(502,'賀卡超過 LINE 圖片大小限制。');
    const id=crypto.randomUUID(), key=crypto.randomUUID()+crypto.randomUUID();
    const statements=[env.DB.prepare('INSERT INTO cards(id,prompt,object_key,mime_type,created_at) VALUES(?,?,?,?,?)').bind(id,input.prompt,key,img.mime_type,Date.now())];
    if (env.CARDS) await env.CARDS.put(key,bytes,{httpMetadata:{contentType:img.mime_type}});
    else for(let offset=0,part=0;offset<bytes.length;offset+=524288,part++) statements.push(env.DB.prepare('INSERT INTO card_chunks(object_key,part,data) VALUES(?,?,?)').bind(key,part,bytes.slice(offset,offset+524288).buffer));
    await env.DB.batch(statements);
    return json({id,url:url.origin+'/media/'+key});
  }
  if (path === '/api/live-token' && method === 'POST') {
    if (!env.GEMINI_API_KEY) throw new AppError(503,'請先設定 Gemini 金鑰。');
    const client=new GoogleGenAI({apiKey:env.GEMINI_API_KEY});
    const ephemeral=await client.authTokens.create({config:{uses:1,expireTime:new Date(Date.now()+600000).toISOString(),newSessionExpireTime:new Date(Date.now()+60000).toISOString(),liveConnectConstraints:{model:env.GEMINI_LIVE_MODEL,config:{responseModalities:[Modality.AUDIO]}}}});
    return json({token:ephemeral.name,model:env.GEMINI_LIVE_MODEL});
  }
  throw new AppError(404,'找不到此功能。');
}
export async function deliverDue(env: Env, origin: string, now = Date.now()) {
  await env.DB.prepare("UPDATE reminders SET status='pending' WHERE status='sending' AND lease_until<?").bind(now).run();
  const {results}=await env.DB.prepare("SELECT * FROM reminders WHERE status='pending' AND next_attempt<=? ORDER BY next_attempt LIMIT 25").bind(now).all<any>();
  for (const r of results) {
    const claim=await env.DB.prepare("UPDATE reminders SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND status='pending'").bind(now+300000,r.id).run();
    if (!claim.meta.changes) continue;
    try {
      const contact=await env.DB.prepare('SELECT active FROM contacts WHERE id=?').bind(r.contact_id).first<{active:number}>();
      if (!contact?.active) throw new AppError(400,'聯絡人已封鎖官方帳號。');
      const messages:any[]=[{type:'text',text:r.message}];
      if (r.card_id) {
        const card=await env.DB.prepare('SELECT object_key FROM cards WHERE id=?').bind(r.card_id).first<{object_key:string}>();
        if (!card) throw new AppError(400,'找不到賀卡。');
        const imageUrl=origin+'/media/'+card.object_key;
        messages.push({type:'image',originalContentUrl:imageUrl,previewImageUrl:imageUrl});
      }
      const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_CHANNEL_ACCESS_TOKEN,'Content-Type':'application/json','X-Line-Retry-Key':r.id},body:JSON.stringify({to:r.contact_id,messages}),signal:AbortSignal.timeout(20000)});
      if (!response.ok && !(response.status===409 && response.headers.get('x-line-accepted-request-id'))) throw new AppError(response.status, 'LINE 回傳 '+response.status);
      await env.DB.prepare("UPDATE reminders SET status='sent',sent_at=?,lease_until=NULL,last_error=NULL WHERE id=?").bind(Date.now(),r.id).run();
    } catch (error) {
      const attempts=r.attempts+1, status=error instanceof AppError ? error.status : 503;
      const terminal=attempts>=5 || (status>=400 && status<500 && ![408,429].includes(status));
      await env.DB.prepare('UPDATE reminders SET status=?,next_attempt=?,lease_until=NULL,last_error=? WHERE id=?').bind(terminal?'failed':'pending',now+retryDelay(attempts),error instanceof AppError?error.message:'服務暫時無法連線',r.id).run();
    }
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM login_attempts WHERE reset_at<?').bind(now),
    env.DB.prepare('DELETE FROM webhook_events WHERE created_at<?').bind(now-7*86400000)
  ]);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const path=new URL(request.url).pathname;
      if (path.startsWith('/api/')) return await api(request,env);
      if (path.startsWith('/media/')) {
        const key=path.slice(7);
        if (!/^[0-9a-f-]{72}$/.test(key)) return new Response('Not found',{status:404});
        if(env.CARDS){
          const image=await env.CARDS.get(key);
          if (!image) return new Response('Not found',{status:404});
          return new Response(image.body,{headers:{'Content-Type':image.httpMetadata?.contentType || 'image/png','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
        }
        const card=await env.DB.prepare('SELECT mime_type FROM cards WHERE object_key=?').bind(key).first<{mime_type:string}>();
        if(!card)return new Response('Not found',{status:404});
        const rows=await env.DB.prepare('SELECT data FROM card_chunks WHERE object_key=? ORDER BY part').bind(key).all<{data:number[]}>();
        const total=rows.results.reduce((sum,row)=>sum+row.data.length,0);
        if(!total||total>10000000)return new Response('Not found',{status:404});
        const bytes=new Uint8Array(total);let offset=0;
        for(const row of rows.results){bytes.set(row.data,offset);offset+=row.data.length;}
        return new Response(bytes,{headers:{'Content-Type':card.mime_type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
      }
      const response=await env.ASSETS.fetch(request);
      const headers=new Headers(response.headers);
      headers.set('X-Content-Type-Options','nosniff');
      headers.set('Referrer-Policy','no-referrer');
      headers.set('Permissions-Policy','camera=(), microphone=(self)');
      headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' wss://generativelanguage.googleapis.com; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      return new Response(response.body,{status:response.status,headers});
    } catch(error) {
      if(error instanceof AppError) return json({error:error.message},error.status);
      console.error('Request failed:', error instanceof Error ? error.name : 'unknown');
      return json({error:'服務暫時無法完成，請檢查後端設定或稍後再試。'},500);
    }
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // PUBLIC_ORIGIN is required so LINE can fetch generated cards while the app is closed.
    const origin=env.PUBLIC_ORIGIN;
    if (!env.LINE_CHANNEL_ACCESS_TOKEN || !origin) return;
    ctx.waitUntil(deliverDue(env,origin));
  }
};
