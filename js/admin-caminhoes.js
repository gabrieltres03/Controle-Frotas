let caminhoesCache = [];
let placaEmEdicao = null;

const CONFIGURACOES_EIXO = {
  singela_simples: { rotulo: "Simples, rodagem singela (2 pneus)", rodados: ["simples"] },
  singela_dupla: { rotulo: "Simples, rodagem dupla (4 pneus)", rodados: ["duplo"] },
  duplo_direcional_singela: { rotulo: "Duplo direcional, rodagem singela (4 pneus)", rodados: ["simples", "simples"] },
  duplo_extralarga: { rotulo: "Duplo, rodagem singela extra larga (4 pneus)", rodados: ["simples", "simples"] },
  duplo_misto_proximo: { rotulo: "Duplo, um com rodagem dupla (6 pneus) — d ≤ 1,20m", rodados: ["simples", "duplo"] },
  duplo_misto_tandem: { rotulo: "Duplo, um com rodagem dupla (6 pneus) — tandem 1,20-2,40m", rodados: ["simples", "duplo"] },
  duplo_dupla_naotandem: { rotulo: "Duplo, rodagem dupla (8 pneus) — não tandem", rodados: ["duplo", "duplo"] },
  duplo_dupla_tandem: { rotulo: "Duplo, rodagem dupla (8 pneus) — tandem 1,20-2,40m", rodados: ["duplo", "duplo"] },
};

ativarCapitalizacaoAutomatica(document.getElementById("campoNome"));
ativarMaiusculasAutomaticas(document.getElementById("campoPlaca"));
ativarMascaraNumerica(document.getElementById("campoKm"));

db.collection("caminhoes").orderBy("nome").onSnapshot(
  (snapshot) => {
    caminhoesCache = snapshot.docs.map((doc) => ({ placa: doc.id, ...doc.data() })).filter((c) => c.ativo !== false);
    renderizarLista(caminhoesCache);
  },
  (erro) => {
    document.getElementById("listaCaminhoes").innerHTML = '<p class="vazio">Erro ao carregar: ' + erro.message + "</p>";
  }
);

function renderizarLista(lista) {
  const container = document.getElementById("listaCaminhoes");
  if (lista.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhum caminhão cadastrado ainda.<br>Toque no + pra criar o primeiro.</p>';
    return;
  }
  container.innerHTML = lista
    .map((c) => {
      const qtdEixos = (c.eixos || []).length;
      const qtdPneus = (c.eixos || []).reduce((soma, e) => soma + (e.rodado === "duplo" ? 4 : 2), 0);
      return `
        <div class="item-lista" onclick="abrirFormulario('${c.placa}')">
          <div class="item-lista-info">
            <span class="item-lista-titulo">${c.placa} ${c.nome ? "— " + c.nome : ""}</span>
            <span class="item-lista-sub">${qtdEixos} eixos · ${qtdPneus} pneus · ${formatarNumeroBR(c.km_atual)} km</span>
          </div>
          <span class="selo selo-neutro">${rotuloCarroceria(c.tipo_carroceria)}</span>
        </div>`;
    })
    .join("");
}

function rotuloCarroceria(tipo) {
  const rotulos = { graneleiro: "Graneleiro", porcadeiro: "Porcadeiro", racao: "Ração", prancha: "Prancha", basculante: "Basculante", sider: "Sider", outro: "Outro" };
  return rotulos[tipo] || "—";
}

function filtrarLista() {
  const termo = document.getElementById("busca").value.toLowerCase();
  const filtrados = caminhoesCache.filter(
    (c) => c.placa.toLowerCase().includes(termo) || (c.nome || "").toLowerCase().includes(termo)
  );
  renderizarLista(filtrados);
}

function adicionarEixo(tipo, classificacao) {
  const container = document.getElementById("listaEixos");
  const opcoesConfig = Object.entries(CONFIGURACOES_EIXO)
    .map(([valor, cfg]) => `<option value="${valor}">${cfg.rotulo}</option>`)
    .join("");

  const linha = document.createElement("div");
  linha.className = "linha-eixo";
  linha.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px; flex:1">
      <select class="grupo-config">${opcoesConfig}</select>
      <select class="eixo-tipo">
        <option value="direcao">Direção</option>
        <option value="tracao">Tração</option>
        <option value="suspenso">Suspenso</option>
        <option value="apoio">Apoio</option>
      </select>
    </div>
    <button class="botao-remover-eixo" onclick="this.parentElement.remove()">&times;</button>
  `;
  if (classificacao) linha.querySelector(".grupo-config").value = classificacao;
  if (tipo) linha.querySelector(".eixo-tipo").value = tipo;
  container.appendChild(linha);
}

function lerEixosDoFormulario() {
  const eixosFinal = [];
  let numero = 1;
  document.querySelectorAll("#listaEixos .linha-eixo").forEach((linha, indiceGrupo) => {
    const classificacao = linha.querySelector(".grupo-config").value;
    const tipo = linha.querySelector(".eixo-tipo").value;
    const grupoId = `g${indiceGrupo + 1}`;
    CONFIGURACOES_EIXO[classificacao].rodados.forEach((rodado) => {
      eixosFinal.push({ numero: numero++, tipo, rodado, classificacao, grupo_id: grupoId });
    });
  });
  return eixosFinal;
}

function reconstruirGruposParaEdicao(eixosSalvos) {
  const grupos = [];
  const jaVisto = new Set();
  eixosSalvos.forEach((eixo, i) => {
    if (jaVisto.has(i)) return;
    jaVisto.add(i);
    if (eixo.grupo_id) {
      eixosSalvos.forEach((outro, j) => {
        if (j !== i && outro.grupo_id === eixo.grupo_id) jaVisto.add(j);
      });
    }
    grupos.push({
      tipo: eixo.tipo,
      classificacao: eixo.classificacao || (eixo.rodado === "duplo" ? "singela_dupla" : "singela_simples"),
    });
  });
  return grupos;
}

function abrirFormulario(placa) {
  placaEmEdicao = placa || null;
  document.getElementById("listaEixos").innerHTML = "";
  document.getElementById("botaoDesativarCaminhao").style.display = placa ? "block" : "none";
  document.getElementById("linkExcluirCaminhao").style.display = placa ? "block" : "none";

  if (placa) {
    const c = caminhoesCache.find((x) => x.placa === placa);
    document.getElementById("tituloFolha").textContent = "Editar caminhão";
    document.getElementById("campoPlaca").value = c.placa;
    document.getElementById("campoPlaca").disabled = true;
    document.getElementById("campoNome").value = c.nome || "";
    document.getElementById("campoCarroceria").value = c.tipo_carroceria || "graneleiro";
    document.getElementById("campoKm").value = formatarNumeroBR(c.km_atual);
    reconstruirGruposParaEdicao(c.eixos || []).forEach((g) => adicionarEixo(g.tipo, g.classificacao));
  } else {
    document.getElementById("tituloFolha").textContent = "Novo caminhão";
    document.getElementById("campoPlaca").disabled = false;
    document.getElementById("campoPlaca").value = "";
    document.getElementById("campoNome").value = "";
    document.getElementById("campoCarroceria").value = "graneleiro";
    document.getElementById("campoKm").value = "";
    adicionarEixo("direcao", "singela_simples");
    adicionarEixo("tracao", "singela_dupla");
  }

  document.getElementById("folhaCaminhao").classList.add("aberta");
}

function fecharFormulario() {
  document.getElementById("folhaCaminhao").classList.remove("aberta");
}

async function salvarCaminhao() {
  const placa = document.getElementById("campoPlaca").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const nome = document.getElementById("campoNome").value.trim();
  const tipoCarroceria = document.getElementById("campoCarroceria").value;
  const kmAtual = lerNumeroBR(document.getElementById("campoKm").value);
  const eixos = lerEixosDoFormulario();

  if (!placa) {
    avisar("Atenção", "Informe a placa do caminhão");
    return;
  }
  if (eixos.length === 0) {
    avisar("Atenção", "Adicione pelo menos um eixo");
    return;
  }

  try {
    await db.collection("caminhoes").doc(placa).set(
      { nome, tipo_carroceria: tipoCarroceria, km_atual: kmAtual, eixos, ativo: true },
      { merge: true }
    );
    fecharFormulario();
  } catch (erro) {
    avisar("Erro ao salvar", erro.message);
  }
}

async function desativarCaminhao() {
  if (!placaEmEdicao) return;
  const confirmou = await confirmarAcao({
    titulo: "Desativar caminhão",
    mensagem: `Desativar ${placaEmEdicao}? Some da lista, mas o histórico continua guardado.`,
    textoConfirmar: "Desativar",
  });
  if (!confirmou) return;
  await db.collection("caminhoes").doc(placaEmEdicao).update({ ativo: false });
  fecharFormulario();
}

function abrirExclusaoCaminhao() {
  document.getElementById("placaParaExcluir").textContent = placaEmEdicao;
  document.getElementById("confirmacaoPlaca").value = "";
  document.getElementById("erroExclusaoCaminhao").textContent = "";
  document.getElementById("folhaExcluirCaminhao").classList.add("aberta");
}

function fecharExclusaoCaminhao() {
  document.getElementById("folhaExcluirCaminhao").classList.remove("aberta");
}

async function confirmarExclusaoCaminhao() {
  const digitado = document.getElementById("confirmacaoPlaca").value.trim().toUpperCase();
  if (digitado !== placaEmEdicao) {
    document.getElementById("erroExclusaoCaminhao").textContent = "A placa digitada não confere";
    return;
  }
  await db.collection("caminhoes").doc(placaEmEdicao).delete();
  fecharExclusaoCaminhao();
  fecharFormulario();
}
