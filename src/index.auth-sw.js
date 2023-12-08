/**
 * Bytescale Auth Service Worker (SW)
 *
 * What is this?
 * ------------
 * This script is designed to be imported into a 'service worker' that's included in a top-level script on the user's
 * web application's domain. This script intercepts FETCH requests to add JWTs (issued by the user's application) to
 * Bytescale CDN requests via the 'Authorization-Token' request header. This allows the Bytescale CDN to authorize
 * requests using 'Authorization-Token' headers as opposed to cookies, which are blocked by some browsers (including Safari).
 *
 * Installation
 * ------------
 * 1. The user must add a root-level script to their application, under their web application's domain, that includes:
 *    importScripts("https://js.bytescale.com/auth-sw/v1");
 * 2. This script MUST be hosted on the _exact domain_ your website is running on; you cannot host it from a different (sub)domain.
 *    Explanation: service workers cannot be added cross-domain. This is a restriction of the service worker API.
 * 3. This script MUST be hosted in the root folder (e.g. '/bytescale-auth-sw.js' and not '/scripts/bytescale-auth-sw.js')
 *    Explanation: service workers can only intercept HTTP requests from pages that are at the same level as, or lower than, the script's path.
 * 4. Add the 'serviceWorkerPath' field to the 'beginAuthSession' method call in your code, specifying the path to this script.
 */
let config; // {cdnUrl, apiKey, jwt?}

console.log(`[bytescale] Auth service worker registered.`);

/* eslint-disable no-undef */
self.addEventListener("install", function (event) {
  event.waitUntil(
    self.skipWaiting() // Immediately use the new version of the service worker (instead of requiring a page refresh) if the browser already has an old version of the service worker installed.
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    self.clients.claim() // Immediately allow the service worker to intercept "fetch" events (instead of requiring a page refresh) if this is the first time this service worker is being installed.
  );
});

self.addEventListener("message", event => {
  // Allows communication with the windows/tabs that have are able to generate the JWT (as they have the auth session with the user's API).
  if (event.data) {
    switch (event.data.type) {
      case "SET_CONFIG":
        // Auth sessions are started/ended by calling SET_CONFIG with auth config or with 'undefined' config, respectively.
        // We use 'undefined' to end the auth session instead of unregistering the worker, as there may be multiple tabs
        // in the user's application, so while the user may sign out in one tab, they may remain signed in to another tab,
        // which may subsequently send a follow-up 'SET_CONFIG' which will resume auth.
        config = event.data.config;
        break;
    }
  }
});

self.addEventListener("fetch", function (event) {
  const url = event.request.url;

  if (config !== undefined && url.startsWith(`${config.cdnUrl}/`) && event.request.method.toUpperCase() === "GET") {
    const newHeaders = new Headers(event.request.headers);

    // If clients want to authorize using JWTs, they should always provide both in the SET_CONFIG call, and not perform
    // one SET_CONFIG call with only the API key, followed by another with the JWT, as this will cause the service worker
    // to assume they want to use API-key only auth initially.
    newHeaders.append("Authorization", `Bearer ${config.apiKey}`);
    if (config.jwt !== undefined) {
      newHeaders.append("Authorization-Token", config.jwt);
    }

    const newRequest = new Request(event.request, {
      mode: "cors",
      headers: newHeaders
    });

    event.respondWith(fetch(newRequest));
  }
});
