export interface FaixaDias {
  dias_min: number
  valor_dia: number
}

export interface FaixaQtd {
  qtd_min: number
  desconto_pct: number
}

export interface Produto {
  id: string
  nome: string
  unidade: string
  quantidade_total: number
  quantidade_manutencao: number
  valor_reposicao: number
  faixas_dias: FaixaDias[]
  faixas_qtd: FaixaQtd[]
  ativo: boolean
  created_at: string
}

export interface Cliente {
  id: string
  nome: string
  cpf_cnpj: string
  telefone: string
  endereco: string
  observacoes: string
  created_at: string
}

export interface PedidoItem {
  produto_id: string
  quantidade: number
  valor_dia: number
}

export type TipoEntrega = 'retirada' | 'frete'

export interface Pedido {
  id: string
  numero: number
  cliente_id: string
  endereco_obra: string
  data_saida: string
  data_prevista: string
  entrega: TipoEntrega
  valor_frete: number
  caucao: number
  desconto: number
  observacoes: string
  cancelado: boolean
  itens: PedidoItem[]
  created_at: string
}

export interface DevolucaoItem {
  produto_id: string
  ok: number
  danificada: number
  perdida: number
  valor_danificada: number
  valor_perdida: number
}

export interface Devolucao {
  id: string
  pedido_id: string
  data: string
  itens: DevolucaoItem[]
  observacoes: string
  created_at: string
}

export type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro'
export type TipoPagamento = 'aluguel' | 'caucao_recebida' | 'caucao_devolvida'

export interface Pagamento {
  id: string
  pedido_id: string
  data: string
  valor: number
  forma: FormaPagamento
  tipo: TipoPagamento
  observacoes: string
  created_at: string
}

export interface Config {
  id: string
  locador_nome: string
  locador_documento: string
  locador_endereco: string
  locador_telefone: string
  cidade: string
  contrato_clausulas: string
  mensagem_cobranca: string
}

export interface Tabelas {
  produtos: Produto
  clientes: Cliente
  pedidos: Pedido
  devolucoes: Devolucao
  pagamentos: Pagamento
  configuracoes: Config
}

export type NomeTabela = keyof Tabelas
