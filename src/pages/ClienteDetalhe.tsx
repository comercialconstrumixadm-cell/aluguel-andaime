import { useState } from 'react'
import { avisar, confirmar } from '../components/dialogos'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ClienteForm from '../components/ClienteForm'
import { Cabecalho, StatusTag, mensagemErro } from '../components/ui'
import { dataBR, linkWhatsApp, moeda } from '../lib/format'
import { usePedidos } from '../lib/hooks'
import { useStore } from '../lib/store'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const { dados, excluir } = useStore()
  const navegar = useNavigate()
  const [editando, setEditando] = useState(false)
  const cliente = dados.clientes.find((c) => c.id === id)
  const pedidos = usePedidos().filter((p) => p.pedido.cliente_id === id)

  if (!cliente) return <div className="vazio">Cliente não encontrado. <Link to="/clientes">Voltar</Link></div>

  const emAberto = pedidos.filter((p) => !p.pedido.cancelado).reduce((s, p) => s + Math.max(0, p.resumo.saldo), 0)

  const remover = async () => {
    if (pedidos.length) {
      await avisar('Este cliente tem pedidos no histórico e não pode ser excluído.')
      return
    }
    if (!await confirmar(`Excluir o cliente ${cliente.nome}?`)) return
    try {
      await excluir('clientes', cliente.id)
      navegar('/clientes')
    } catch (e) {
      await avisar(mensagemErro(e))
    }
  }

  return (
    <>
      <p style={{ margin: '0 0 .5rem' }}><Link to="/clientes">← Clientes</Link></p>
      <Cabecalho titulo={cliente.nome}>
        <Link className="btn primario" to={`/pedidos/novo?cliente=${cliente.id}`}>+ Novo pedido</Link>
        {cliente.telefone && (
          <a className="btn whats" href={linkWhatsApp(cliente.telefone, `Olá, ${cliente.nome.split(' ')[0]}!`)} target="_blank" rel="noreferrer">WhatsApp</a>
        )}
        <button className="btn" onClick={() => setEditando(true)}>Editar</button>
        <button className="btn perigo" onClick={remover}>Excluir</button>
      </Cabecalho>

      <div className="grade grade-2">
        <div className="card">
          <h2>Dados</h2>
          <dl className="info-lista">
            <dt>CPF/CNPJ</dt><dd>{cliente.cpf_cnpj || '-'}</dd>
            <dt>Telefone</dt><dd>{cliente.telefone || '-'}</dd>
            <dt>Endereço</dt><dd>{cliente.endereco || '-'}</dd>
            {cliente.observacoes && (<><dt>Observações</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{cliente.observacoes}</dd></>)}
          </dl>
        </div>
        <div className="card">
          <h2>Resumo</h2>
          <dl className="info-lista">
            <dt>Pedidos</dt><dd>{pedidos.length}</dd>
            <dt>Ativos</dt><dd>{pedidos.filter((p) => p.resumo.pecasPendentes > 0 && !p.pedido.cancelado).length}</dd>
            <dt>Em aberto</dt><dd className={emAberto > 0 ? 'vermelho' : ''}><strong>{moeda(emAberto)}</strong></dd>
          </dl>
        </div>
      </div>

      <div className="card">
        <h2>Histórico de pedidos</h2>
        {pedidos.length === 0 ? (
          <div className="vazio">Nenhum pedido ainda.</div>
        ) : (
          pedidos.map((p) => (
            <Link key={p.pedido.id} to={`/pedidos/${p.pedido.id}`} className="item-lista">
              <div className="linha1"><span>Pedido #{p.pedido.numero}</span><StatusTag resumo={p.resumo} /></div>
              <div className="linha2">
                <span>{dataBR(p.pedido.data_saida)} a {dataBR(p.pedido.data_prevista)}</span>
                <span>Total {moeda(p.resumo.total)}{p.resumo.saldo > 0.009 ? ` · em aberto ${moeda(p.resumo.saldo)}` : ''}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {editando && <ClienteForm cliente={cliente} aoFechar={() => setEditando(false)} />}
    </>
  )
}
