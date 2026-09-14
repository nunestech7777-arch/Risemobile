// RISEMOBILE: Real-time USD/BRL exchange rate (AwesomeAPI)
const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

export async function fetchUsdToBrlRate() {
  const response = await fetch(AWESOME_API_URL);
  if (!response.ok) {
    throw new Error(`Falha ao consultar cotação (HTTP ${response.status})`);
  }

  const data = await response.json();
  const rate = Number(data?.USDBRL?.bid);

  if (!rate || Number.isNaN(rate)) {
    throw new Error('Resposta inválida da API de câmbio');
  }

  return rate;
}
