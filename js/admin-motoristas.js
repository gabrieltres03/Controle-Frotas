let motoristasCache = [];
let motoristaEmEdicao = null;

ativarCapitalizacaoAutomatica(document.getElementById("campoNome"));

const appSecundario = firebase.initializeApp(firebaseConfig, "secundario");
const authSecundario = appSecundario.auth();

db.collection("motoristas").orderBy("nome").onSnapshot(
  (snapshot) => {
    motoristasCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderizarLista(motoristasCache);
  },
  (erro) => {
    document.getElementById("listaMotoristas").innerHTML = '<p class="vazio">Erro: ' + erro.message + "</p>";
  }
);

db.collection("caminhoes").where("ativo", "==", true).orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("campoCaminhao");
  const atual = select.value;
  select.innerHTML = '<option value="coringa">🃏 Coringa (escolhe o veículo a cada lançamento)</option>';
  snapshot.docs.forEach((doc) => {
    const c = doc.data();
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = `${doc.id} — ${c.nome || ""}`;
    select.appendChild(opcao);
  });
  select.value = atual;
});

function renderizarLista(lista) {
  const container = document.getElementById("listaMotoristas");
  if (lista.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhum motorista cadastrado ainda.</p>';
    return;
  }
  container.innerHTML = lista
    .map(
      (m) => `
        <div class="item-lista" onclick="abrirFormulario('${m.id}')">
          <div class="item-lista-info">
            <span class="item-lista-titulo">${m.nome}</span>
            <span class="item-lista-sub">${!m.caminhao_vinculado || m.caminhao_vinculado === "coringa" ? "🃏 Coringa" : "Vinculado a " + m.caminhao_vinculado}</span>
          </div>
          <span class="selo ${m.ativo ? "selo-ok" : "selo-neutro"}">${m.ativo ? "Ativo" : "Inativo"}</span>
        </div>`
    )
    .join("");
}

function filtrarLista() {
  const termo = document.getElementById("busca").value.toLowerCase();
  renderizarLista(motoristasCache.filter((m) => m.nome.toLowerCase().includes(termo)));
}

function gerarLogin(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function abrirFormulario(id) {
  motoristaEmEdicao = id || null;
  document.getElementById("botaoDesativar").style.display = id ? "block" : "none";
  document.getElementById("linkExcluir").style.display = id ? "block" : "none";
  document.getElementById("blocoPin").style.display = id ? "none" : "block";

  if (id) {
    const m = motoristasCache.find((x) => x.id === id);
    document.getElementById("tituloFolha").textContent = "Editar motorista";
    document.getElementById("campoNome").value = m.nome;
    document.getElementById("campoNome").disabled = true;
    document.getElementById("campoCaminhao").value = m.caminhao_vinculado || "coringa";
  } else {
    document.getElementById("tituloFolha").textContent = "Novo motorista";
    document.getElementById("campoNome").value = "";
    document.getElementById("campoNome").disabled = false;
    document.getElementById("campoPin").value = "";
    document.getElementById("campoCaminhao").value = "coringa";
  }

  document.getElementById("folhaMotorista").classList.add("aberta");
}

function fecharFormulario() {
  document.getElementById("folhaMotorista").classList.remove("aberta");
}

async function salvarMotorista() {
  const nome = document.getElementById("campoNome").value.trim();
  const caminhaoVinculado = document.getElementById("campoCaminhao").value;

  if (!nome) {
    avisar("Atenção", "Informe o nome do motorista");
    return;
  }

  if (motoristaEmEdicao) {
    await db.collection("motoristas").doc(motoristaEmEdicao).update({ caminhao_vinculado: caminhaoVinculado });
    fecharFormulario();
    return;
  }

  const pin = document.getElementById("campoPin").value.trim();
  if (pin.length !== 6) {
    avisar("Atenção", "O PIN precisa ter 6 dígitos");
    return;
  }

  const login = gerarLogin(nome);
  const email = emailSintetico(login, pin);
  const senha = `pin${pin}senha`;

  try {
    await authSecundario.createUserWithEmailAndPassword(email, senha);
    await authSecundario.signOut();
    await db.collection("motoristas").doc(login).set({
      nome,
      caminhao_vinculado: caminhaoVinculado,
      ativo: true,
    });
    fecharFormulario();
  } catch (erro) {
    avisar("Erro ao criar acesso", erro.message);
  }
}

async function desativarMotorista() {
  if (!motoristaEmEdicao) return;
  const confirmou = await confirmarAcao({
    titulo: "Desativar motorista",
    mensagem: "Desativar o acesso deste motorista? Ele continua cadastrado, só perde o acesso.",
    textoConfirmar: "Desativar",
  });
  if (!confirmou) return;
  await db.collection("motoristas").doc(motoristaEmEdicao).update({ ativo: false });
  fecharFormulario();
}

function excluirMotorista() {
  document.getElementById("nomeParaExcluir").textContent = document.getElementById("campoNome").value;
  document.getElementById("pinExclusao").value = "";
  document.getElementById("erroExclusao").textContent = "";
  document.getElementById("folhaExcluir").classList.add("aberta");
}

function fecharFolhaExcluir() {
  document.getElementById("folhaExcluir").classList.remove("aberta");
}

async function confirmarExclusao() {
  const pin = document.getElementById("pinExclusao").value.trim();
  const erro = document.getElementById("erroExclusao");

  if (pin.length !== 6) {
    erro.textContent = "O PIN precisa ter 6 dígitos";
    return;
  }

  const email = emailSintetico(motoristaEmEdicao, pin);
  const senha = `pin${pin}senha`;

  try {
    await authSecundario.signInWithEmailAndPassword(email, senha);
    await authSecundario.currentUser.delete();
    await db.collection("motoristas").doc(motoristaEmEdicao).delete();
    fecharFolhaExcluir();
    fecharFormulario();
  } catch (erroAuth) {
    erro.textContent = "PIN incorreto ou motorista não encontrado no login";
  }
}