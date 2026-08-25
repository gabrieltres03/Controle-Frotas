const DOMINIO_AUTH = "controle-frota.tresbusiness.com.br";

async function buscarMotoristasAtivos() {
  const snapshot = await db.collection("motoristas").where("ativo", "==", true).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function emailSintetico(login, pin) {
  return `${login}#${pin}@${DOMINIO_AUTH}`.toLowerCase();
}

async function autenticarMotorista(motoristaId, pin) {
  try {
    const email = emailSintetico(motoristaId, pin);
    await auth.signInWithEmailAndPassword(email, `pin${pin}senha`);
    localStorage.setItem("frota_perfil", "motorista");
    localStorage.setItem("frota_motorista_id", motoristaId);
    window.location.href = "motorista.html";
  } catch (erro) {
    console.error("Falha no login do motorista:", erro.code);
    mostrarErroPin("PIN incorreto");
  }
}

async function autenticarAdmin(pin) {
  try {
    const email = emailSintetico("admin", pin);
    await auth.signInWithEmailAndPassword(email, `pin${pin}senha`);
    localStorage.setItem("frota_perfil", "admin");
    window.location.href = "admin.html";
  } catch (erro) {
    console.error("Falha no login do admin:", erro.code);
    mostrarErroPin("PIN incorreto");
  }
}
