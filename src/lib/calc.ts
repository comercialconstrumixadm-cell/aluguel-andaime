import { arred, diffDias } from './format'
import type { Devolucao, Pagamento, Pedido, Produto } from './types'

/** Valor da diária de uma peça para um aluguel de `dias` dias e `quantidade` peças. */
export function precoDia(produto: Produto, dias: number, quantidade: number): number {
  const faixasDias = [...produto.faixas_dias].sort((a, b) => a.dias_min - b.dias_min)
  if (!faixasDias.length) return 0
  let base = faixasDias[0].valor_dia
  for (const f of faixasDias) if (dias >= f.dias_min) base = f.valor_dia

  let desconto = 0
  for (const f of [...produto.faixas_qtd].sort((a, b) => a.qtd_min - b.qtd_min)) {
    if (quantidade >= f.qtd_min) desconto = f.desconto_pct
  }
  return arred(base * (1 - desconto / 100))
}

/** Dias contratados: da saída até a devolução prevista (mínimo 1). */
export function diasContratados(pedido: Pick<Pedido, 'data_saida' | 'data_prevista'>): number {
  return Math.max(1, diffDias(pedido.data_saida, pedido.data_prevista))
}

export type StatusPedido = 'agendado' | 'ativo' | 'parcial' | 'devolvido' | 'finalizado' | 'cancelado'

export const NOMES_STATUS: Record<StatusPedido, string> = {
  agendado: 'Agendado',
  ativo: 'Com o cliente',
  parcial: 'Devolvido em parte',
  devolvido: 'Devolvido (pendência financeira)',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

export interface ItemResumo {
  produto_id: string
  quantidade: number
  valor_dia: number
  devolvidas: number
  pendentes: number
}

export interface ResumoPedido {
  dias: number
  itens: ItemResumo[]
  aluguel: number
  diasAtraso: number
  atraso: number
  frete: number
  desconto: number
  avarias: number
  total: number
  pago: number
  caucaoRecebida: number
  caucaoAbatida: number
  caucaoDevolvida: number
  caucaoADevolver: number
  saldo: number
  pecasPendentes: number
  atrasado: boolean
  status: StatusPedido
}

/**
 * Calcula todos os valores de um pedido na data `ref`.
 * - O aluguel combinado é cobrado adiantado (quantidade × diária × dias contratados).
 * - Peças devolvidas depois da data prevista, ou ainda com o cliente, pagam os dias extras.
 * - Peças danificadas/perdidas são cobradas e abatidas da caução recebida.
 */
export function resumoPedido(
  pedido: Pedido,
  devolucoes: Devolucao[],
  pagamentos: Pagamento[],
  ref: string,
): ResumoPedido {
  const devs = devolucoes.filter((d) => d.pedido_id === pedido.id)
  const pags = pagamentos.filter((p) => p.pedido_id === pedido.id)
  const dias = diasContratados(pedido)

  let aluguel = 0
  let atraso = 0
  let pecasPendentes = 0
  const itens: ItemResumo[] = pedido.itens.map((item) => {
    aluguel += item.quantidade * item.valor_dia * dias
    let devolvidas = 0
    for (const d of devs) {
      for (const di of d.itens) {
        if (di.produto_id !== item.produto_id) continue
        const qtd = di.ok + di.danificada + di.perdida
        devolvidas += qtd
        const extra = diffDias(pedido.data_prevista, d.data)
        if (extra > 0) atraso += qtd * item.valor_dia * extra
      }
    }
    const pendentes = Math.max(0, item.quantidade - devolvidas)
    pecasPendentes += pendentes
    return { ...item, devolvidas, pendentes }
  })

  const diasAtraso = pecasPendentes > 0 ? Math.max(0, diffDias(pedido.data_prevista, ref)) : 0
  if (!pedido.cancelado) {
    for (const it of itens) atraso += it.pendentes * it.valor_dia * diasAtraso
  }

  let avarias = 0
  for (const d of devs) {
    for (const di of d.itens) avarias += di.danificada * di.valor_danificada + di.perdida * di.valor_perdida
  }

  const soma = (tipo: Pagamento['tipo']) => pags.filter((p) => p.tipo === tipo).reduce((s, p) => s + p.valor, 0)
  const pago = soma('aluguel')
  const caucaoRecebida = soma('caucao_recebida')
  const caucaoDevolvida = soma('caucao_devolvida')

  if (pedido.cancelado) {
    aluguel = 0
    atraso = 0
  }
  const frete = pedido.cancelado ? 0 : pedido.valor_frete
  const desconto = pedido.cancelado ? 0 : pedido.desconto
  const total = arred(aluguel + atraso + frete - desconto + avarias)
  const caucaoAbatida = arred(Math.min(caucaoRecebida, avarias))
  const saldo = arred(total - pago - caucaoAbatida)
  const caucaoADevolver = arred(caucaoRecebida - caucaoAbatida - caucaoDevolvida)
  const atrasado = !pedido.cancelado && pecasPendentes > 0 && diasAtraso > 0

  let status: StatusPedido
  if (pedido.cancelado) status = 'cancelado'
  else if (pecasPendentes === 0) status = saldo > 0.009 || caucaoADevolver > 0.009 ? 'devolvido' : 'finalizado'
  else if (pecasPendentes < itens.reduce((s, i) => s + i.quantidade, 0)) status = 'parcial'
  else if (pedido.data_saida > ref) status = 'agendado'
  else status = 'ativo'

  return {
    dias,
    itens,
    aluguel: arred(aluguel),
    diasAtraso,
    atraso: arred(atraso),
    frete,
    desconto,
    avarias: arred(avarias),
    total,
    pago: arred(pago),
    caucaoRecebida: arred(caucaoRecebida),
    caucaoAbatida,
    caucaoDevolvida: arred(caucaoDevolvida),
    caucaoADevolver,
    saldo,
    pecasPendentes,
    atrasado,
    status,
  }
}

export interface LinhaEstoque {
  produto: Produto
  total: number
  manutencao: number
  alugado: number
  disponivel: number
}

/** Peças com clientes, por produto. `ignorarPedido` permite descontar o próprio pedido ao editá-lo. */
export function pecasAlugadas(pedidos: Pedido[], devolucoes: Devolucao[], ignorarPedido?: string): Map<string, number> {
  const mapa = new Map<string, number>()
  const ativos = new Set<string>()
  for (const p of pedidos) {
    if (p.cancelado || p.id === ignorarPedido) continue
    ativos.add(p.id)
    for (const i of p.itens) mapa.set(i.produto_id, (mapa.get(i.produto_id) ?? 0) + i.quantidade)
  }
  for (const d of devolucoes) {
    if (!ativos.has(d.pedido_id)) continue
    for (const di of d.itens) {
      mapa.set(di.produto_id, (mapa.get(di.produto_id) ?? 0) - (di.ok + di.danificada + di.perdida))
    }
  }
  return mapa
}

export function estoque(produtos: Produto[], pedidos: Pedido[], devolucoes: Devolucao[], ignorarPedido?: string): LinhaEstoque[] {
  const alugadas = pecasAlugadas(pedidos, devolucoes, ignorarPedido)
  return produtos.map((produto) => {
    const alugado = Math.max(0, alugadas.get(produto.id) ?? 0)
    return {
      produto,
      total: produto.quantidade_total,
      manutencao: produto.quantidade_manutencao,
      alugado,
      disponivel: produto.quantidade_total - produto.quantidade_manutencao - alugado,
    }
  })
}
