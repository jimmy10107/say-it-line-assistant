import { pbkdf2Sync, randomBytes } from 'node:crypto';
import readline from 'node:readline';
if (!process.stdin.isTTY) throw new Error('請在互動終端機中執行，密碼不會顯示。');
process.stdout.write('設定登入密碼（至少 12 個字元）：');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
let password = '';
process.stdin.on('keypress', (_, key) => {
  if (key.ctrl && key.name === 'c') process.exit(1);
  if (key.name === 'return') {
    process.stdin.setRawMode(false); process.stdin.pause();
    if (password.length < 12) { console.error('\n密碼太短，請重新執行。'); process.exit(1); }
    const salt = randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    console.log('\n將以下兩個值設為 Worker secrets（不是原始密碼）：\nPASSWORD_SALT='+salt+'\nPASSWORD_HASH='+hash);
    process.exit(0);
  }
  if (key.name === 'backspace') password = password.slice(0, -1);
  else if (!key.ctrl && !key.meta && _) password += _;
});
