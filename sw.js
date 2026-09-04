
const CACHE_NAME = "frota-cache-v7";


const ARQUIVOS_APP = [
  "./",
  "./index.html",
  "./admin.html",
  "./admin-caminhoes.html",
  "./admin-despesas.html",
  "./admin-estoque.html",
  "./admin-motoristas.html",
  "./admin-movimentacoes.html",
  "./admin-pneus.html",
  "./admin-relatorios.html",
  "./admin-tipos-lancamento.html",
  "./motorista.html",
  "./manifest.json",
  "./css/estilos.css",
  "./css/admin.css",
  "./css/admin-comum.css",
  "./css/mapa-pneus.css",
  "./css/motorista.css",
  "./js/firebase-config.js",
  "./js/auth.js",
  "./js/utilitarios.js",
  "./js/login.js",
  "./js/termos.js",
  "./js/admin.js",
  "./js/admin-caminhoes.js",
  "./js/admin-despesas.js",
  "./js/admin-estoque.js",
  "./js/admin-motoristas.js",
  "./js/admin-movimentacoes.js",
  "./js/admin-pneus.js",
  "./js/admin-relatorios.js",
  "./js/admin-tipos-lancamento.js",
  "./js/motorista.js",
  "./js/registrar-sw.js",
  "./assets/logo.png",
  "./assets/icone-192.png",
  "./assets/icone-512.png",
  "./assets/icone-email.png",
  "./assets/icone-instagram.png",
  "./assets/icone-whatsapp.png",
];

const ARQUIVOS_CDN = [
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
];

// Domínios do Firebase que precisam sempre ir direto pra rede (dados ao vivo,
// nunca servir do cache) — login e leitura/escrita no Firestore.
const DOMINIOS_SEMPRE_REDE = [
  "firestore.googleapis.com",
  "firebaseio.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(ARQUIVOS_APP);
      await Promise.all(ARQUIVOS_CDN.map((url) => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  const ehApiDoFirebase = DOMINIOS_SEMPRE_REDE.some((d) => url.hostname.includes(d));

  if (evento.request.method !== "GET" || ehApiDoFirebase) {
    return; // deixa passar direto pra rede, sem mexer
  }

  evento.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const doCache = await cache.match(evento.request);
      const daRede = fetch(evento.request)
        .then((resposta) => {
          if (resposta && resposta.ok) cache.put(evento.request, resposta.clone());
          return resposta;
        })
        .catch(() => null);
      return doCache || (await daRede) || new Response("Sem conexão", { status: 503 });
    })
  );
});
