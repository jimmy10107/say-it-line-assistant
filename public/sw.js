// Only cache the app shell. Private APIs, tokens, LINE contacts and cards are never cached.
const CACHE='say-it-shell-v1';
const SHELL=['./','./style.css','./app.js','./live.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/')||url.pathname.includes('/media/'))return;
 if(!SHELL.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
