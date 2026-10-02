import { Link } from 'react-router-dom'
import { estoque } from '../lib/calc'
import { dataBR, diffDias, hoje, moeda } from '../lib/format'
import { usePedidos, whatsCobranca, type PedidoComResumo } from '../lib/hooks'
import { useStore } from '../lib/store'
import { Cabecalho, StatusTag } from '../components/ui'

export default function Painel() {
  const { dados, config } = useStore()
  const pedidos = usePedidos()
  const ref = hoje()

  const abertos = pedidos.filter((p) => !p.pedido.cancelado && p.resumo.pecasPendentes > 0)
  const atrasados = abertos.filter((p) => p.resumo.atrasado)
  const vencendo = abertos.filter((p) => {
    const d = diffDias(ref, p.pedido.data_prevista)
    return d >= 0 && d <= 3
  })
  const emAberto = pedidos.filter((p) => !p.pedido.cancelado && p.resumo.saldo > 0.009)
  const caucoes = pedidos.filter((p) => p.resumo.pecasPendentes === 0 && p.resumo.caucaoADevolver > 0.009)
  const totalAberto = emAberto.reduce((s, p) => s + p.resumo.saldo, 0)
  const linhas = estoque(dados.produtos.filter((p) => p.ativo), dados.pedidos, dados.devolucoes)

  return (
    <>
      <Cabecalho titulo="Painel">
        <Link className="btn primario" to="/pedidos/novo">+ Novo pedido</Link>
      </Cabecalho>

      <div className="grade grade-4">
        <div className={`indicador ${atrasados.length ? 'alerta' : 'positivo'}`}>
          <div className="rotulo">Devoluções atrasadas</div>
          <div className="valor">{atrasados.length}</div>
        </div>
        <div className={`indicador ${vencendo.length ? 'atencao' : ''}`}>
          <div className="rotulo">Vencem em até 3 dias</div>
          <div className="valor">{vencendo.length}</div>
        </div>
        <div className="indicador">
          <div className="rotulo">Aluguéis ativos</div>
          <div className="valor">{abertos.length}</div>
        </div>
        <div className={`indicador ${totalAberto > 0 ? 'atencao' : 'positivo'}`}>
          <div className="rotulo">A receber</div>
          <div className="valor">{moeda(totalAberto)}</div>
        </div>
      </div>

      <ListaAlerta
        titulo="🚨 Devoluções atrasadas"
        itens={atrasados}
        vazio="Nenhuma devolução atrasada."
        detalhe={(p) => `Venceu em ${dataBR(p.pedido.data_prevista)} · ${p.resumo.pecasPendentes} peças com o cliente · em aberto ${moeda(Math.max(0, p.resumo.saldo))}`}
        whats={(p) => whatsCobranca(config, p)}
      />

      <ListaAlerta
        titulo="⏰ Vencem nos próximos dias"
        itens={vencendo}
        vazio="Nenhum aluguel vencendo nos próximos 3 dias."
        detalhe={(p) => {
          const d = diffDias(ref, p.pedido.data_prevista)
          return `${d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`} (${dataBR(p.pedido.data_prevista)}) · ${p.resumo.pecasPendentes} peças`
        }}
      />

      {emAberto.length > 0 && (
        <ListaAlerta
          titulo="💰 Pagamentos em aberto"
          itens={emAberto}
          vazio=""
          detalhe={(p) => `Em aberto: ${moeda(p.resumo.saldo)}`}
          whats={(p) => whatsCobranca(config, p)}
        />
      )}

      {caucoes.length > 0 && (
        <ListaAlerta
          titulo="🔁 Cauções a devolver"
          itens={caucoes}
          vazio=""
          detalhe={(p) => `Devolver ao cliente: ${moeda(p.resumo.caucaoADevolver)}`}
        />
      )}

      <div className="card">
        <div className="cabecalho" style={{ marginBottom: '.5rem' }}>
          <h2 style={{ margin: 0 }}>📦 Estoque</h2>
          <Link to="/estoque">Ver tudo</Link>
        </div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Item</th><th className="num">Disponível</th><th className="num">Alugado</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.produto.id}>
                  <td>{l.produto.nome}</td>
                  <td className={`num ${l.disponivel <= 0 ? 'vermelho' : 'verde'}`}><strong>{l.disponivel}</strong></td>
                  <td className="num">{l.alugado}</td>
                  <td className="num">{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ListaAlerta({ titulo, itens, vazio, detalhe, whats }: {
  titulo: string
  itens: PedidoComResumo[]
  vazio: string
  detalhe: (p: PedidoComResumo) => string
  whats?: (p: PedidoComResumo) => string
}) {
  return (
    <div className="card">
      <h2>{titulo}</h2>
      {itens.length === 0 ? (
        <div className="suave">{vazio}</div>
      ) : (
        itens.map((p) => (
          <div key={p.pedido.id} className="item-lista" style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center' }}>
            <Link to={`/pedidos/${p.pedido.id}`} style={{ color: 'inherit', textDecoration: 'none', flex: 1, minWidth: 0 }}>
              <div className="linha1" style={{ justifyContent: 'flex-start' }}>
                <span>#{p.pedido.numero} · {p.cliente?.nome ?? 'Cliente removido'}</span>
                <StatusTag resumo={p.resumo} />
              </div>
              <div className="linha2">{detalhe(p)}</div>
            </Link>
            {whats && p.cliente?.telefone && (
              <a className="btn whats pequeno" href={whats(p)} target="_blank" rel="noreferrer">WhatsApp</a>
            )}
          </div>
        ))
      )}
    </div>
  )
}
