const CACHE_NAME='seamx-shell-current-ops';

const CORE_ASSETS=[
  './',
  './index.html',
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

    const cache=
      await caches.open(CACHE_NAME);

    await Promise.allSettled(

      CORE_ASSETS.map(async url=>{

        try{

          const response=
            await fetch(
              url,
              {
                mode:
                  url.startsWith('http')
                    ? 'cors'
                    : 'same-origin',

                cache:'no-cache'
              }
            );

          if(
            response.ok ||
            response.type==='opaque'
          ){

            await cache.put(
              url,
              response.clone()
            );

          }

        }catch(_){

          /* Recurso opcional */

        }

      })

    );

    await self.skipWaiting();

  })());

});


self.addEventListener('activate',event=>{

  event.waitUntil((async()=>{

    const keys=
      await caches.keys();

    await Promise.all(

      keys
        .filter(
          key=>
            key.startsWith('seamx-shell-') &&
            key!==CACHE_NAME
        )
        .map(
          key=>caches.delete(key)
        )

    );

    await self.clients.claim();

  })());

});


self.addEventListener('fetch',event=>{

  if(event.request.method!=='GET'){
    return;
  }

  const requestUrl=
    new URL(event.request.url);


  /*
   * Supabase siempre trabaja con datos actuales.
   * No se almacenan sus respuestas en caché.
   */
  if(
    requestUrl.origin.includes('supabase.co')
  ){
    return;
  }


  event.respondWith((async()=>{

    const cache=
      await caches.open(CACHE_NAME);


    /*
     * index.html:
     * primero intenta cargar la versión publicada.
     * Si no existe conexión utiliza la copia offline.
     */
    if(
      event.request.mode==='navigate'
    ){

      try{

        const network=
          await fetch(
            event.request,
            {
              cache:'no-cache'
            }
          );

        if(network.ok){

          await cache.put(
            './index.html',
            network.clone()
          );

        }

        return network;

      }catch(_){

        return (
          (await cache.match('./index.html')) ||
          (await cache.match('./')) ||
          Response.error()
        );

      }

    }


    /*
     * Recursos estáticos.
     */
    const cached=
      await cache.match(event.request);


    if(cached){

      event.waitUntil(

        fetch(event.request)

          .then(response=>{

            if(
              response.ok ||
              response.type==='opaque'
            ){

              return cache.put(
                event.request,
                response.clone()
              );

            }

          })

          .catch(()=>{})

      );

      return cached;

    }


    /*
     * Recurso todavía no almacenado.
     */
    try{

      const network=
        await fetch(event.request);

      if(
        network.ok ||
        network.type==='opaque'
      ){

        await cache.put(
          event.request,
          network.clone()
        );

      }

      return network;

    }catch(_){

      return Response.error();

    }

  })());

});
