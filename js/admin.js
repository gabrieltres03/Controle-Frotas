auth.onAuthStateChanged((usuario) => {
  const perfilSalvo = localStorage.getItem("frota_perfil");
  if (!usuario || perfilSalvo !== "admin") {
    window.location.href = "index.html";
  }
});

function sair() {
  auth.signOut().finally(() => {
    localStorage.removeItem("frota_perfil");
    window.location.href = "index.html";
  });
}
