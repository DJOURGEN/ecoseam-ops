const CACHE_NAME='seamx-shell-v32';
const CORE_ASSETS=[
  './',
  './logo-ecoseam.png',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(async url=>{
      try{const response=await fetch(url,{mode:url.startsWith('http')?'cors':'same-origin'});if(response.ok||response.type==='opaque')await cache.put(url,response.clone());}catch(_){/* recurso opcional */}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(event.request,{ignoreSearch:false});
    try{
      const network=await fetch(event.request);
      if(network.ok||network.type==='opaque')cache.put(event.request,network.clone());
      return network;
    }catch(_){
      if(cached)return cached;
      if(event.request.mode==='navigate'){
        return (await cache.match(event.request))||(await cache.match('./'))||Response.error();
      }
      return Response.error();
    }
  })());
});
