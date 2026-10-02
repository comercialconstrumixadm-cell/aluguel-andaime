import { useMemo } from 'react'
import { resumoPedido, type ResumoPedido } from './calc'
import { hoje, linkWhatsApp, moeda, dataBR } from './format'
import { useStore } from './store'
import type { Cliente, Config, Pedido } from './types'

export interface PedidoComResumo {
  pedido: Pedido
  cliente: Cliente | undefined
  resumo: ResumoPedido
}

/** Todos os pedidos com cliente e valores calculados, do mais recente para o mais antigo. */
export function usePedidos(): PedidoComResumo[] {
  const { dados } = useStore()
  return useMemo(() => {
    const ref = hoje()
    const clientes = new Map(dados.clientes.map((c) => [c.id, c]))
    return [...dados.pedidos]
      .sort((a, b) => b.numero - a.numero)
      .map((pedido) => ({
        pedido,
        cliente: clientes.get(pedido.cliente_id),
        resumo: resumoPedido(pedido, dados.devolucoes, dados.pagamentos, ref),
      }))
  }, [dados.pedidos, dados.clientes, dados.devolucoes, dados.pagamentos])
}

export function whatsCobranca(config: Config, { pedido, cliente, resumo }: PedidoComResumo): string {
  const vars: Record<string, string> = {
    cliente: cliente?.nome.split(' ')[0] ?? '',
    numero: String(pedido.numero),
    data_prevista: dataBR(pedido.data_prevista),
    saldo: moeda(Math.max(0, resumo.saldo)),
    pecas: String(resumo.pecasPendentes),
  }
  const texto = config.mensagem_cobranca.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
  return linkWhatsApp(cliente?.telefone ?? '', texto)
}
