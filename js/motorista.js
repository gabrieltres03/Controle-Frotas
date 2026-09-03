const CHAVE_FILA_OFFLINE = "frota_fila_abastecimentos";

let motoristaId = null;
let motoristaNome = "";
let caminhaoVinculado = null;
let ehCoringa = false;
let veiculoAtivo = null;
let itensDoCaminhao = {};
let catalogoDespesas = [];

auth.onAuthStateChanged(async (usuario) => {
  const perfilSalvo = localStorage.getItem("frota_perfil");
  motoristaId = localStorage.getItem("frota_motorista_id");
  if (!usuario || perfilSalvo !== "motorista" || !motoristaId) {
    window.location.href = "index.html";
    return;
  }
  ativarMascaraNumerica(document.getElementById("campoKmAtual"));
  ativarMascaraNumerica(document.getElementById("campoValor"));
  ativarMascaraNumerica(document.getElementById("campoValorRefeicao"));
  ativarCapitalizacaoAutomatica(document.getElementById("campoRestaurante"));
  ativarCapitalizacaoAutomatica(document.getElementById("campoLocalRefeicao"));
  await carregarPerfil();
  atualizarBadgePendentes();
  if (navigator.onLine) sincronizarFila();
});

db.collection("caminhoes").where("ativo", "==", true).orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("selectVeiculoCoringa");
  const atual = select.value;
  select.innerHTML = '<option value="">Selecione o veículo</option>';
  snapshot.docs.forEach((doc) => {
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = `${doc.id} — ${doc.data().nome || ""}`;
    select.appendChild(opcao);
  });
  select.value = atual;
});

async function carregarPerfil() {
  const doc = await db.collection("motoristas").doc(motoristaId).get();
  const dados = doc.data();
  motoristaNome = dados.nome;
  caminhaoVinculado = dados.caminhao_vinculado || null;
  ehCoringa = !caminhaoVinculado || caminhaoVinculado === "coringa";

  document.getElementById("nomeMotorista").textContent = motoristaNome;

  if (ehCoringa) {
    document.getElementById("placaVinculada").textContent = "Motorista coringa";
    document.getElementById("blocoVeiculoCoringa").style.display = "block";
  } else {
    veiculoAtivo = caminhaoVinculado;
    document.getElementById("placaVinculada").textContent = `Veículo ${caminhaoVinculado}`;
    document.getElementById("blocoVeiculoCoringa").style.display = "none";
  }

  carregarHistorico();
  carregarDespesas();
  carregarCatalogoAbastecimento();
  if (veiculoAtivo) carregarMapaPneus();
}

function trocarVeiculoCoringa(valor) {
  veiculoAtivo = valor || null;
  carregarMapaPneus();
}

function sairMotorista() {
  auth.signOut().finally(() => {
    localStorage.removeItem("frota_perfil");
    localStorage.removeItem("frota_motorista_id");
    window.location.href = "index.html";
  });
}

function mudarAba(aba) {
  document.querySelectorAll(".aba-perfil").forEach((a) => a.classList.toggle("ativa", a.dataset.aba === aba));
  document.getElementById("abaAbastecer").style.display = aba === "abastecer" ? "block" : "none";
  document.getElementById("abaAlimentacao").style.display = aba === "alimentacao" ? "block" : "none";
  document.getElementById("abaHistorico").style.display = aba === "historico" ? "block" : "none";
  document.getElementById("abaPneus").style.display = aba === "pneus" ? "block" : "none";
}

// ---------- catálogo de tipos de abastecimento (diesel, gasolina, arla, cheirinho...) ----------

function carregarCatalogoAbastecimento() {
  db.collection("tipos_lancamento")
    .where("ativo", "==", true)
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      catalogoDespesas = snapshot.docs.map((d) => ({ id: d.id, nome: d.data().nome }));
      const select = document.getElementById("campoTipoAbastecimento");
      const atual = select.value;
      select.innerHTML = '<option value="">Selecione</option>' + catalogoDespesas.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
      if (Array.from(select.options).some((o) => o.value === atual)) select.value = atual;
    });
}

// ---------- abastecimento + fila offline ----------

function lerFila() {
  return JSON.parse(localStorage.getItem(CHAVE_FILA_OFFLINE) || "[]");
}
function gravarFila(fila) {
  try {
    localStorage.setItem(CHAVE_FILA_OFFLINE, JSON.stringify(fila));
    return true;
  } catch (erro) {
    return false;
  }
}
let sincronizando = false;
function atualizarBadgePendentes() {
  const fila = lerFila();
  const badge = document.getElementById("badgePendentes");
  if (fila.length > 0) {
    badge.style.display = "inline-block";
    badge.textContent = `${fila.length} pendente${fila.length > 1 ? "s" : ""}`;
  } else {
    badge.style.display = "none";
  }
}

async function calcularMedia(caminhao, kmAtual) {
  const ultimo = await db
    .collection("abastecimentos")
    .where("caminhao", "==", caminhao)
    .orderBy("km_atual", "desc")
    .limit(1)
    .get();
  if (ultimo.empty) return null;
  const anterior = ultimo.docs[0].data();
  const kmRodado = kmAtual - anterior.km_atual;
  const litrosAnterior = anterior.litros;
  if (kmRodado <= 0 || !litrosAnterior) return null;
  return kmRodado / litrosAnterior;
}

async function lancarAbastecimento() {
  if (!veiculoAtivo) {
    document.getElementById("mensagemAbastecimento").textContent = ehCoringa
      ? "Selecione um veículo primeiro."
      : "Você não tem veículo vinculado, fale com o admin.";
    return;
  }
  const tipoId = document.getElementById("campoTipoAbastecimento").value;
  const litros = Number(document.getElementById("campoLitros").value);
  const kmAtual = lerNumeroBR(document.getElementById("campoKmAtual").value);
  const valor = lerNumeroBR(document.getElementById("campoValor").value);
  const observacao = document.getElementById("campoObsAbastecimento").value.trim();
  const arquivoNota = document.getElementById("campoFotoNota").files[0];

  if (!tipoId || !litros || !kmAtual || !arquivoNota) {
    document.getElementById("mensagemAbastecimento").textContent = "Selecione o tipo, preencha quantidade, KM e anexe a foto da nota.";
    return;
  }
  const tipoNome = (catalogoDespesas.find((c) => c.id === tipoId) || {}).nome || tipoId;

  const botao = document.getElementById("botaoLancarAbastecimento");
  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = "Salvando...";

  try {
    document.getElementById("mensagemAbastecimento").textContent = "Processando a foto...";

    let notaPdf;
    try {
      notaPdf = await gerarTicketEmPdf(arquivoNota);
    } catch (erro) {
      document.getElementById("mensagemAbastecimento").textContent = "Erro na foto: " + erro.message;
      return;
    }

    const registro = {
      caminhao: veiculoAtivo,
      motorista_id: motoristaId,
      tipo: tipoNome,
      litros,
      km_atual: kmAtual,
      valor: valor || 0,
      observacao,
      nota_pdf: notaPdf,
      foto_tirada_em: new Date().toISOString(),
      criado_localmente_em: new Date().toISOString(),
    };

    document.getElementById("mensagemAbastecimento").textContent = "Salvando...";

    try {
      if (!navigator.onLine) throw new Error("offline");
      const media = await calcularMedia(veiculoAtivo, kmAtual);
      await db.collection("abastecimentos").add({
        ...registro,
        media,
        data: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection("caminhoes").doc(veiculoAtivo).update({ km_atual: kmAtual });
      limparFormularioAbastecimento("Abastecimento lançado!");
      carregarHistorico();
    } catch (erro) {
      const semConexaoDeVerdade = !navigator.onLine || erro.code === "unavailable" || erro.message === "offline";
      if (semConexaoDeVerdade) {
        const fila = lerFila();
        fila.push(registro);
        const salvouOffline = gravarFila(fila);
        atualizarBadgePendentes();
        if (salvouOffline) {
          limparFormularioAbastecimento("Sem conexão — salvo no aparelho, sincroniza sozinho quando voltar a internet.");
        } else {
          document.getElementById("mensagemAbastecimento").textContent =
            "Sem conexão e sem espaço de armazenamento no aparelho pra guardar offline. Sincroniza os pendentes primeiro ou tenta com internet.";
        }
      } else {
        document.getElementById("mensagemAbastecimento").textContent = "Erro ao salvar: " + erro.message;
      }
    }
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

function limparFormularioAbastecimento(mensagem) {
  document.getElementById("campoTipoAbastecimento").value = "";
  document.getElementById("campoLitros").value = "";
  document.getElementById("campoKmAtual").value = "";
  document.getElementById("campoValor").value = "";
  document.getElementById("campoObsAbastecimento").value = "";
  document.getElementById("campoFotoNota").value = "";
  document.getElementById("mensagemAbastecimento").textContent = mensagem;
}

// ---------- compressão de foto e geração de PDF (compartilhado) ----------

function comprimirImagem(arquivo, larguraMax, qualidade) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = (evento) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, larguraMax / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", qualidade), largura: canvas.width, altura: canvas.height });
      };
      img.onerror = reject;
      img.src = evento.target.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

async function gerarTicketEmPdf(arquivo) {
  let larguraMax = 1200;
  let qualidade = 0.7;

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const { dataUrl, largura, altura } = await comprimirImagem(arquivo, larguraMax, qualidade);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: altura >= largura ? "portrait" : "landscape", unit: "px", format: [largura, altura] });
    pdf.addImage(dataUrl, "JPEG", 0, 0, largura, altura);
    const base64 = pdf.output("datauristring");

    if (base64.length * 0.75 < 700000 || (larguraMax <= 500 && qualidade <= 0.35)) {
      return base64;
    }
    larguraMax = Math.round(larguraMax * 0.8);
    qualidade = Math.max(0.35, qualidade - 0.15);
  }
  throw new Error("Não consegui deixar a foto pequena o suficiente, tenta uma foto mais simples");
}

// ---------- despesa de alimentação ----------

async function lancarDespesaAlimentacao() {
  if (ehCoringa && !veiculoAtivo) {
    document.getElementById("mensagemAlimentacao").textContent = "Selecione um veículo primeiro.";
    return;
  }
  const refeicao = document.getElementById("campoRefeicao").value;
  const restaurante = document.getElementById("campoRestaurante").value.trim();
  const local = document.getElementById("campoLocalRefeicao").value.trim();
  const valor = lerNumeroBR(document.getElementById("campoValorRefeicao").value);
  const observacao = document.getElementById("campoObsAlimentacao").value.trim();
  const arquivo = document.getElementById("campoFotoTicket").files[0];
  const mensagem = document.getElementById("mensagemAlimentacao");

  if (!restaurante || !local || !valor || !arquivo) {
    mensagem.textContent = "Preencha todos os campos e anexe a foto do ticket.";
    return;
  }

  const botao = document.getElementById("botaoLancarDespesa");
  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = "Salvando...";

  try {
    mensagem.textContent = "Processando a foto...";
    const ticketPdf = await gerarTicketEmPdf(arquivo);

    mensagem.textContent = "Salvando...";
    await db.collection("despesas").add({
      tipo: "alimentacao",
      refeicao,
      restaurante,
      local,
      valor,
      observacao,
      ticket_pdf: ticketPdf,
      foto_tirada_em: new Date().toISOString(),
      motorista_id: motoristaId,
      caminhao: veiculoAtivo,
      data: firebase.firestore.FieldValue.serverTimestamp(),
    });

    document.getElementById("campoRestaurante").value = "";
    document.getElementById("campoLocalRefeicao").value = "";
    document.getElementById("campoValorRefeicao").value = "";
    document.getElementById("campoObsAlimentacao").value = "";
    document.getElementById("campoFotoTicket").value = "";
    mensagem.textContent = "Despesa lançada!";
  } catch (erro) {
    mensagem.textContent = "Erro ao salvar: " + erro.message;
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

// ---------- outras despesas (catálogo: arla, cheirinho, etc.) ----------

async function sincronizarFila() {
  if (sincronizando) return;
  sincronizando = true;
  try {
    const fila = lerFila();
    if (fila.length === 0) return;

    const restantes = [];
    for (const registro of fila) {
      try {
        const media = await calcularMedia(registro.caminhao, registro.km_atual);
        await db.collection("abastecimentos").add({
          caminhao: registro.caminhao,
          motorista_id: registro.motorista_id,
          tipo: registro.tipo,
          litros: registro.litros,
          km_atual: registro.km_atual,
          valor: registro.valor,
          observacao: registro.observacao || "",
          nota_pdf: registro.nota_pdf,
          foto_tirada_em: registro.foto_tirada_em,
          media,
          data: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection("caminhoes").doc(registro.caminhao).update({ km_atual: registro.km_atual });
      } catch (erro) {
        restantes.push(registro);
      }
    }
    gravarFila(restantes);
    atualizarBadgePendentes();
    carregarHistorico();
  } finally {
    sincronizando = false;
  }
}

window.addEventListener("online", sincronizarFila);

// ---------- histórico ----------

let cachePdfHistorico = {};

function carregarHistorico() {
  db.collection("abastecimentos")
    .where("motorista_id", "==", motoristaId)
    .orderBy("data", "desc")
    .limit(30)
    .onSnapshot(
      (snapshot) => {
        const container = document.getElementById("listaHistorico");
        if (snapshot.empty) {
          container.innerHTML = '<p class="vazio">Nenhum abastecimento lançado ainda.</p>';
          return;
        }
        container.innerHTML = snapshot.docs
          .map((doc) => {
            const a = doc.data();
            cachePdfHistorico[doc.id] = a.nota_pdf;
            const data = a.data ? a.data.toDate().toLocaleDateString("pt-BR") : "agora";
            const media = a.media ? `${a.media.toFixed(2)} km/L` : "sem média anterior";
            const horaFoto = a.foto_tirada_em ? new Date(a.foto_tirada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
            const obs = a.observacao ? `<br>obs: ${a.observacao}` : "";
            return `
              <div class="item-lista">
                <div class="item-lista-info">
                  <span class="item-lista-titulo">${a.tipo || "Abastecimento"} · ${a.litros} L · R$ ${Number(a.valor).toFixed(2)}</span>
                  <span class="item-lista-sub">${a.caminhao || "—"} · ${data}${horaFoto ? " às " + horaFoto : ""} · ${a.km_atual.toLocaleString("pt-BR")} km · ${media}${obs}</span>
                </div>
                ${a.nota_pdf ? `<button class="botao-linha" style="height:32px; padding:0 10px; font-size:12px; white-space:nowrap" onclick="abrirPdfBase64(cachePdfHistorico['${doc.id}'], 'nota-${doc.id}.pdf')">ver nota</button>` : ""}
              </div>`;
          })
          .join("");
      },
      () => {
        document.getElementById("listaHistorico").innerHTML = '<p class="vazio">Sem conexão pra carregar o histórico agora.</p>';
      }
    );
}

function rotuloRefeicao(refeicao) {
  return { almoco: "Almoço", janta: "Janta", lanche: "Lanche" }[refeicao] || refeicao;
}

let cachePdfDespesas = {};

function carregarDespesas() {
  db.collection("despesas")
    .where("motorista_id", "==", motoristaId)
    .orderBy("data", "desc")
    .limit(30)
    .onSnapshot(
      (snapshot) => {
        const container = document.getElementById("listaDespesas");
        if (snapshot.empty) {
          container.innerHTML = '<p class="vazio">Nenhuma despesa lançada ainda.</p>';
          return;
        }
        container.innerHTML = snapshot.docs
          .map((doc) => {
            const d = doc.data();
            cachePdfDespesas[doc.id] = d.ticket_pdf;
            const data = d.data ? d.data.toDate().toLocaleDateString("pt-BR") : "agora";
            const horaFoto = d.foto_tirada_em ? new Date(d.foto_tirada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
            const obs = d.observacao ? `<br>obs: ${d.observacao}` : "";
            const titulo = d.tipo === "alimentacao" ? `${rotuloRefeicao(d.refeicao)} · R$ ${Number(d.valor).toFixed(2)}` : `${d.categoria} · R$ ${Number(d.valor).toFixed(2)}`;
            const sub = d.tipo === "alimentacao" ? `${d.restaurante} · ${d.local} · ${data}${horaFoto ? " às " + horaFoto : ""}${obs}` : `${d.caminhao || "—"} · ${data}${horaFoto ? " às " + horaFoto : ""}${obs}`;
            return `
              <div class="item-lista">
                <div class="item-lista-info">
                  <span class="item-lista-titulo">${titulo}</span>
                  <span class="item-lista-sub">${sub}</span>
                </div>
                ${d.ticket_pdf ? `<button class="botao-linha" style="height:32px; padding:0 10px; font-size:12px; white-space:nowrap" onclick="abrirPdfBase64(cachePdfDespesas['${doc.id}'], 'ticket-${doc.id}.pdf')">ver ticket</button>` : ""}
              </div>`;
          })
          .join("");
      },
      () => {
        document.getElementById("listaDespesas").innerHTML = '<p class="vazio">Sem conexão pra carregar as despesas agora.</p>';
      }
    );
}

// ---------- mapa de pneus (estepe / inversão) ----------

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
      posicoes.push({ chave: `eixo${n}-esq`, rotulo: "Esquerdo", lado: "esq" }, { chave: `eixo${n}-dir`, rotulo: "Direito", lado: "dir" });
    }
  });
  return posicoes;
}

let caminhaoAtualDados = null;
let cancelarItensMotorista = null;

async function carregarMapaPneus() {
  if (cancelarItensMotorista) {
    cancelarItensMotorista();
    cancelarItensMotorista = null;
  }
  if (!veiculoAtivo) {
    document.getElementById("mapaEixosMotorista").innerHTML = '<p class="vazio">Selecione um veículo primeiro.</p>';
    return;
  }

  const doc = await db.collection("caminhoes").doc(veiculoAtivo).get();
  caminhaoAtualDados = { placa: veiculoAtivo, ...doc.data() };

  cancelarItensMotorista = db.collection("itens").where("caminhao_atual", "==", veiculoAtivo).onSnapshot((snapshot) => {
    itensDoCaminhao = {};
    snapshot.docs.forEach((d) => {
      const item = { id: d.id, ...d.data() };
      itensDoCaminhao[item.posicao] = item;
    });
    renderizarMapaMotorista();
  });
}

function kmEstimado(item) {
  const kmInstalacao = item.km_instalacao ?? caminhaoAtualDados.km_atual;
  return (item.km_acumulado || 0) + Math.max(0, caminhaoAtualDados.km_atual - kmInstalacao);
}

function renderizarMapaMotorista() {
  const eixos = caminhaoAtualDados.eixos || [];
  const posicoes = gerarPosicoes(eixos);
  const container = document.getElementById("mapaEixosMotorista");
  container.innerHTML = "";

  eixos.forEach((eixo, i) => {
    const n = i + 1;
    const doEixo = posicoes.filter((p) => p.chave.startsWith(`eixo${n}-`));
    const esq = doEixo.filter((p) => p.lado === "esq");
    const dir = doEixo.filter((p) => p.lado === "dir");

    const cartao = document.createElement("div");
    cartao.className = "cartao-eixo";
    cartao.innerHTML = `
      <div class="cartao-eixo-titulo">Eixo ${n}</div>
      <div class="linhas-lados">
        <div class="lado-grupo">${esq.map(renderizarSlotMotorista).join("")}</div>
        <div class="lado-grupo">${dir.map(renderizarSlotMotorista).join("")}</div>
      </div>
    `;
    container.appendChild(cartao);
  });
}

function renderizarSlotMotorista(posicao) {
  const item = itensDoCaminhao[posicao.chave];
  if (!item) {
    return `<button class="slot-pneu vazio" onclick="abrirSlotMotorista('${posicao.chave}', '${posicao.rotulo}')">
      <span class="slot-pneu-codigo">${posicao.rotulo}</span>
      <span class="slot-pneu-km">vazio</span>
    </button>`;
  }
  return `<button class="slot-pneu ocupado" onclick="abrirSlotMotorista('${posicao.chave}', '${posicao.rotulo}')">
    <span class="slot-pneu-codigo">${item.codigo}</span>
    <span class="slot-pneu-km">${posicao.rotulo} · ${kmEstimado(item).toLocaleString("pt-BR")} km</span>
  </button>`;
}

async function abrirSlotMotorista(chave, rotulo) {
  const item = itensDoCaminhao[chave];
  document.getElementById("tituloSlot").textContent = rotulo;
  const corpo = document.getElementById("corpoSlot");

  if (!item) {
    const disponiveis = await db.collection("itens").where("tipo", "==", "pneu").where("status", "==", "estoque").get();
    const comEstoque = disponiveis.docs.filter((d) => (d.data().quantidade ?? 1) > 0);
    const opcoes = comEstoque.map((d) => `<option value="${d.id}">${d.data().codigo} · ${d.data().quantidade} disp.</option>`).join("");
    corpo.innerHTML = comEstoque.length === 0
      ? '<p class="vazio">Sem pneu disponível no estoque.</p>'
      : `<div class="campo"><label>Instalar pneu do estoque</label><select id="selectInstalarMotorista">${opcoes}</select></div>
         <button class="botao-primario" onclick="instalarComoMotorista('${chave}')">Instalar</button>`;
    document.getElementById("folhaSlot").classList.add("aberta");
    return;
  }

  const outrasOcupadas = Object.keys(itensDoCaminhao).filter((k) => k !== chave);
  const opcoesInversao = outrasOcupadas.map((k) => `<option value="${k}">${k} — ${itensDoCaminhao[k].codigo}</option>`).join("");
  const disponiveisEstoque = await db.collection("itens").where("tipo", "==", "pneu").where("status", "==", "estoque").get();
  const comEstoque = disponiveisEstoque.docs.filter((d) => (d.data().quantidade ?? 1) > 0);
  const opcoesEstoque = comEstoque.map((d) => `<option value="${d.id}">${d.data().codigo} · ${d.data().quantidade} disp.</option>`).join("");

  corpo.innerHTML = `
    <div class="item-lista" style="box-shadow:none; border:1.5px solid var(--borda)">
      <div class="item-lista-info">
        <span class="item-lista-titulo">${item.codigo}</span>
        <span class="item-lista-sub">${kmEstimado(item).toLocaleString("pt-BR")} km rodados</span>
      </div>
    </div>
    ${comEstoque.length > 0 ? `
      <div class="campo">
        <label>Trocar por pneu do estoque (furou)</label>
        <select id="selectTrocaMotorista">${opcoesEstoque}</select>
      </div>
      <button class="botao-linha" onclick="trocarPorEstepe('${chave}')">Trocar por esse pneu</button>
    ` : ""}
    ${outrasOcupadas.length > 0 ? `
      <div class="campo">
        <label>Inverter com</label>
        <select id="selectInversaoMotorista">${opcoesInversao}</select>
      </div>
      <button class="botao-linha" onclick="inverterComoMotorista('${chave}')">Inverter posições</button>
    ` : ""}
  `;
  document.getElementById("folhaSlot").classList.add("aberta");
}

function fecharSlot() {
  document.getElementById("folhaSlot").classList.remove("aberta");
}

async function registrarHistoricoMotorista(itemId, posicao, tipoEvento) {
  await db.collection("historico_movimentacoes").add({
    item_id: itemId,
    caminhao: veiculoAtivo,
    posicao,
    tipo_evento: tipoEvento,
    km_no_evento: caminhaoAtualDados.km_atual,
    data: firebase.firestore.FieldValue.serverTimestamp(),
    responsavel: motoristaNome,
  });
}

async function instalarComoMotorista(chave) {
  const loteId = document.getElementById("selectInstalarMotorista").value;
  const loteRef = db.collection("itens").doc(loteId);
  const lote = (await loteRef.get()).data();

  const novoItemRef = db.collection("itens").doc();
  const lote_operacao = db.batch();
  lote_operacao.update(loteRef, { quantidade: firebase.firestore.FieldValue.increment(-1) });
  lote_operacao.set(novoItemRef, {
    tipo: "pneu",
    codigo: `${lote.codigo}-${gerarSufixoUnico()}`,
    marca: lote.marca || "",
    tipo_pneu: lote.tipo_pneu || "",
    custo_unitario: lote.custo_unitario || 0,
    status: "em_uso",
    caminhao_atual: veiculoAtivo,
    posicao: chave,
    km_instalacao: caminhaoAtualDados.km_atual,
    km_acumulado: 0,
    origem_estoque_id: loteId,
  });
  await lote_operacao.commit();

  await registrarHistoricoMotorista(novoItemRef.id, chave, "instalado");
  fecharSlot();
}

async function trocarPorEstepe(chave) {
  const itemFurado = itensDoCaminhao[chave];
  const loteId = document.getElementById("selectTrocaMotorista").value;
  const loteRef = db.collection("itens").doc(loteId);
  const lote = (await loteRef.get()).data();
  const novoAcumuladoFurado = kmEstimado(itemFurado);

  const novoItemRef = db.collection("itens").doc();
  const lote_operacao = db.batch();
  lote_operacao.update(db.collection("itens").doc(itemFurado.id), {
    status: "estoque",
    caminhao_atual: null,
    posicao: null,
    km_instalacao: null,
    km_acumulado: novoAcumuladoFurado,
    quantidade: 1,
    observacoes: (itemFurado.observacoes || "") + " (furou - aguardando reparo)",
  });
  lote_operacao.update(loteRef, { quantidade: firebase.firestore.FieldValue.increment(-1) });
  lote_operacao.set(novoItemRef, {
    tipo: "pneu",
    codigo: `${lote.codigo}-${gerarSufixoUnico()}`,
    marca: lote.marca || "",
    tipo_pneu: lote.tipo_pneu || "",
    custo_unitario: lote.custo_unitario || 0,
    status: "em_uso",
    caminhao_atual: veiculoAtivo,
    posicao: chave,
    km_instalacao: caminhaoAtualDados.km_atual,
    km_acumulado: 0,
    origem_estoque_id: loteId,
  });
  await lote_operacao.commit();

  await registrarHistoricoMotorista(itemFurado.id, chave, "removido");
  await registrarHistoricoMotorista(novoItemRef.id, chave, "instalado");
  fecharSlot();
}

async function inverterComoMotorista(chaveA) {
  const chaveB = document.getElementById("selectInversaoMotorista").value;
  const itemA = itensDoCaminhao[chaveA];
  const itemB = itensDoCaminhao[chaveB];

  const lote = db.batch();
  lote.update(db.collection("itens").doc(itemA.id), { posicao: chaveB });
  lote.update(db.collection("itens").doc(itemB.id), { posicao: chaveA });
  await lote.commit();

  await registrarHistoricoMotorista(itemA.id, chaveB, "inversao");
  await registrarHistoricoMotorista(itemB.id, chaveA, "inversao");
  fecharSlot();
}
