import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHmac, pbkdf2Sync } from 'node:crypto';
import { validateReminder, passwordHash, verifyLineSignature, retryDelay, safeEqual } from '../src/core';
if (!globalThis.crypto) Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const user='U'+'a'.repeat(32), now=Date.parse('2026-10-04T08:00:00+08:00');
test('台灣時間轉換與提醒內容驗證',()=>{
 const result=validateReminder({message:' 去洗衣服 ',contactId:user,dueAt:'2026-10-04T08:10:00+08:00'},now);
 assert.equal(result.dueAt,now+600000);assert.equal(result.message,'去洗衣服');
});
test('拒絕過去、無效日期、遠期、未知收件人與空內容',()=>{
 const valid={message:'提醒',contactId:user,dueAt:'2026-10-04T08:10:00+08:00'};
 for(const input of [{dueAt:'invalid'},{dueAt:'2026-10-04T07:00:00+08:00'},{dueAt:'2030-01-01'},{contactId:'someone'},{message:'   '},{message:'a'.repeat(2001)},{cardId:'../../card'}])assert.throws(()=>validateReminder({...valid,...input},now));
});
test('密碼雜湊與標準 PBKDF2 相符',async()=>assert.equal(await passwordHash('a-test-password','salt'),pbkdf2Sync('a-test-password','salt',100000,32,'sha256').toString('hex')));
test('LINE 簽章拒絕偽造、變更內容與不同 secret',async()=>{
 const body='{"events":[]}', secret='test-secret', signature=createHmac('sha256',secret).update(body).digest('base64');
 assert.equal(await verifyLineSignature(body,signature,secret),true);
 assert.equal(await verifyLineSignature(body+' ',signature,secret),false);
 assert.equal(await verifyLineSignature(body,signature,'wrong'),false);
 assert.equal(await verifyLineSignature(body,'bad',secret),false);
});
test('重試會逐次延後並限制最大等待',()=>{assert.equal(retryDelay(1),60000);assert.equal(retryDelay(3),240000);assert.equal(retryDelay(99),3600000);});
test('安全字串比較包含長度驗證',()=>{assert.equal(safeEqual('abc','abc'),true);assert.equal(safeEqual('abc','ab'),false);assert.equal(safeEqual('abc','abd'),false);});
