let itensCache = [];
let abaAtiva = "pneu";

ativarMaiusculasAutomaticas(document.getElementById("campoCodigo"));
ativarCapitalizacaoAutomatica(document.getElementById("campoMarca"));
ativarCapitalizacaoAutomatica(document.getElementById("campoObs"));

document.getElementById("campoTipo").addEventListener("change", (e) => {
  const ehPneu = e.target.value === "pneu";
  document.getElementById("blocoMarca").style.display = ehPneu ? "block" : "none";
  document.getElementById("blocoRodagem").style.display = ehPneu ? "block" : "none";
});

db.collection("itens").where("status", "==", "estoque").onSnapshot(
  (snapshot) => {
    itensCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((i) => (i.quantidade ?? 1) > 0);
    renderizarLista();
  },
  (erro) => {
    document.getElementById("listaEstoque").innerHTML = '<p class="vazio">Erro: ' + erro.message + "</p>";
  }
);

function mudarAba(tipo) {
  abaAtiva = tipo;
  document.querySelectorAll(".aba-perfil").forEach((a) => a.classList.toggle("ativa", a.dataset.tipo === tipo));
  renderizarLista();
}

function renderizarLista() {
  const termo = document.getElementById("busca").value.toLowerCase();
  const filtrados = itensCache.filter((i) => i.tipo === abaAtiva && i.codigo.toLowerCase().includes(termo));
  const container = document.getElementById("listaEstoque");

  if (filtrados.length === 0) {
    container.innerHTML = '<p class="vazio">Nada parado no estoque nessa categoria.</p>';
    return;
  }

  container.innerHTML = filtrados
    .map((i) => {
      const detalhe = i.tipo === "pneu" ? `${i.marca || "sem marca"} · ${rotuloTipoPneu(i.tipo_pneu)}` : i.observacoes || "—";
      return `
        <div class="item-lista">
          <div class="item-lista-info">
            <span class="item-lista-titulo">${i.codigo}</span>
            <span class="item-lista-sub">${detalhe} · ${i.quantidade ?? 1} disponível${(i.quantidade ?? 1) > 1 ? "eis" : ""}</span>
          </div>
          <button class="botao-perigo" style="height:36px; padding:0 12px; font-size:12px" onclick="removerDoEstoque('${i.id}')">Remover</button>
        </div>`;
    })
    .join("");
}

function rotuloTipoPneu(tipo) {
  return { liso: "Liso", misto: "Misto", borrachudo: "Borrachudo" }[tipo] || "—";
}

function filtrarLista() {
  renderizarLista();
}

function abrirFormulario() {
  document.getElementById("campoTipo").value = abaAtiva;
  document.getElementById("campoTipo").dispatchEvent(new Event("change"));
  document.getElementById("campoCodigo").value = "";
  document.getElementById("campoQuantidade").value = 1;
  document.getElementById("campoMarca").value = "";
  document.getElementById("campoObs").value = "";
  document.getElementById("folhaItem").classList.add("aberta");
}

function fecharFormulario() {
  document.getElementById("folhaItem").classList.remove("aberta");
}

async function salvarItem() {
  const tipo = document.getElementById("campoTipo").value;
  const codigo = document.getElementById("campoCodigo").value.trim();
  const quantidade = Number(document.getElementById("campoQuantidade").value) || 1;
  const marca = document.getElementById("campoMarca").value.trim();
  const tipoPneu = document.getElementById("campoTipoRodagem").value;
  const observacoes = document.getElementById("campoObs").value.trim();

  if (!codigo) {
    avisar("Atenção", "Informe o código do item");
    return;
  }

  const dados = {
    tipo,
    codigo,
    quantidade,
    status: "estoque",
    caminhao_atual: null,
    posicao: null,
    km_acumulado: 0,
    observacoes,
    criado_em: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (tipo === "pneu") {
    dados.marca = marca;
    dados.tipo_pneu = tipoPneu;
  }

  try {
    await db.collection("itens").add(dados);
    fecharFormulario();
  } catch (erro) {
    avisar("Erro ao salvar", erro.message);
  }
}

async function removerDoEstoque(id) {
  const confirmou = await confirmarAcao({
    titulo: "Remover do estoque",
    mensagem: "Remove esse lote definitivamente do estoque (descarte). Não dá pra desfazer.",
    textoConfirmar: "Remover",
  });
  if (!confirmou) return;
  await db.collection("itens").doc(id).update({ status: "descartado", quantidade: 0 });
}
