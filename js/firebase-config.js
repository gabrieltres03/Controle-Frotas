const firebaseConfig = {
  apiKey: "AIzaSyDJGIoGG8jwcRyr9z-ss31fBndPzCdeses",
  authDomain: "controle-frotas-1896b.firebaseapp.com",
  projectId: "controle-frotas-1896b",
  storageBucket: "controle-frotas-1896b.firebasestorage.app",
  messagingSenderId: "182413985429",
  appId: "1:182413985429:web:e301573e6d415d0df0bd9c",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch((erro) => {
  console.warn("Persistência offline não disponível:", erro.code);
});