const CACHE_NAME = 'seamx-shell-20260928-v3';

const CORE_ASSETS = [
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


/* =========================================================
   INSTALACION
   ========================================================= */

self.addEventListener('install', event => {

  event.waitUntil((async () => {

    const cache = await caches.open(CACHE_NAME);

    await Promise.allSettled(

      CORE_ASSETS.map(async url => {

        try {

          const response = await fetch(
            url,
            {
              mode: url.startsWith('http')
                ? 'cors'
                : 'same-origin',

              cache: 'no-store'
            }
          );

          if (
            response.ok ||
            response.type === 'opaque'
          ) {

            await cache.put(
              url,
              response.clone()
            );

          }

        } catch (_) {}

      })

    );

    await self.skipWaiting();

  })());

});


/* =========================================================
   ACTIVACION
   ELIMINA CACHE ANTIGUO
   ========================================================= */

self.addEventListener('activate', event => {

  event.waitUntil((async () => {

    const keys = await caches.keys();

    await Promise.all(

      keys
        .filter(cacheName => {

          return (
            cacheName.startsWith('seamx-shell-') &&
            cacheName !== CACHE_NAME
          );

        })

        .map(cacheName =>
          caches.delete(cacheName)
        )

    );

    await self.clients.claim();

  })());

});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener('fetch', event => {

  if (
    event.request.method !== 'GET'
  ) {
    return;
  }


  const requestUrl =
    new URL(event.request.url);


  /* =======================================================
     SUPABASE
     SIEMPRE ONLINE
     NO CACHEAR DATOS OPERATIVOS
     ======================================================= */

  if (
    requestUrl.hostname.includes(
      'supabase.co'
    )
  ) {

    event.respondWith(
      fetch(
        event.request,
        {
          cache: 'no-store'
        }
      )
    );

    return;

  }


  /* =======================================================
     NETLIFY / INDEX PRINCIPAL
     NETWORK FIRST
     ======================================================= */

  if (
    event.request.mode === 'navigate'
  ) {

    event.respondWith((async () => {

      const cache =
        await caches.open(CACHE_NAME);


      try {

        const networkResponse =
          await fetch(
            event.request,
            {
              cache: 'no-store'
            }
          );


        if (
          networkResponse.ok
        ) {

          await cache.put(
            './index.html',
            networkResponse.clone()
          );

        }


        return networkResponse;


      } catch (_) {


        const cachedIndex =
          await cache.match(
            './index.html'
          );


        if (cachedIndex) {
          return cachedIndex;
        }


        const cachedRoot =
          await cache.match('./');


        if (cachedRoot) {
          return cachedRoot;
        }


        return new Response(
          'SEAMX no tiene conexión y no existe una versión offline disponible.',
          {
            status: 503,
            headers: {
              'Content-Type':
                'text/plain; charset=utf-8'
            }
          }
        );

      }

    })());

    return;

  }


  /* =======================================================
     ARCHIVOS DEL MISMO DOMINIO
     STALE WHILE REVALIDATE
     ======================================================= */

  if (
    requestUrl.origin ===
    self.location.origin
  ) {

    event.respondWith((async () => {

      const cache =
        await caches.open(CACHE_NAME);


      const cached =
        await cache.match(
          event.request
        );


      const networkPromise =

        fetch(
          event.request,
          {
            cache: 'no-cache'
          }
        )

          .then(async response => {

            if (
              response.ok
            ) {

              await cache.put(
                event.request,
                response.clone()
              );

            }

            return response;

          })

          .catch(() => null);


      if (cached) {

        event.waitUntil(
          networkPromise
        );

        return cached;

      }


      const network =
        await networkPromise;


      if (network) {
        return network;
      }


      return Response.error();

    })());

    return;

  }


  /* =======================================================
     CDN / RECURSOS EXTERNOS
     CACHE FIRST
     ======================================================= */

  event.respondWith((async () => {

    const cache =
      await caches.open(CACHE_NAME);


    const cached =
      await cache.match(
        event.request
      );


    if (cached) {
      return cached;
    }


    try {

      const network =
        await fetch(
          event.request
        );


      if (
        network.ok ||
        network.type === 'opaque'
      ) {

        await cache.put(
          event.request,
          network.clone()
        );

      }


      return network;


    } catch (_) {

      return Response.error();

    }

  })());

});
