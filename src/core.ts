export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function validateReminder(input: any, now = Date.now()) {
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const dueAt = typeof input.dueAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(input.dueAt) ? Date.parse(input.dueAt) : NaN;
  if (!message || message.length > 2000) throw new AppError(400, '提醒內容需要 1–2000 個字。');
  if (!Number.isFinite(dueAt) || dueAt < now + 5000 || dueAt > now + 366 * 86400000) throw new AppError(400, '請選擇 5 秒後到一年內的提醒時間。');
  if (typeof input.contactId !== 'string' || !/^U[0-9a-f]{32}$/.test(input.contactId)) throw new AppError(400, '請選擇已加入 LINE 的聯絡人。');
  if (input.cardId != null && (typeof input.cardId !== 'string' || !/^[0-9a-f-]{36}$/.test(input.cardId))) throw new AppError(400, '賀卡資料有誤。');
  return { message, dueAt, contactId: input.contactId, cardId: input.cardId || null };
}
export function retryDelay(attempts: number) { return Math.min(3600000, 60000 * 2 ** Math.max(0, attempts - 1)); }
export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function sha256(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:new TextEncoder().encode(salt), iterations:100000}, key, 256);
  return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function verifyLineSignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return safeEqual(btoa(String.fromCharCode(...bytes)), signature);
}
