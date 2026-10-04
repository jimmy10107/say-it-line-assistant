import readline from 'node:readline';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(project);
if(!process.stdin.isTTY)throw new Error('請使用互動終端機執行此設定。');
readline.emitKeypressEvents(process.stdin);
async function hidden(prompt){
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise(resolve=>{let value='';const listener=(text,key)=>{
  if(key.ctrl&&key.name==='c'){process.stdin.setRawMode(false);process.exit(1);}
  if(key.name==='return'){process.stdin.removeListener('keypress',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write(' 已輸入\n');resolve(value.trim());}
  else if(key.name==='backspace')value=value.slice(0,-1);
  else if(!key.ctrl&&!key.meta&&text)value+=text;
 };process.stdin.on('keypress',listener);});
}
console.log('說一聲 · 私人服務設定\n所有輸入都不顯示，也不寫入檔案、聊天或 GitHub。\n完成後只傳送到你的 Cloudflare Worker Secrets。按 Ctrl+C 可取消。\n');
const origin=process.argv[2];
if(!origin||!/^https:\/\/[a-z0-9.-]+$/.test(origin))throw new Error('請提供正式 HTTPS Worker 網址，末尾不要加斜線。');
let password='';while(password.length<12){password=await hidden('1. 設定 App 登入密碼（至少 12 個字元）：');if(password.length<12)console.log('密碼太短，請重新輸入。');}
const confirmation=await hidden('   再輸入一次密碼：');
if(password!==confirmation)throw new Error('兩次密碼不同，請重新執行。');
const gemini=await hidden('2. 貼上 Gemini API key：');
const lineSecret=await hidden('3. 貼上 LINE Channel Secret：');
const lineToken=await hidden('4. 貼上 LINE Channel Access Token：');
if(!gemini||!lineSecret||!lineToken)throw new Error('尚有空白值，請重新執行。');
const salt=randomBytes(32).toString('hex');
const secrets={PASSWORD_SALT:salt,PASSWORD_HASH:pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex'),GEMINI_API_KEY:gemini,LINE_CHANNEL_SECRET:lineSecret,LINE_CHANNEL_ACCESS_TOKEN:lineToken,PUBLIC_ORIGIN:origin};
console.log('\n正在安全地設定 Cloudflare Secrets…');
const result=spawnSync(process.execPath,[path.join(project,'node_modules/wrangler/bin/wrangler.js'),'secret','bulk'],{input:JSON.stringify(secrets),encoding:'utf8',cwd:project,windowsHide:true});
mkdirSync('.wrangler',{recursive:true});
writeFileSync('.wrangler/setup-result.json',JSON.stringify({success:result.status===0,completedAt:new Date().toISOString()}));
if(result.status!==0){console.error('設定失敗。請確認 Cloudflare 已授權、Worker 已部署，並重新執行。金鑰不會顯示。');process.exitCode=1;}
else console.log('設定完成。可回到 Codex 繼續驗證。\n正式 App：'+origin+'\nLINE Webhook：'+origin+'/api/line/webhook');
