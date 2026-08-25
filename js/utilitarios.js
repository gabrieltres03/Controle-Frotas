function confirmarAcao({ titulo = "Confirmar", mensagem = "", textoConfirmar = "Confirmar", perigo = true }) {
  return new Promise((resolve) => {
    let overlay = document.getElementById("folhaConfirmacaoGlobal");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "folhaConfirmacaoGlobal";
      overlay.className = "folha";
      overlay.innerHTML = `
        <div class="folha-conteudo">
          <div class="folha-cabecalho">
            <h2 id="tituloConfirmacaoGlobal"></h2>
            <button class="folha-fechar" id="fecharConfirmacaoGlobal">&times;</button>
          </div>
          <div class="folha-corpo">
            <p id="mensagemConfirmacaoGlobal" style="font-size:13.5px; color:var(--texto-secundario); line-height:1.5"></p>
          </div>
          <div class="folha-rodape">
            <button class="botao-linha" id="cancelarConfirmacaoGlobal" style="flex:1">Cancelar</button>
            <button id="confirmarConfirmacaoGlobal" style="flex:1"></button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    document.getElementById("tituloConfirmacaoGlobal").textContent = titulo;
    document.getElementById("mensagemConfirmacaoGlobal").textContent = mensagem;
    const botaoConfirmar = document.getElementById("confirmarConfirmacaoGlobal");
    botaoConfirmar.textContent = textoConfirmar;
    botaoConfirmar.className = perigo ? "botao-perigo" : "botao-primario";
    botaoConfirmar.style.flex = "1";

    overlay.classList.add("aberta");

    const cancelarBtn = document.getElementById("cancelarConfirmacaoGlobal");
    const fecharBtn = document.getElementById("fecharConfirmacaoGlobal");

    function finalizar(resultado) {
      overlay.classList.remove("aberta");
      botaoConfirmar.removeEventListener("click", aoConfirmar);
      cancelarBtn.removeEventListener("click", aoCancelar);
      fecharBtn.removeEventListener("click", aoCancelar);
      resolve(resultado);
    }
    function aoConfirmar() { finalizar(true); }
    function aoCancelar() { finalizar(false); }

    botaoConfirmar.addEventListener("click", aoConfirmar);
    cancelarBtn.addEventListener("click", aoCancelar);
    fecharBtn.addEventListener("click", aoCancelar);
  });
}

function avisar(titulo, mensagem) {
  let overlay = document.getElementById("folhaAvisoGlobal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "folhaAvisoGlobal";
    overlay.className = "folha";
    overlay.innerHTML = `
      <div class="folha-conteudo">
        <div class="folha-cabecalho">
          <h2 id="tituloAvisoGlobal"></h2>
          <button class="folha-fechar" id="fecharAvisoGlobal">&times;</button>
        </div>
        <div class="folha-corpo">
          <p id="mensagemAvisoGlobal" style="font-size:13.5px; color:var(--texto-secundario); line-height:1.5"></p>
        </div>
        <div class="folha-rodape">
          <button class="botao-primario" id="okAvisoGlobal" style="flex:1">Entendi</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("okAvisoGlobal").addEventListener("click", () => overlay.classList.remove("aberta"));
    document.getElementById("fecharAvisoGlobal").addEventListener("click", () => overlay.classList.remove("aberta"));
  }
  document.getElementById("tituloAvisoGlobal").textContent = titulo;
  document.getElementById("mensagemAvisoGlobal").textContent = mensagem;
  overlay.classList.add("aberta");
}

function gerarSufixoUnico() {
  return Date.now().toString(36).slice(-4).toUpperCase();
}

function capitalizarNome(texto) {
  return texto.toLowerCase().replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase());
}

function ativarCapitalizacaoAutomatica(input) {
  input.addEventListener("input", () => {
    const posicaoCursor = input.selectionStart;
    input.value = capitalizarNome(input.value);
    input.setSelectionRange(posicaoCursor, posicaoCursor);
  });
}

function ativarMaiusculasAutomaticas(input) {
  input.addEventListener("input", () => {
    const posicaoCursor = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(posicaoCursor, posicaoCursor);
  });
}

function formatarNumeroBR(valorNumerico) {
  return (valorNumerico || 0).toLocaleString("pt-BR");
}

function lerNumeroBR(valorFormatado) {
  if (!valorFormatado) return 0;
  return parseFloat(valorFormatado.replace(/\./g, "").replace(",", ".")) || 0;
}

function ativarMascaraNumerica(input) {
  input.addEventListener("input", () => {
    let bruto = input.value.replace(/[^\d,]/g, "");
    const partes = bruto.split(",");
    let inteiro = partes[0].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let resultado = inteiro + (partes.length > 1 ? "," + partes[1].slice(0, 2) : "");
    input.value = resultado;
    input.setSelectionRange(input.value.length, input.value.length);
  });
}
