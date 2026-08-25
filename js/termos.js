const CHAVE_ACEITE = "frota_termos_aceitos_v1";

const textoTermosUso = `
  <h3>1. Objeto</h3>
  <p>Este aplicativo é fornecido pela Tres Business &amp; Tech LTDA, com sede em Toledo, Paraná, para uso exclusivo dos clientes contratantes do serviço de controle de frota, pneus e abastecimento.</p>
  <h3>2. Acesso</h3>
  <p>O acesso é individual, feito por login e PIN pessoal. O usuário é responsável por manter seu PIN em sigilo e por qualquer lançamento feito com seu login.</p>
  <h3>3. Uso das informações</h3>
  <p>Os dados lançados (quilometragem, abastecimentos, movimentações de pneus e ferramentas) pertencem à empresa contratante e são usados exclusivamente para gestão interna da frota.</p>
  <h3>4. Responsabilidades</h3>
  <p>O usuário se compromete a lançar informações corretas. A Tres Business &amp; Tech não se responsabiliza por decisões tomadas com base em dados lançados incorretamente pelos usuários.</p>
  <h3>5. Disponibilidade</h3>
  <p>O aplicativo funciona parcialmente offline, sincronizando os dados quando houver conexão. A empresa não se responsabiliza por perda de dados em caso de desinstalação do aplicativo antes da sincronização.</p>
`;

const textoLicenca = `
  <h3>1. Titularidade</h3>
  <p>Este software é de propriedade da Tres Business &amp; Tech LTDA, sendo licenciado ao cliente para uso, não constituindo venda, cessão ou transferência de direitos autorais.</p>
  <h3>2. Escopo da licença</h3>
  <p>A licença concede direito de uso não exclusivo e intransferível, limitado ao número de usuários e dispositivos contratados.</p>
  <h3>3. Restrições</h3>
  <p>É proibido copiar, modificar, descompilar ou redistribuir o software, total ou parcialmente, sem autorização expressa da Tres Business &amp; Tech LTDA.</p>
  <h3>4. Vigência</h3>
  <p>A licença permanece válida enquanto durar o contrato de manutenção mensal firmado com a empresa contratante, podendo ser suspensa em caso de inadimplência.</p>
`;

function abrirTermos(tipo) {
  const titulo = document.getElementById("tituloModal");
  const corpo = document.getElementById("corpoModal");
  const rodape = document.getElementById("rodapeModal");
  const sobreposicao = document.getElementById("sobreposicaoTermos");

  titulo.textContent = tipo === "licenca" ? "Licença de uso" : "Termos de uso";
  corpo.innerHTML = tipo === "licenca" ? textoLicenca : textoTermosUso;
  rodape.innerHTML = "";
  document.querySelector(".modal-fechar").style.display = "inline-block";

  sobreposicao.classList.add("aberta");
}

function fecharTermos() {
  document.getElementById("sobreposicaoTermos").classList.remove("aberta");
}

function exigirAceiteInicial() {
  const jaAceitou = localStorage.getItem(CHAVE_ACEITE);
  if (jaAceitou) return;

  const titulo = document.getElementById("tituloModal");
  const corpo = document.getElementById("corpoModal");
  const rodape = document.getElementById("rodapeModal");
  const sobreposicao = document.getElementById("sobreposicaoTermos");

  titulo.textContent = "Antes de continuar";
  corpo.innerHTML = textoTermosUso + textoLicenca;
  document.querySelector(".modal-fechar").style.display = "none";

  rodape.innerHTML = `
    <label>
      <input type="checkbox" id="checkAceite" onchange="alternarBotaoAceite()" />
      Li e aceito os termos de uso e a licença de uso do sistema.
    </label>
    <button class="botao-aceitar" id="botaoAceitar" disabled onclick="confirmarAceite()">Aceitar e continuar</button>
  `;

  sobreposicao.classList.add("aberta");
}

function alternarBotaoAceite() {
  const marcado = document.getElementById("checkAceite").checked;
  document.getElementById("botaoAceitar").disabled = !marcado;
}

function confirmarAceite() {
  localStorage.setItem(CHAVE_ACEITE, "1");
  fecharTermos();
}

document.addEventListener("DOMContentLoaded", exigirAceiteInicial);
