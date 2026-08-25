let perfilAtual = "motorista";
let pinDigitado = "";

function selecionarPerfil(perfil) {
  perfilAtual = perfil;
  pinDigitado = "";
  atualizarPontosPin();

  document.querySelectorAll(".aba-perfil").forEach((aba) => {
    aba.classList.toggle("ativa", aba.dataset.perfil === perfil);
  });

  document.getElementById("blocoMotorista").style.display =
    perfil === "motorista" ? "block" : "none";
}

function digitarPin(numero) {
  if (pinDigitado.length >= 6) return;
  pinDigitado += numero;
  atualizarPontosPin();

  if (pinDigitado.length === 6) {
    setTimeout(verificarLogin, 150);
  }
}

function apagarPin() {
  pinDigitado = pinDigitado.slice(0, -1);
  atualizarPontosPin();
}

function atualizarPontosPin() {
  const pontos = document.querySelectorAll("#pinPontos span");
  pontos.forEach((ponto, i) => {
    ponto.classList.toggle("preenchido", i < pinDigitado.length);
  });
  document.getElementById("mensagemErro").textContent = "";
}

function mostrarErroPin(mensagem) {
  document.getElementById("mensagemErro").textContent = mensagem;
  const pontos = document.getElementById("pinPontos");
  pontos.classList.add("erro");
  setTimeout(() => pontos.classList.remove("erro"), 300);
  pinDigitado = "";
  atualizarPontosPin();
}

async function verificarLogin() {
  if (perfilAtual === "motorista") {
    const nomeMotorista = document.getElementById("selectMotorista").value;
    if (!nomeMotorista) {
      mostrarErroPin("Selecione o motorista antes de digitar o PIN");
      return;
    }
    await autenticarMotorista(nomeMotorista, pinDigitado);
  } else {
    await autenticarAdmin(pinDigitado);
  }
}

async function carregarMotoristas() {
  const select = document.getElementById("selectMotorista");
  try {
    const motoristas = await buscarMotoristasAtivos();
    motoristas.forEach((m) => {
      const opcao = document.createElement("option");
      opcao.value = m.id;
      opcao.textContent = m.nome;
      select.appendChild(opcao);
    });
  } catch (erro) {
    console.error("Falha ao carregar motoristas", erro);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  selecionarPerfil("motorista");
  carregarMotoristas();
});
