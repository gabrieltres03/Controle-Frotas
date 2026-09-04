let tiposCache = [];
let jaSemeou = false;

ativarCapitalizacaoAutomatica(document.getElementById("campoNomeTipo"));

db.collection("tipos_lancamento").orderBy("nome").onSnapshot(
  async (snapshot) => {
    if (snapshot.empty && !jaSemeou) {
      jaSemeou = true;
      const lote = db.batch();
      ["Diesel", "Gasolina", "Álcool"].forEach((nome) => {
        lote.set(db.collection("tipos_lancamento").doc(), { nome, ativo: true, combustivel: true });
      });
      await lote.commit();
      return;
    }
    tiposCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderizarLista();
  },
  (erro) => {
    document.getElementById("listaTipos").innerHTML = '<p class="vazio">Erro: ' + erro.message + "</p>";
  }
);

function renderizarLista() {
  const container = document.getElementById("listaTipos");
  if (tiposCache.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhum tipo extra cadastrado ainda. Toque no + pra criar (ex: Arla 32).</p>';
    return;
  }
  container.innerHTML = tiposCache
    .map(
      (t) => `
      <div class="item-lista">
        <div class="item-lista-info">
          <span class="item-lista-titulo">${t.nome}</span>
          <span class="item-lista-sub">${t.combustivel !== false ? "Conta pra média km/L" : "Não conta pra média"}</span>
        </div>
        <span class="selo ${t.ativo ? "selo-ok" : "selo-neutro"}" style="cursor:pointer" onclick="alternarAtivo('${t.id}', ${!t.ativo})">${t.ativo ? "Ativo" : "Inativo"}</span>
      </div>`
    )
    .join("");
}

function abrirFormulario() {
  document.getElementById("campoNomeTipo").value = "";
  document.getElementById("campoEhCombustivel").checked = true;
  document.getElementById("folhaTipo").classList.add("aberta");
}

function fecharFormulario() {
  document.getElementById("folhaTipo").classList.remove("aberta");
}

async function salvarTipo() {
  const nome = document.getElementById("campoNomeTipo").value.trim();
  const combustivel = document.getElementById("campoEhCombustivel").checked;
  if (!nome) {
    avisar("Atenção", "Informe o nome do tipo de despesa");
    return;
  }
  try {
    await db.collection("tipos_lancamento").add({ nome, ativo: true, combustivel });
    fecharFormulario();
  } catch (erro) {
    avisar("Erro ao salvar", erro.message);
  }
}

async function alternarAtivo(id, novoValor) {
  await db.collection("tipos_lancamento").doc(id).update({ ativo: novoValor });
}