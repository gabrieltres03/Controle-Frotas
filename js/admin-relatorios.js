let abastecimentosFiltrados = [];
let despesasFiltradas = [];
let pneusSnapshot = [];

db.collection("caminhoes").where("ativo", "==", true).orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("filtroCaminhao");
  select.innerHTML = '<option value="">Todos</option>';
  snapshot.docs.forEach((doc) => {
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = `${doc.id} — ${doc.data().nome || ""}`;
    select.appendChild(opcao);
  });
});

db.collection("motoristas").orderBy("nome").onSnapshot((snapshot) => {
  const select = document.getElementById("filtroMotorista");
  select.innerHTML = '<option value="">Todos</option>';
  snapshot.docs.forEach((doc) => {
    const opcao = document.createElement("option");
    opcao.value = doc.id;
    opcao.textContent = doc.data().nome;
    select.appendChild(opcao);
  });
});

function inicioDoDia(dataStr) {
  const d = new Date(dataStr + "T00:00:00");
  return firebase.firestore.Timestamp.fromDate(d);
}
function fimDoDia(dataStr) {
  const d = new Date(dataStr + "T23:59:59");
  return firebase.firestore.Timestamp.fromDate(d);
}

async function gerarRelatorio() {
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;
  const caminhaoFiltro = document.getElementById("filtroCaminhao").value;
  const motoristaFiltro = document.getElementById("filtroMotorista").value;

  if (!dataInicio || !dataFim) {
    avisar("Atenção", "Escolha o período (de / até)");
    return;
  }

  document.getElementById("resumoRelatorio").innerHTML = '<p class="carregando">Buscando dados...</p>';

  const snapshot = await db
    .collection("abastecimentos")
    .where("data", ">=", inicioDoDia(dataInicio))
    .where("data", "<=", fimDoDia(dataFim))
    .get();

  abastecimentosFiltrados = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => (!caminhaoFiltro || a.caminhao === caminhaoFiltro) && (!motoristaFiltro || a.motorista_id === motoristaFiltro));

  const despesasSnapshot = await db
    .collection("despesas")
    .where("data", ">=", inicioDoDia(dataInicio))
    .where("data", "<=", fimDoDia(dataFim))
    .get();

  despesasFiltradas = despesasSnapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => (!caminhaoFiltro || d.caminhao === caminhaoFiltro) && (!motoristaFiltro || d.motorista_id === motoristaFiltro));

  const pneusQuery = await db.collection("itens").where("tipo", "==", "pneu").get();
  pneusSnapshot = pneusQuery.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !caminhaoFiltro || p.caminhao_atual === caminhaoFiltro);

  renderizarResumo();
}

function renderizarResumo() {
  const container = document.getElementById("resumoRelatorio");

  if (abastecimentosFiltrados.length === 0 && despesasFiltradas.length === 0 && pneusSnapshot.length === 0) {
    container.innerHTML = '<p class="vazio">Nada encontrado nesse período/filtro.</p>';
    document.getElementById("acoesExportar").style.display = "none";
    return;
  }

  container.innerHTML = `
    <p style="font-size:13.5px; color:var(--texto-secundario); text-align:center; margin-bottom:4px">
      ${abastecimentosFiltrados.length} abastecimento${abastecimentosFiltrados.length !== 1 ? "s" : ""}, ${despesasFiltradas.length} despesa${despesasFiltradas.length !== 1 ? "s" : ""} e ${pneusSnapshot.length} pneu${pneusSnapshot.length !== 1 ? "s" : ""} encontrados — pronto pra exportar.
    </p>
  `;

  document.getElementById("acoesExportar").style.display = "flex";
}

function montarLinhasAbastecimento() {
  return abastecimentosFiltrados.map((a) => ({
    Data: a.data ? a.data.toDate().toLocaleDateString("pt-BR") : "",
    Caminhão: a.caminhao || "",
    Motorista: a.motorista_id || "",
    Litros: a.litros || 0,
    "Valor (R$)": a.valor || 0,
    "KM no abastecimento": a.km_atual || 0,
    "Média (km/L)": a.media ? a.media.toFixed(2) : "",
  }));
}

function montarLinhasPneus() {
  return pneusSnapshot.map((p) => ({
    Código: p.codigo,
    Tipo: p.tipo_pneu || "",
    Status: p.status,
    Caminhão: p.caminhao_atual || "—",
    "KM acumulado": p.km_acumulado || 0,
  }));
}

function montarLinhasDespesas() {
  return despesasFiltradas.map((d) => ({
    Data: d.data ? d.data.toDate().toLocaleDateString("pt-BR") : "",
    Caminhão: d.caminhao || "",
    Motorista: d.motorista_id || "",
    Tipo: d.tipo === "alimentacao" ? rotuloRefeicaoRelatorio(d.refeicao) : d.categoria || "Outra",
    Restaurante: d.restaurante || "",
    Local: d.local || "",
    Observação: d.observacao || "",
    "Valor (R$)": d.valor || 0,
  }));
}

function rotuloRefeicaoRelatorio(r) {
  return { almoco: "Almoço", janta: "Janta", lanche: "Lanche" }[r] || r || "";
}

function exportarExcel() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(montarLinhasAbastecimento()), "Abastecimentos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(montarLinhasDespesas()), "Despesas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(montarLinhasPneus()), "Pneus");
  XLSX.writeFile(wb, `relatorio-frota-${document.getElementById("dataInicio").value}-a-${document.getElementById("dataFim").value}.xlsx`);
}

function exportarPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Relatório de frota — Tres Business & Tech", 14, 16);
  doc.setFontSize(10);
  doc.text(`Período: ${document.getElementById("dataInicio").value} a ${document.getElementById("dataFim").value}`, 14, 23);

  doc.autoTable({
    startY: 30,
    head: [["Data", "Caminhão", "Motorista", "Litros", "Valor (R$)", "KM", "Média"]],
    body: montarLinhasAbastecimento().map((l) => [l.Data, l.Caminhão, l.Motorista, l.Litros, l["Valor (R$)"], l["KM no abastecimento"], l["Média (km/L)"]]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 112, 188] },
  });

  let proximaY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.text("Despesas", 14, proximaY);
  doc.autoTable({
    startY: proximaY + 4,
    head: [["Data", "Caminhão", "Motorista", "Tipo", "Restaurante", "Local", "Obs.", "Valor (R$)"]],
    body: montarLinhasDespesas().map((l) => [l.Data, l.Caminhão, l.Motorista, l.Tipo, l.Restaurante, l.Local, l.Observação, l["Valor (R$)"]]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 112, 188] },
  });

  proximaY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.text("Pneus", 14, proximaY);
  doc.autoTable({
    startY: proximaY + 4,
    head: [["Código", "Tipo", "Status", "Caminhão", "KM acumulado"]],
    body: montarLinhasPneus().map((l) => [l.Código, l.Tipo, l.Status, l.Caminhão, l["KM acumulado"]]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 112, 188] },
  });

  doc.save(`relatorio-frota-${document.getElementById("dataInicio").value}-a-${document.getElementById("dataFim").value}.pdf`);
}