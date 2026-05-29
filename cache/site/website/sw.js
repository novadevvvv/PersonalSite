const CACHE_NAME = "personal-site-single-page-v1";
const PRECACHE_URLS = [
	"/",
	"/index.html",
	"/api.json",
	"/CNAME",
	"/comingSoon.jpg",
	"/favicon.svg",
	"/projects.html",
	"/projects.json",
	"/watch.html",
	"/apis/index.html",
	"/apis/recauth/1/index.html",
	"/apis/recconnect/1/index.html",
	"/apis/recconnect/2/index.html",
	"/assets/css/site.css",
	"/assets/css/single-page.css",
	"/assets/images/recroom/breakthroughopenbeta.jpg",
	"/assets/images/recroom/dbs-breakthrough.jpg",
	"/assets/images/spirenetwork/banner.jpg",
	"/assets/js/api-data.js",
	"/assets/js/api-endpoint-page.js",
	"/assets/js/apis-page.js",
	"/assets/js/availability-banner.js",
	"/assets/js/components.js",
	"/assets/js/galaxy-effects.js",
	"/assets/js/index-page.js",
	"/assets/js/projects-data.js",
	"/assets/js/projects-page.js",
	"/assets/js/single-page.js",
	"/assets/js/utils.js",
	"/home/index.html",
	"/project/7069854669103207958/stats/index.html",
	"/project/8947998229867728285/stats/index.html",
	"/redirect/index.html",
	"/skidchecker/.nojekyll",
	"/skidchecker/app.js",
	"/skidchecker/browser-scan.js",
	"/skidchecker/config.js",
	"/skidchecker/index.html",
	"/skidchecker/styles.css",
	"/tip/index.html",
	"/watch/font.ttf",
	"/watch/index.html",
	"/watch/components/js/config.js",
	"/watch/components/js/main.js",
	"/watch/components/js/components/download-options-panel.js",
	"/watch/components/js/components/loading-indicator.js",
	"/watch/components/js/components/spiral-renderer.js",
	"/watch/components/js/components/video-metadata-panel.js",
	"/watch/components/styles/app.css"
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key))
			)
		).then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) {
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(caches.match("/index.html").then((cachedPage) => cachedPage || fetch(request)));
		return;
	}

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			return fetch(request).then((networkResponse) => {
				if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
					return networkResponse;
				}

				const responseToCache = networkResponse.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
				return networkResponse;
			});
		})
	);
});