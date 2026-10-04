import { readdir, copyFile, writeFile } from 'node:fs/promises';
for(const file of await readdir('public')) await copyFile('public/'+file,'docs/'+file);
await writeFile('docs/.nojekyll','');
console.log('GitHub Pages 示範版已更新。');
