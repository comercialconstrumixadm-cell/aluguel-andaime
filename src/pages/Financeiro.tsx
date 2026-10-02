import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/ui'
import { FORMAS, dataBR, hoje, moeda } from '../lib/format'
import { usePedidos, whatsCobranca } from '../lib/hooks'
import { useStore } from '../lib/store'

export default function Financeiro() {
  const { dados, config } = useStore()
  const pedidos = usePedidos()
  const [mes, setMes] = useState(hoje().slice(0, 7))

  const doMes = dados.pagamentos.filter((p) => p.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data))
  const recebido = doMes.filter((p) => p.tipo === 'aluguel').reduce((s, p) => s + p.valor, 0)
  const porForma = FORMAS.map((f) => ({
    ...f,
    total: doMes.filter((p) => p.tipo === 'aluguel' && p.forma === f.id).reduce((s, p) => s + p.valor, 0),
  })).filter((f) => f.total > 0)

  const emAberto = pedidos.filter((p) => !p.pedido.cancelado && p.resumo.saldo > 0.009)
  const aReceber = emAberto.reduce((s, p) => s + p.resumo.saldo, 0)
  const caucoesEmMaos = pedidos.filter((p) => !p.pedido.cancelado).reduce((s, p) => s + Math.max(0, p.resumo.caucaoADevolver), 0)
  const caucoesDevolver = pedidos.filter((p) => p.resumo.pecasPendentes === 0 && p.resumo.caucaoADevolver > 0.009)
  const pedidoDe = (id: string) => pedidos.find((p) => p.pedido.id === id)

  return (
    <>
      <Cabecalho titulo="Financeiro">
        <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ width: 'auto' }} />
      </Cabecalho>

      <div className="grade grade-3">
        <div className="indicador positivo">
          <div className="rotulo">Recebido no mês</div>
          <div className="valor">{moeda(recebido)}</div>
        </div>
        <div className={`indicador ${aReceber > 0 ? 'alerta' : ''}`}>
          <div className="rotulo">A receber (todos os pedidos)</div>
          <div className="valor">{moeda(aReceber)}</div>
        </div>
        <div className="indicador">
          <div className="rotulo">Cauções em mãos</div>
          <div className="valor">{moeda(caucoesEmMaos)}</div>
        </div>
      </div>

      {porForma.length > 0 && (
        <div className="card">
          <h2>Recebido por forma de pagamento</h2>
          <div className="resumo-valores" style={{ maxWidth: 360 }}>
            {porForma.map((f) => (<Fragment key={f.id}><span>{f.nome}</span><span>{moeda(f.total)}</span></Fragment>))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Clientes com valor em aberto</h2>
        {emAberto.length === 0 ? (
          <div className="suave">Ninguém devendo. 👍</div>
        ) : (
          emAberto.map((p) => (
            <div key={p.pedido.id} className="item-lista" style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center' }}>
              <Link to={`/pedidos/${p.pedido.id}`} style={{ color: 'inherit', textDecoration: 'none', flex: 1 }}>
                <div className="linha1"><span>#{p.pedido.numero} · {p.cliente?.nome}</span><span className="vermelho">{moeda(p.resumo.saldo)}</span></div>
                <div className="linha2">
                  <span>Devolução {dataBR(p.pedido.data_prevista)}{p.resumo.atrasado ? ` · atrasado ${p.resumo.diasAtraso}d` : ''}</span>
                </div>
              </Link>
              {p.cliente?.telefone && <a className="btn whats pequeno" href={whatsCobranca(config, p)} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          ))
        )}
      </div>

      {caucoesDevolver.length > 0 && (
        <div className="card">
          <h2>Cauções a devolver</h2>
          {caucoesDevolver.map((p) => (
            <Link key={p.pedido.id} to={`/pedidos/${p.pedido.id}`} className="item-lista">
              <div className="linha1"><span>#{p.pedido.numero} · {p.cliente?.nome}</span><span>{moeda(p.resumo.caucaoADevolver)}</span></div>
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Movimentações do mês</h2>
        {doMes.length === 0 ? (
          <div className="suave">Nenhuma movimentação neste mês.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Data</th><th>Pedido</th><th>Tipo</th><th>Forma</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {doMes.map((p) => {
                  const ped = pedidoDe(p.pedido_id)
                  const saida = p.tipo === 'caucao_devolvida'
                  return (
                    <tr key={p.id}>
                      <td>{dataBR(p.data)}</td>
                      <td>{ped ? <Link to={`/pedidos/${p.pedido_id}`}>#{ped.pedido.numero} · {ped.cliente?.nome}</Link> : '-'}</td>
                      <td>{p.tipo === 'aluguel' ? 'Pagamento' : p.tipo === 'caucao_recebida' ? 'Caução recebida' : 'Caução devolvida'}</td>
                      <td>{FORMAS.find((f) => f.id === p.forma)?.nome}</td>
                      <td className={`num ${saida ? 'vermelho' : ''}`}>{saida ? '- ' : ''}{moeda(p.valor)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
