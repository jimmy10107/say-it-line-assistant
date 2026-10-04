import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverDue } from '../src/worker';

function database(options:{attempts?:number,claimed?:boolean,active?:boolean,card?:boolean}={}){
 const row:any={id:'a4d932e1-a4a9-4fb7-8e09-096bd6111411',contact_id:'U'+'a'.repeat(32),message:'去洗衣服',attempts:options.attempts||0,card_id:options.card?'card':null};
 const writes:any[]=[];
 return {row,writes,prepare(sql:string){let values:any[]=[];const stmt:any={bind(...args:any[]){values=args;return stmt;},async first(){return sql.includes('contacts')?{active:options.active===false?0:1}:{object_key:'random-image-key'};},async all(){return {results:[row]};},async run(){writes.push({sql,values});return {meta:{changes:sql.includes("status='sending'")&&options.claimed===false?0:1}};}};return stmt;},async batch(){return []}};
}
test('排程成功後標記送出，LINE 帶相同重試鍵',async()=>{
 const db=database(), original=globalThis.fetch;let request:any;
 globalThis.fetch=async(_url,init)=>{request=init;return new Response('{}',{status:200});};
 try{await deliverDue({DB:db,LINE_CHANNEL_ACCESS_TOKEN:'fake'} as any,'https://app.example',1000);assert.equal(request.headers['X-Line-Retry-Key'],db.row.id);assert.equal(JSON.parse(request.body).to,db.row.contact_id);assert.ok(db.writes.some(w=>w.sql.includes("status='sent'")));}finally{globalThis.fetch=original;}
});
test('claim 失敗時不重複呼叫 LINE',async()=>{
 const db=database({claimed:false}),original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
 try{await deliverDue({DB:db} as any,'https://app.example',1000);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('429 暫時錯誤保留提醒並延後重試',async()=>{
 const db=database(),original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:429});
 try{await deliverDue({DB:db} as any,'https://app.example',1000);const write=db.writes.find(w=>w.sql.includes('next_attempt=?'));assert.equal(write.values[0],'pending');assert.equal(write.values[1],61000);}finally{globalThis.fetch=original;}
});
test('第 5 次錯誤與永久錯誤標記 failed',async()=>{
 const original=globalThis.fetch;
 try{for(const [attempts,status] of [[4,503],[0,400]]){const db=database({attempts});globalThis.fetch=async()=>new Response('{}',{status});await deliverDue({DB:db} as any,'https://app.example',1000);assert.equal(db.writes.find(w=>w.sql.includes('next_attempt=?')).values[0],'failed');}}finally{globalThis.fetch=original;}
});
test('LINE 已接受的重試回覆 409 視為送出成功',async()=>{
 const db=database(),original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:409,headers:{'x-line-accepted-request-id':'accepted'}});
 try{await deliverDue({DB:db} as any,'https://app.example',1000);assert.ok(db.writes.some(w=>w.sql.includes("status='sent'")));}finally{globalThis.fetch=original;}
});
test('賀卡使用公開 HTTPS 圖片網址，封鎖收件人不發送',async()=>{
 const original=globalThis.fetch;let messages:any;let calls=0;
 globalThis.fetch=async(_url,init)=>{calls++;messages=JSON.parse(init!.body as string).messages;return new Response('{}');};
 try{const db=database({card:true});await deliverDue({DB:db} as any,'https://app.example',1000);assert.equal(messages[1].originalContentUrl,'https://app.example/media/random-image-key');await deliverDue({DB:database({active:false})} as any,'https://app.example',1000);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
