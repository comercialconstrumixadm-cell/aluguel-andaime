import type { Config, Produto } from './types'

export const CLAUSULAS_PADRAO = `1. O LOCATÁRIO recebe os equipamentos descritos neste contrato em perfeito estado de conservação e funcionamento, comprometendo-se a devolvê-los nas mesmas condições.
2. O aluguel é cobrado por dia, com pagamento adiantado referente ao período contratado. Caso os equipamentos sejam devolvidos após a data prevista, os dias excedentes serão cobrados pelo mesmo valor diário.
3. A prorrogação do prazo deve ser comunicada ao LOCADOR antes da data prevista de devolução.
4. Os equipamentos devem ser utilizados exclusivamente no endereço da obra informado, sendo proibida a sublocação ou o empréstimo a terceiros.
5. Peças danificadas, perdidas, furtadas ou não devolvidas serão cobradas do LOCATÁRIO, podendo o valor ser abatido da caução.
6. A caução, quando houver, será devolvida ao final da locação, descontados os valores de peças danificadas ou perdidas e eventuais débitos.
7. O LOCATÁRIO é responsável pela montagem, uso e desmontagem seguros dos equipamentos, observando as normas de segurança do trabalho.
8. Fica eleito o foro da comarca de {cidade} para dirimir quaisquer dúvidas oriundas deste contrato.`

export const MENSAGEM_COBRANCA_PADRAO =
  'Olá, {cliente}! Passando para lembrar que o aluguel do pedido nº {numero} estava previsto para devolução em {data_prevista}. Valor em aberto até hoje: {saldo}. Qualquer dúvida estou à disposição.'

export function configPadrao(): Config {
  return {
    id: 'geral',
    locador_nome: '',
    locador_documento: '',
    locador_endereco: '',
    locador_telefone: '',
    cidade: '',
    contrato_clausulas: CLAUSULAS_PADRAO,
    mensagem_cobranca: MENSAGEM_COBRANCA_PADRAO,
  }
}

export function produtosIniciais(): Produto[] {
  const agora = new Date().toISOString()
  const base = { unidade: 'peça', quantidade_total: 0, quantidade_manutencao: 0, valor_reposicao: 0, faixas_qtd: [], ativo: true, created_at: agora }
  return [
    {
      ...base,
      id: crypto.randomUUID(),
      nome: 'Perna de andaime',
      faixas_dias: [
        { dias_min: 1, valor_dia: 2 },
        { dias_min: 16, valor_dia: 1.2 },
      ],
    },
    { ...base, id: crypto.randomUUID(), nome: 'Roldana', faixas_dias: [] },
    { ...base, id: crypto.randomUUID(), nome: 'Piso', faixas_dias: [] },
  ]
}
