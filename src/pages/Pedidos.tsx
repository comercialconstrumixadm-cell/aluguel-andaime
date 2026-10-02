import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cabecalho, StatusTag } from '../components/ui'
import { dataBR, moeda } from '../lib/format'
import { usePedidos, type PedidoComResumo } from '../lib/hooks'

type Filtro = 'abertos' | 'atrasados' | 'pagar' | 'finalizados' | 'todos'

const FILTROS: { id: Filtro; nome: string; teste: (p: PedidoComResumo) => boolean }[] = [
  { id: 'abertos', nome: 'Com o cliente', teste: (p) => !p.pedido.cancelado && p.resumo.pecasPendentes > 0 },
  { id: 'atrasados', nome: 'Atrasados', teste: (p) => p.resumo.atrasado },
  { id: 'pagar', nome: 'Pendência financeira', teste: (p) => !p.pedido.cancelado && (p.resumo.saldo > 0.009 || p.resumo.caucaoADevolver > 0.009) },
  { id: 'finalizados', nome: 'Finalizados', teste: (p) => p.resumo.status === 'finalizado' },
  { id: 'todos', nome: 'Todos', teste: () => true },
]

export default function Pedidos() {
  const pedidos = usePedidos()
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [busca, setBusca] = useState('')

  const lista = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)!
    const termo = busca.trim().toLowerCase()
    return pedidos.filter(
      (p) => f.teste(p) && (!termo || String(p.pedido.numero) === termo.replace('#', '') || (p.cliente?.nome.toLowerCase().includes(termo) ?? false)),
    )
  }, [pedidos, filtro, busca])

  return (
    <>
      <Cabecalho titulo="Pedidos">
        <Link className="btn primario" to="/pedidos/novo">+ Novo pedido</Link>
      </Cabecalho>

      <div className="card">
        <div className="opcoes" style={{ marginBottom: '.75rem' }}>
          {FILTROS.map((f) => (
            <button key={f.id} className={`opcao ${filtro === f.id ? 'marcada' : ''}`} onClick={() => setFiltro(f.id)}>
              {f.nome} ({pedidos.filter(f.teste).length})
            </button>
          ))}
        </div>
        <input placeholder="Buscar por nº do pedido ou nome do cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="card">
        {lista.length === 0 ? (
          <div className="vazio">Nenhum pedido aqui.</div>
        ) : (
          <>
            <div className="tabela-wrap so-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Nº</th><th>Cliente</th><th>Saída</th><th>Devolução</th><th>Situação</th>
                    <th className="num">Total</th><th className="num">Em aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.pedido.id} className="clicavel" onClick={() => navegar(`/pedidos/${p.pedido.id}`)}>
                      <td><strong>#{p.pedido.numero}</strong></td>
                      <td>{p.cliente?.nome ?? '-'}</td>
                      <td>{dataBR(p.pedido.data_saida)}</td>
                      <td>{dataBR(p.pedido.data_prevista)}</td>
                      <td><StatusTag resumo={p.resumo} /></td>
                      <td className="num">{moeda(p.resumo.total)}</td>
                      <td className={`num ${p.resumo.saldo > 0.009 ? 'vermelho' : ''}`}>{p.resumo.saldo > 0.009 ? moeda(p.resumo.saldo) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lista-movel">
              {lista.map((p) => (
                <Link key={p.pedido.id} to={`/pedidos/${p.pedido.id}`} className="item-lista">
                  <div className="linha1"><span>#{p.pedido.numero} · {p.cliente?.nome ?? '-'}</span></div>
                  <div style={{ margin: '.3rem 0' }}><StatusTag resumo={p.resumo} /></div>
                  <div className="linha2">
                    <span>{dataBR(p.pedido.data_saida)} → {dataBR(p.pedido.data_prevista)}</span>
                    <span className={p.resumo.saldo > 0.009 ? 'vermelho' : ''}>
                      {p.resumo.saldo > 0.009 ? `Em aberto ${moeda(p.resumo.saldo)}` : moeda(p.resumo.total)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
