let cachePdfAdmin = {};

db.collection("motoristas").orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("filtroMotoristaDespesas");
  const atual = select.value;
  select.innerHTML = '<option value="">Todos</option>';
  snapshot.docs.forEach((doc) => {
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = doc.data().nome;
    select.appendChild(opcao);
  });
  select.value = atual;
});

db.collection("caminhoes").where("ativo", "==", true).orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("filtroCaminhaoDespesas");
  const atual = select.value;
  select.innerHTML = '<option value="">Todos</option>';
  snapshot.docs.forEach((doc) => {
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = `${doc.id} — ${doc.data().nome || ""}`;
    select.appendChild(opcao);
  });
  select.value = atual;
});

function inicioDoDia(dataStr) {
  return firebase.firestore.Timestamp.fromDate(new Date(dataStr + "T00:00:00"));
}
function fimDoDia(dataStr) {
  return firebase.firestore.Timestamp.fromDate(new Date(dataStr + "T23:59:59"));
}

// Busca só por data no Firestore (não precisa de índice composto) e filtra
// caminhão/motorista aqui mesmo — assim qualquer combinação de filtro funciona
// sem precisar criar índice novo a cada campo que a gente adicionar.
async function buscarEFiltrar(colecao, motoristaId, caminhaoId, dataInicio, dataFim) {
  let consulta = db.collection(colecao).orderBy("data", "desc");
  if (dataInicio) consulta = consulta.where("data", ">=", inicioDoDia(dataInicio));
  if (dataFim) consulta = consulta.where("data", "<=", fimDoDia(dataFim));

  const limite = dataInicio || dataFim ? 300 : 150;
  const snapshot = await consulta.limit(limite).get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => (!motoristaId || item.motorista_id === motoristaId) && (!caminhaoId || item.caminhao === caminhaoId));
}

async function filtrarDespesas() {
  const motoristaId = document.getElementById("filtroMotoristaDespesas").value;
  const caminhaoId = document.getElementById("filtroCaminhaoDespesas").value;
  const dataInicio = document.getElementById("filtroDataInicio").value;
  const dataFim = document.getElementById("filtroDataFim").value;

  document.getElementById("listaAbastecimentosAdmin").innerHTML = '<p class="carregando">Buscando...</p>';
  document.getElementById("listaDespesasAdmin").innerHTML = '<p class="carregando">Buscando...</p>';

  try {
    const abastecimentos = await buscarEFiltrar("abastecimentos", motoristaId, caminhaoId, dataInicio, dataFim);
    renderizarAbastecimentosAdmin(abastecimentos);
  } catch (erro) {
    document.getElementById("listaAbastecimentosAdmin").innerHTML = '<p class="vazio">Erro: ' + erro.message + "</p>";
  }

  try {
    const despesas = await buscarEFiltrar("despesas", motoristaId, caminhaoId, dataInicio, dataFim);
    renderizarDespesasAdmin(despesas);
  } catch (erro) {
    document.getElementById("listaDespesasAdmin").innerHTML = '<p class="vazio">Erro: ' + erro.message + "</p>";
  }
}

function rotuloRefeicaoAdmin(r) {
  return { almoco: "Almoço", janta: "Janta", lanche: "Lanche" }[r] || r || "";
}

function renderizarAbastecimentosAdmin(itens) {
  const container = document.getElementById("listaAbastecimentosAdmin");
  if (itens.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhum abastecimento encontrado.</p>';
    return;
  }
  container.innerHTML = itens
    .map((a) => {
      cachePdfAdmin[a.id] = a.nota_pdf;
      const data = a.data ? a.data.toDate().toLocaleDateString("pt-BR") : "";
      return `
        <div class="item-lista">
          <div class="item-lista-info">
            <span class="item-lista-titulo">${a.motorista_id || "—"} · ${a.litros} L · R$ ${Number(a.valor).toFixed(2)}</span>
            <span class="item-lista-sub">${a.caminhao || "—"} · ${data} · ${(a.km_atual || 0).toLocaleString("pt-BR")} km</span>
          </div>
          <div style="display:flex; gap:6px">
            ${a.nota_pdf ? `<button class="botao-linha" style="height:32px; padding:0 10px; font-size:12px" onclick="abrirPdfBase64(cachePdfAdmin['${a.id}'], 'nota-${a.id}.pdf')">ver nota</button>` : ""}
            <button class="botao-perigo" style="height:32px; padding:0 10px; font-size:12px" onclick="apagarLancamento('abastecimentos', '${a.id}')">apagar</button>
          </div>
        </div>`;
    })
    .join("");
}

function renderizarDespesasAdmin(itens) {
  const container = document.getElementById("listaDespesasAdmin");
  if (itens.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma despesa encontrada.</p>';
    return;
  }
  container.innerHTML = itens
    .map((d) => {
      cachePdfAdmin[d.id] = d.ticket_pdf;
      const data = d.data ? d.data.toDate().toLocaleDateString("pt-BR") : "";
      const obs = d.observacao ? ` · obs: ${d.observacao}` : "";
      const titulo = d.tipo === "alimentacao" ? rotuloRefeicaoAdmin(d.refeicao) : d.categoria || "Outra despesa";
      const sub = d.tipo === "alimentacao" ? `${d.restaurante || "—"} · ${d.local || "—"} · ${data}${obs}` : `${d.caminhao || "—"} · ${data}${obs}`;
      return `
        <div class="item-lista">
          <div class="item-lista-info">
            <span class="item-lista-titulo">${d.motorista_id || "—"} · ${titulo} · R$ ${Number(d.valor).toFixed(2)}</span>
            <span class="item-lista-sub">${sub}</span>
          </div>
          <div style="display:flex; gap:6px">
            ${d.ticket_pdf ? `<button class="botao-linha" style="height:32px; padding:0 10px; font-size:12px" onclick="abrirPdfBase64(cachePdfAdmin['${d.id}'], 'ticket-${d.id}.pdf')">ver ticket</button>` : ""}
            <button class="botao-perigo" style="height:32px; padding:0 10px; font-size:12px" onclick="apagarLancamento('despesas', '${d.id}')">apagar</button>
          </div>
        </div>`;
    })
    .join("");
}

async function apagarLancamento(colecao, id) {
  const confirmou = await confirmarAcao({
    titulo: "Apagar lançamento",
    mensagem: "Remove esse lançamento e a nota/ticket anexado, sem volta. Confirma?",
    textoConfirmar: "Apagar",
  });
  if (!confirmou) return;
  await db.collection(colecao).doc(id).delete();
  filtrarDespesas();
}