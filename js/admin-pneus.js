let caminhaoAtual = null;
let itensDoCaminhao = {};
let cancelarOuvinteItens = null;
let slotAberto = null;

db.collection("caminhoes").where("ativo", "==", true).orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("selectCaminhao");
  const atual = select.value;
  select.innerHTML = '<option value="">Selecione um caminhão</option>';
  snapshot.docs.forEach((doc) => {
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = `${doc.id} — ${doc.data().nome || ""}`;
    select.appendChild(opcao);
  });
  if (atual) select.value = atual;
});

function gerarPosicoes(eixos) {
  const posicoes = [];
  eixos.forEach((eixo, i) => {
    const n = i + 1;
    if (eixo.rodado === "duplo") {
      posicoes.push(
        { chave: `eixo${n}-esq-ext`, rotulo: "Esq. externo", lado: "esq" },
        { chave: `eixo${n}-esq-int`, rotulo: "Esq. interno", lado: "esq" },
        { chave: `eixo${n}-dir-int`, rotulo: "Dir. interno", lado: "dir" },
        { chave: `eixo${n}-dir-ext`, rotulo: "Dir. externo", lado: "dir" }
      );
    } else {
      posicoes.push(
        { chave: `eixo${n}-esq`, rotulo: "Esquerdo", lado: "esq" },
        { chave: `eixo${n}-dir`, rotulo: "Direito", lado: "dir" }
      );
    }
  });
  return posicoes;
}

function rotuloTipoEixo(tipo) {
  return { direcao: "Direção", tracao: "Tração", suspenso: "Suspenso", apoio: "Apoio" }[tipo] || tipo;
}

async function trocarCaminhao(placa) {
  if (cancelarOuvinteItens) cancelarOuvinteItens();
  document.getElementById("mapaEixos").innerHTML = "";
  if (!placa) {
    caminhaoAtual = null;
    return;
  }

  const doc = await db.collection("caminhoes").doc(placa).get();
  caminhaoAtual = { placa, ...doc.data() };

  cancelarOuvinteItens = db.collection("itens").where("caminhao_atual", "==", placa).onSnapshot((snapshot) => {
    itensDoCaminhao = {};
    snapshot.docs.forEach((d) => {
      const item = { id: d.id, ...d.data() };
      itensDoCaminhao[item.posicao] = item;
    });
    renderizarMapa();
  });
}

function kmEstimado(item) {
  const kmInstalacao = item.km_instalacao ?? caminhaoAtual.km_atual;
  return (item.km_acumulado || 0) + Math.max(0, caminhaoAtual.km_atual - kmInstalacao);
}

function renderizarMapa() {
  const eixos = caminhaoAtual.eixos || [];
  const posicoes = gerarPosicoes(eixos);
  const container = document.getElementById("mapaEixos");
  container.innerHTML = "";

  eixos.forEach((eixo, i) => {
    const n = i + 1;
    const doEixo = posicoes.filter((p) => p.chave.startsWith(`eixo${n}-`));
    const esq = doEixo.filter((p) => p.lado === "esq");
    const dir = doEixo.filter((p) => p.lado === "dir");

    const cartao = document.createElement("div");
    cartao.className = "cartao-eixo";
    cartao.innerHTML = `
      <div class="cartao-eixo-titulo">Eixo ${n} · ${rotuloTipoEixo(eixo.tipo)} · rodado ${eixo.rodado}</div>
      <div class="linhas-lados">
        <div class="lado-grupo">${esq.map(renderizarSlot).join("")}</div>
        <div class="lado-grupo">${dir.map(renderizarSlot).join("")}</div>
      </div>
    `;
    container.appendChild(cartao);
  });
}

function renderizarSlot(posicao) {
  const item = itensDoCaminhao[posicao.chave];
  if (!item) {
    return `<button class="slot-pneu vazio" onclick="abrirSlot('${posicao.chave}', '${posicao.rotulo}')">
      <span class="slot-pneu-codigo">${posicao.rotulo}</span>
      <span class="slot-pneu-km">vazio</span>
    </button>`;
  }
  return `<button class="slot-pneu ocupado" onclick="abrirSlot('${posicao.chave}', '${posicao.rotulo}')">
    <span class="slot-pneu-codigo">${item.codigo}</span>
    <span class="slot-pneu-km">${posicao.rotulo} · ${kmEstimado(item).toLocaleString("pt-BR")} km</span>
  </button>`;
}

async function abrirSlot(chave, rotulo) {
  slotAberto = chave;
  const item = itensDoCaminhao[chave];
  document.getElementById("tituloSlot").textContent = rotulo;
  const corpo = document.getElementById("corpoSlot");

  if (!item) {
    const disponiveis = await db.collection("itens").where("tipo", "==", "pneu").where("status", "==", "estoque").get();
    const comEstoque = disponiveis.docs.filter((d) => (d.data().quantidade ?? 1) > 0);
    if (comEstoque.length === 0) {
      corpo.innerHTML = `<p class="vazio">Sem pneus no estoque. Cadastre um em Estoque antes de instalar.</p>`;
    } else {
      const opcoes = comEstoque
        .map((d) => `<option value="${d.id}">${d.data().codigo} — ${d.data().marca || "sem marca"} (${d.data().tipo_pneu || "—"}) · ${d.data().quantidade} disp.</option>`)
        .join("");
      corpo.innerHTML = `
        <div class="campo">
          <label>Pneu do estoque</label>
          <select id="selectInstalar">${opcoes}</select>
        </div>
        <button class="botao-primario" onclick="instalarPneu('${chave}')">Instalar nesta posição</button>
      `;
    }
    document.getElementById("folhaSlot").classList.add("aberta");
    return;
  }

  const outrasOcupadas = Object.keys(itensDoCaminhao).filter((k) => k !== chave);
  const opcoesInversao = outrasOcupadas
    .map((k) => `<option value="${k}">${k} — ${itensDoCaminhao[k].codigo}</option>`)
    .join("");

  corpo.innerHTML = `
    <div class="item-lista" style="box-shadow:none; border:1.5px solid var(--borda)">
      <div class="item-lista-info">
        <span class="item-lista-titulo">${item.codigo}</span>
        <span class="item-lista-sub">${item.marca || "sem marca"} · ${item.tipo_pneu || "—"} · ${kmEstimado(item).toLocaleString("pt-BR")} km rodados</span>
      </div>
    </div>
    ${outrasOcupadas.length > 0 ? `
      <div class="campo">
        <label>Inverter com</label>
        <select id="selectInversao">${opcoesInversao}</select>
      </div>
      <button class="botao-linha" onclick="inverterPosicoes('${chave}')">Inverter posições</button>
    ` : ""}
    <button class="botao-primario" onclick="removerPneu('${chave}')">Remover (volta ao estoque)</button>
    <button class="botao-perigo" style="width:100%" onclick="darPerda('${chave}')">Registrar perda</button>
  `;
  document.getElementById("folhaSlot").classList.add("aberta");
}

function fecharSlot() {
  document.getElementById("folhaSlot").classList.remove("aberta");
  slotAberto = null;
}

async function registrarHistorico(itemId, posicao, tipoEvento) {
  await db.collection("historico_movimentacoes").add({
    item_id: itemId,
    caminhao: caminhaoAtual.placa,
    posicao,
    tipo_evento: tipoEvento,
    km_no_evento: caminhaoAtual.km_atual,
    data: firebase.firestore.FieldValue.serverTimestamp(),
    responsavel: "admin",
  });
}

async function instalarPneu(chave) {
  const itemId = document.getElementById("selectInstalar").value;
  const itemRef = db.collection("itens").doc(itemId);
  const item = (await itemRef.get()).data();

  if (item.origem_estoque_id) {
    // já é um pneu individual (voltou pro estoque uma vez) — reinstala ele mesmo,
    // sem gerar código novo nem tocar em nenhum lote, pra não perder o histórico de KM dele.
    await itemRef.update({
      status: "em_uso",
      caminhao_atual: caminhaoAtual.placa,
      posicao: chave,
      km_instalacao: caminhaoAtual.km_atual,
    });
    await registrarHistorico(itemId, chave, "instalado");
  } else {
    // é um lote fresco de estoque — consome 1 unidade e nasce um pneu individual novo
    const novoItemRef = db.collection("itens").doc();
    const lote_operacao = db.batch();
    lote_operacao.update(itemRef, { quantidade: firebase.firestore.FieldValue.increment(-1) });
    lote_operacao.set(novoItemRef, {
      tipo: "pneu",
      codigo: `${item.codigo}-${gerarSufixoUnico()}`,
      marca: item.marca || "",
      tipo_pneu: item.tipo_pneu || "",
      custo_unitario: item.custo_unitario || 0,
      status: "em_uso",
      caminhao_atual: caminhaoAtual.placa,
      posicao: chave,
      km_instalacao: caminhaoAtual.km_atual,
      km_acumulado: 0,
      origem_estoque_id: itemId,
    });
    await lote_operacao.commit();
    await registrarHistorico(novoItemRef.id, chave, "instalado");
  }
  fecharSlot();
}

async function removerPneu(chave) {
  const item = itensDoCaminhao[chave];
  const novoAcumulado = kmEstimado(item);
  await db.collection("itens").doc(item.id).update({
    status: "estoque",
    caminhao_atual: null,
    posicao: null,
    km_instalacao: null,
    km_acumulado: novoAcumulado,
    quantidade: 1,
  });
  await registrarHistorico(item.id, chave, "removido");
  fecharSlot();
}

async function darPerda(chave) {
  const confirmou = await confirmarAcao({
    titulo: "Registrar perda",
    mensagem: "Confirma a perda deste pneu? Ele sai de circulação definitivamente.",
    textoConfirmar: "Registrar perda",
  });
  if (!confirmou) return;
  const item = itensDoCaminhao[chave];
  const novoAcumulado = kmEstimado(item);
  await db.collection("itens").doc(item.id).update({
    status: "descartado",
    caminhao_atual: null,
    posicao: null,
    km_instalacao: null,
    km_acumulado: novoAcumulado,
    quantidade: 0,
  });
  await registrarHistorico(item.id, chave, "perda");
  fecharSlot();
}

async function inverterPosicoes(chaveA) {
  const chaveB = document.getElementById("selectInversao").value;
  const itemA = itensDoCaminhao[chaveA];
  const itemB = itensDoCaminhao[chaveB];

  const lote = db.batch();
  lote.update(db.collection("itens").doc(itemA.id), { posicao: chaveB });
  lote.update(db.collection("itens").doc(itemB.id), { posicao: chaveA });
  await lote.commit();

  await registrarHistorico(itemA.id, chaveB, "inversao");
  await registrarHistorico(itemB.id, chaveA, "inversao");
  fecharSlot();
}