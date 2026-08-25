let entradasFiltradas = [];
let saidasFiltradas = [];

function inicioDoDia(dataStr) {
  return firebase.firestore.Timestamp.fromDate(new Date(dataStr + "T00:00:00"));
}
function fimDoDia(dataStr) {
  return firebase.firestore.Timestamp.fromDate(new Date(dataStr + "T23:59:59"));
}

function rotuloTipoItem(tipo) {
  return { pneu: "Pneu", ferramenta: "Ferramenta" }[tipo] || tipo;
}

function rotuloEvento(tipo) {
  return { instalado: "Instalado", perda: "Perda/descarte" }[tipo] || tipo;
}

async function gerarMovimentacoes() {
  const tipoFiltro = document.getElementById("filtroTipoItem").value;
  const dataInicio = document.getElementById("dataInicioMov").value;
  const dataFim = document.getElementById("dataFimMov").value;

  document.getElementById("listaEntradas").innerHTML = '<p class="carregando">Buscando...</p>';
  document.getElementById("listaSaidas").innerHTML = '<p class="carregando">Buscando...</p>';
  document.getElementById("resumoMovimentacoes").innerHTML = "";

  // mapa de todos os itens, pra descobrir tipo/código na hora de mostrar as saídas
  const todosItens = await db.collection("itens").get();
  const itensMap = {};
  todosItens.docs.forEach((d) => (itensMap[d.id] = { id: d.id, ...d.data() }));

  // entradas: toda vez que um lote foi cadastrado no estoque
  let consultaEntradas = db.collection("itens").orderBy("criado_em", "desc");
  if (dataInicio) consultaEntradas = consultaEntradas.where("criado_em", ">=", inicioDoDia(dataInicio));
  if (dataFim) consultaEntradas = consultaEntradas.where("criado_em", "<=", fimDoDia(dataFim));
  const entradasSnap = await consultaEntradas.limit(300).get();

  entradasFiltradas = entradasSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((i) => !tipoFiltro || i.tipo === tipoFiltro);

  // saídas: movimentações de instalação e perda
  let consultaSaidas = db.collection("historico_movimentacoes").orderBy("data", "desc");
  if (dataInicio) consultaSaidas = consultaSaidas.where("data", ">=", inicioDoDia(dataInicio));
  if (dataFim) consultaSaidas = consultaSaidas.where("data", "<=", fimDoDia(dataFim));
  const saidasSnap = await consultaSaidas.limit(300).get();

  saidasFiltradas = saidasSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => ["instalado", "perda"].includes(m.tipo_evento))
    .map((m) => ({ ...m, item: itensMap[m.item_id] || {} }))
    .filter((m) => !tipoFiltro || m.item.tipo === tipoFiltro);

  renderizarMovimentacoes();
}

function renderizarMovimentacoes() {
  const totalGastoEntradas = entradasFiltradas.reduce((s, i) => s + (i.custo_unitario || 0) * (i.quantidade_original ?? i.quantidade ?? 1), 0);

  document.getElementById("resumoMovimentacoes").innerHTML = `
    <p style="font-size:13.5px; color:var(--texto-secundario); text-align:center; margin-bottom:16px">
      ${entradasFiltradas.length} entrada${entradasFiltradas.length !== 1 ? "s" : ""} (R$ ${totalGastoEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} gastos) · ${saidasFiltradas.length} saída${saidasFiltradas.length !== 1 ? "s" : ""}
    </p>
  `;
  document.getElementById("acoesExportarMov").style.display = entradasFiltradas.length || saidasFiltradas.length ? "flex" : "none";

  const listaEntradas = document.getElementById("listaEntradas");
  listaEntradas.innerHTML = entradasFiltradas.length
    ? entradasFiltradas
        .map((i) => {
          const data = i.criado_em ? i.criado_em.toDate().toLocaleDateString("pt-BR") : "—";
          const custoTotal = (i.custo_unitario || 0) * (i.quantidade ?? 1);
          return `
            <div class="item-lista">
              <div class="item-lista-info">
                <span class="item-lista-titulo">${i.codigo} · ${rotuloTipoItem(i.tipo)}</span>
                <span class="item-lista-sub">${i.quantidade ?? 1}x · R$ ${(i.custo_unitario || 0).toFixed(2)}/un · total R$ ${custoTotal.toFixed(2)} · ${data}</span>
              </div>
            </div>`;
        })
        .join("")
    : '<p class="vazio">Nenhuma entrada encontrada.</p>';

  const listaSaidas = document.getElementById("listaSaidas");
  listaSaidas.innerHTML = saidasFiltradas.length
    ? saidasFiltradas
        .map((m) => {
          const data = m.data ? m.data.toDate().toLocaleDateString("pt-BR") : "—";
          const destino = m.tipo_evento === "perda" ? "Perda/descarte" : `${m.caminhao || "—"} · ${m.posicao || ""}`;
          const codigo = m.item.codigo || m.item_id;
          return `
            <div class="item-lista">
              <div class="item-lista-info">
                <span class="item-lista-titulo">${codigo} · ${rotuloTipoItem(m.item.tipo)}</span>
                <span class="item-lista-sub">${rotuloEvento(m.tipo_evento)} → ${destino} · ${data} · ${m.responsavel || "—"}</span>
              </div>
            </div>`;
        })
        .join("")
    : '<p class="vazio">Nenhuma saída encontrada.</p>';
}

function montarLinhasEntradas() {
  return entradasFiltradas.map((i) => ({
    Data: i.criado_em ? i.criado_em.toDate().toLocaleDateString("pt-BR") : "",
    Código: i.codigo,
    Tipo: rotuloTipoItem(i.tipo),
    Quantidade: i.quantidade ?? 1,
    "Custo unitário (R$)": i.custo_unitario || 0,
    "Custo total (R$)": (i.custo_unitario || 0) * (i.quantidade ?? 1),
  }));
}

function montarLinhasSaidas() {
  return saidasFiltradas.map((m) => ({
    Data: m.data ? m.data.toDate().toLocaleDateString("pt-BR") : "",
    Código: m.item.codigo || m.item_id,
    Tipo: rotuloTipoItem(m.item.tipo),
    Evento: rotuloEvento(m.tipo_evento),
    Destino: m.tipo_evento === "perda" ? "Perda/descarte" : `${m.caminhao || "—"} · ${m.posicao || ""}`,
    Responsável: m.responsavel || "",
  }));
}

function exportarExcelMov() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(montarLinhasEntradas()), "Entradas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(montarLinhasSaidas()), "Saídas");
  const dataInicio = document.getElementById("dataInicioMov").value || "inicio";
  const dataFim = document.getElementById("dataFimMov").value || "hoje";
  XLSX.writeFile(wb, `entradas-saidas-${dataInicio}-a-${dataFim}.xlsx`);
}

function exportarPdfMov() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const dataInicio = document.getElementById("dataInicioMov").value || "início";
  const dataFim = document.getElementById("dataFimMov").value || "hoje";

  doc.setFontSize(14);
  doc.text("Entradas e saídas — Tres Business & Tech", 14, 16);
  doc.setFontSize(10);
  doc.text(`Período: ${dataInicio} a ${dataFim}`, 14, 23);

  doc.autoTable({
    startY: 30,
    head: [["Data", "Código", "Tipo", "Qtd", "Custo un.", "Custo total"]],
    body: montarLinhasEntradas().map((l) => [l.Data, l.Código, l.Tipo, l.Quantidade, l["Custo unitário (R$)"], l["Custo total (R$)"]]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 112, 188] },
  });

  const proximaY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.text("Saídas", 14, proximaY);
  doc.autoTable({
    startY: proximaY + 4,
    head: [["Data", "Código", "Tipo", "Evento", "Destino", "Responsável"]],
    body: montarLinhasSaidas().map((l) => [l.Data, l.Código, l.Tipo, l.Evento, l.Destino, l.Responsável]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 112, 188] },
  });

  doc.save(`entradas-saidas-${dataInicio}-a-${dataFim}.pdf`);
}
