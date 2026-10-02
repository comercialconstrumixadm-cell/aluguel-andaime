import { useEffect, useState } from 'react'
import { avisar, confirmar } from '../components/dialogos'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CampoNumero, Cabecalho, Modal, StatusTag, mensagemErro } from '../components/ui'
import { FORMAS, arred, dataBR, diffDias, hoje, moeda, somarDias } from '../lib/format'
import { usePedidos, whatsCobranca, type PedidoComResumo } from '../lib/hooks'
import { dentroDoClaude } from '../lib/db'
import type { DadosDoc } from '../lib/pdf'
import { agoraISO, novoId, useStore } from '../lib/store'
import type { Devolucao, DevolucaoItem, FormaPagamento, Pagamento, TipoPagamento } from '../lib/types'

const NOMES_TIPO: Record<TipoPagamento, string> = {
  aluguel: 'Pagamento',
  caucao_recebida: 'Caução recebida',
  caucao_devolvida: 'Caução devolvida',
}

// O gerador de PDF é carregado só quando necessário, para o app abrir mais rápido.
const carregarPdf = () => import('../lib/pdf')

const podeCompartilhar = !dentroDoClaude && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

export default function PedidoDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { dados, config, atualizar, excluir, excluirDevolucao } = useStore()
  const item = usePedidos().find((p) => p.pedido.id === id)
  const [modal, setModal] = useState<'devolucao' | 'pagamento' | 'prorrogar' | null>(null)
  useEffect(() => {
    void carregarPdf()
  }, [])

  if (!item || !item.cliente) return <div className="vazio">Pedido não encontrado. <Link to="/pedidos">Voltar</Link></div>
  const { pedido, cliente, resumo } = item
  const devolucoes = dados.devolucoes.filter((d) => d.pedido_id === pedido.id).sort((a, b) => a.data.localeCompare(b.data))
  const pagamentos = dados.pagamentos.filter((p) => p.pedido_id === pedido.id).sort((a, b) => a.data.localeCompare(b.data))
  const nomeProduto = (pid: string) => dados.produtos.find((p) => p.id === pid)?.nome ?? 'Produto removido'
  const docBase: DadosDoc = { pedido, cliente, produtos: dados.produtos, resumo, config }

  const pdf = async (tipo: 'contrato' | 'romaneio' | 'romaneio-devolucao' | 'recibo', compartilhar: boolean, pagamento?: Pagamento) => {
    const m = await carregarPdf()
    const doc =
      tipo === 'contrato'
        ? m.gerarContrato(docBase)
        : tipo === 'recibo'
          ? m.gerarRecibo(docBase, pagamento!)
          : m.gerarRomaneio(docBase, tipo === 'romaneio' ? 'saida' : 'devolucao')
    try {
      await m.entregarPdf(doc, tipo, pedido, cliente, compartilhar)
    } catch (e) {
      await avisar(mensagemErro(e))
    }
  }

  const tentar = async (acao: () => Promise<void>) => {
    try {
      await acao()
    } catch (e) {
      await avisar(mensagemErro(e))
    }
  }

  const alternarCancelado = () =>
    tentar(async () => {
      if (!pedido.cancelado && !await confirmar('Cancelar este pedido? As peças voltam para o estoque disponível.')) return
      await atualizar('pedidos', pedido.id, { cancelado: !pedido.cancelado })
    })

  const excluirPedido = () =>
    tentar(async () => {
      if (devolucoes.length || pagamentos.length) {
        await avisar('Este pedido tem pagamentos ou devoluções. Exclua-os antes ou use "Cancelar pedido".')
        return
      }
      if (!await confirmar(`Excluir o pedido #${pedido.numero} de vez?`)) return
      await excluir('pedidos', pedido.id)
      navegar('/pedidos', { replace: true })
    })

  return (
    <>
      <p style={{ margin: '0 0 .5rem' }}><Link to="/pedidos">← Pedidos</Link></p>
      <Cabecalho titulo={<>Pedido #{pedido.numero} <StatusTag resumo={resumo} /></>}>
        {!pedido.cancelado && resumo.pecasPendentes > 0 && (
          <button className="btn primario" onClick={() => setModal('devolucao')}>Registrar devolução</button>
        )}
        {!pedido.cancelado && <button className="btn" onClick={() => setModal('pagamento')}>Registrar pagamento</button>}
        {!pedido.cancelado && resumo.pecasPendentes > 0 && <button className="btn" onClick={() => setModal('prorrogar')}>Prorrogar</button>}
        <Link className="btn" to={`/pedidos/${pedido.id}/editar`}>Editar</Link>
      </Cabecalho>

      {resumo.atrasado && (
        <div className="aviso erro">
          Devolução atrasada há {resumo.diasAtraso} {resumo.diasAtraso === 1 ? 'dia' : 'dias'} ({resumo.pecasPendentes} peças com o cliente).
          {cliente.telefone && (
            <> <a className="btn whats pequeno" href={whatsCobranca(config, item)} target="_blank" rel="noreferrer">Cobrar no WhatsApp</a></>
          )}
        </div>
      )}

      <div className="grade grade-2">
        <div className="card">
          <h2>Cliente</h2>
          <dl className="info-lista">
            <dt>Nome</dt><dd><Link to={`/clientes/${cliente.id}`}>{cliente.nome}</Link></dd>
            <dt>CPF/CNPJ</dt><dd>{cliente.cpf_cnpj || '-'}</dd>
            <dt>Telefone</dt><dd>{cliente.telefone || '-'}</dd>
            <dt>Obra</dt><dd>{pedido.endereco_obra || cliente.endereco || '-'}</dd>
          </dl>
        </div>
        <div className="card">
          <h2>Período e entrega</h2>
          <dl className="info-lista">
            <dt>Saída</dt><dd>{dataBR(pedido.data_saida)}</dd>
            <dt>Devolução prevista</dt><dd>{dataBR(pedido.data_prevista)} ({resumo.dias} {resumo.dias === 1 ? 'dia' : 'dias'})</dd>
            <dt>Entrega</dt><dd>{pedido.entrega === 'frete' ? `Frete (${moeda(pedido.valor_frete)})` : 'Cliente retira'}</dd>
            {pedido.observacoes && (<><dt>Observações</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{pedido.observacoes}</dd></>)}
          </dl>
        </div>
      </div>

      <div className="card">
        <h2>Itens</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Item</th><th className="num">Qtd.</th><th className="num">Devolvidas</th><th className="num">Com o cliente</th><th className="num">Diária</th><th className="num">Subtotal</th></tr>
            </thead>
            <tbody>
              {resumo.itens.map((i) => (
                <tr key={i.produto_id}>
                  <td>{nomeProduto(i.produto_id)}</td>
                  <td className="num">{i.quantidade}</td>
                  <td className="num">{i.devolvidas}</td>
                  <td className={`num ${i.pendentes ? 'vermelho' : 'verde'}`}><strong>{i.pendentes}</strong></td>
                  <td className="num">{moeda(i.valor_dia)}</td>
                  <td className="num">{moeda(i.quantidade * i.valor_dia * resumo.dias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grade grade-2">
        <div className="card">
          <h2>Valores</h2>
          <div className="resumo-valores">
            <span>Aluguel ({resumo.dias} {resumo.dias === 1 ? 'dia' : 'dias'})</span><span>{moeda(resumo.aluguel)}</span>
            {resumo.atraso > 0 && (<><span className="vermelho">Dias extras (atraso)</span><span className="vermelho">{moeda(resumo.atraso)}</span></>)}
            {resumo.frete > 0 && (<><span>Frete</span><span>{moeda(resumo.frete)}</span></>)}
            {resumo.desconto > 0 && (<><span>Desconto</span><span>- {moeda(resumo.desconto)}</span></>)}
            {resumo.avarias > 0 && (<><span className="vermelho">Peças danificadas/perdidas</span><span className="vermelho">{moeda(resumo.avarias)}</span></>)}
            <span className="total">Total</span><span className="total">{moeda(resumo.total)}</span>
            <span>Pago</span><span className="verde">{moeda(resumo.pago)}</span>
            {resumo.caucaoAbatida > 0 && (<><span>Abatido da caução</span><span className="verde">{moeda(resumo.caucaoAbatida)}</span></>)}
            <span className="total">{resumo.saldo >= 0 ? 'Falta receber' : 'Crédito do cliente'}</span>
            <span className={`total ${resumo.saldo > 0.009 ? 'vermelho' : 'verde'}`}>{moeda(Math.abs(resumo.saldo))}</span>
          </div>
          {(pedido.caucao > 0 || resumo.caucaoRecebida > 0) && (
            <>
              <h3 style={{ marginTop: '1rem' }}>Caução</h3>
              <div className="resumo-valores">
                <span>Combinada</span><span>{moeda(pedido.caucao)}</span>
                <span>Recebida</span><span>{moeda(resumo.caucaoRecebida)}</span>
                {resumo.caucaoAbatida > 0 && (<><span>Abatida (avarias)</span><span>- {moeda(resumo.caucaoAbatida)}</span></>)}
                {resumo.caucaoDevolvida > 0 && (<><span>Já devolvida</span><span>- {moeda(resumo.caucaoDevolvida)}</span></>)}
                <span className="total">A devolver ao cliente</span><span className="total">{moeda(resumo.caucaoADevolver)}</span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Documentos</h2>
          <p className="suave" style={{ marginTop: 0 }}>Gere o PDF para imprimir ou mandar pelo WhatsApp.</p>
          <BotaoDoc nome="Contrato" aoGerar={(c) => void pdf('contrato', c)} />
          <BotaoDoc nome={pedido.entrega === 'frete' ? 'Romaneio de entrega' : 'Romaneio de retirada'} aoGerar={(c) => void pdf('romaneio', c)} />
          {resumo.pecasPendentes > 0 && !pedido.cancelado && (
            <BotaoDoc nome="Romaneio de devolução (peças com o cliente)" aoGerar={(c) => void pdf('romaneio-devolucao', c)} />
          )}
          <p className="ajuda">Recibos: use o botão “Recibo” em cada pagamento abaixo.</p>
          {cliente.telefone && (
            <a className="btn whats" href={whatsCobranca(config, item)} target="_blank" rel="noreferrer">Mensagem de cobrança no WhatsApp</a>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Pagamentos</h2>
        {pagamentos.length === 0 ? (
          <div className="suave">Nenhum pagamento registrado.</div>
        ) : (
          pagamentos.map((p) => (
            <div key={p.id} className="item-lista" style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <strong>{NOMES_TIPO[p.tipo]}</strong> · {moeda(p.valor)}
                <div className="suave" style={{ fontSize: '.88rem' }}>
                  {dataBR(p.data)} · {FORMAS.find((f) => f.id === p.forma)?.nome}{p.observacoes ? ` · ${p.observacoes}` : ''}
                </div>
              </div>
              <div className="botoes">
                <button className="btn pequeno" onClick={() => void pdf('recibo', false, p)}>Recibo</button>
                {podeCompartilhar && (
                  <button className="btn pequeno" onClick={() => void pdf('recibo', true, p)}>📤</button>
                )}
                <button className="btn pequeno perigo" onClick={() => tentar(async () => {
                  if (await confirmar(`Excluir ${NOMES_TIPO[p.tipo].toLowerCase()} de ${moeda(p.valor)}?`)) await excluir('pagamentos', p.id)
                })}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Devoluções</h2>
        {devolucoes.length === 0 ? (
          <div className="suave">Nenhuma devolução registrada.</div>
        ) : (
          devolucoes.map((d) => (
            <div key={d.id} className="item-lista">
              <div className="linha1">
                <span>{dataBR(d.data)}{diffDias(pedido.data_prevista, d.data) > 0 ? ` · ${diffDias(pedido.data_prevista, d.data)} dia(s) de atraso` : ''}</span>
                <button className="btn pequeno perigo" onClick={() => tentar(async () => {
                  if (await confirmar('Excluir esta devolução? As peças voltam a contar como alugadas.')) await excluirDevolucao(d)
                })}>✕</button>
              </div>
              <div className="linha2" style={{ display: 'block' }}>
                {d.itens.map((i) => (
                  <div key={i.produto_id}>
                    {nomeProduto(i.produto_id)}: {i.ok} em bom estado
                    {i.danificada > 0 && `, ${i.danificada} danificada(s) (${moeda(i.danificada * i.valor_danificada)})`}
                    {i.perdida > 0 && `, ${i.perdida} perdida(s) (${moeda(i.perdida * i.valor_perdida)})`}
                  </div>
                ))}
                {d.observacoes && <div>Obs.: {d.observacoes}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="botoes" style={{ justifyContent: 'flex-end' }}>
        <button className="btn perigo" onClick={alternarCancelado}>{pedido.cancelado ? 'Reativar pedido' : 'Cancelar pedido'}</button>
        <button className="btn perigo" onClick={excluirPedido}>Excluir pedido</button>
      </div>

      {modal === 'devolucao' && <DevolucaoModal item={item} aoFechar={() => setModal(null)} />}
      {modal === 'pagamento' && <PagamentoModal item={item} aoFechar={() => setModal(null)} />}
      {modal === 'prorrogar' && <ProrrogarModal item={item} aoFechar={() => setModal(null)} />}
    </>
  )
}

function BotaoDoc({ nome, aoGerar }: { nome: string; aoGerar: (compartilhar: boolean) => void }) {
  return (
    <div className="botoes" style={{ marginBottom: '.5rem' }}>
      <button className="btn" style={{ flex: 1, justifyContent: 'flex-start' }} onClick={() => aoGerar(false)}>📄 {nome}</button>
      {podeCompartilhar && <button className="btn" onClick={() => aoGerar(true)} title="Compartilhar">📤</button>}
    </div>
  )
}

function DevolucaoModal({ item, aoFechar }: { item: PedidoComResumo; aoFechar: () => void }) {
  const { dados, registrarDevolucao } = useStore()
  const { pedido, resumo } = item
  const [data, setData] = useState(hoje())
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [linhas, setLinhas] = useState<DevolucaoItem[]>(() =>
    resumo.itens
      .filter((i) => i.pendentes > 0)
      .map((i) => ({
        produto_id: i.produto_id,
        ok: i.pendentes,
        danificada: 0,
        perdida: 0,
        valor_danificada: 0,
        valor_perdida: dados.produtos.find((p) => p.id === i.produto_id)?.valor_reposicao ?? 0,
      })),
  )
  const setLinha = (pid: string, campos: Partial<DevolucaoItem>) =>
    setLinhas((l) => l.map((x) => (x.produto_id === pid ? { ...x, ...campos } : x)))

  const atraso = Math.max(0, diffDias(pedido.data_prevista, data))
  const extra = arred(linhas.reduce((s, l) => {
    const vd = pedido.itens.find((i) => i.produto_id === l.produto_id)?.valor_dia ?? 0
    return s + (l.ok + l.danificada + l.perdida) * vd * atraso
  }, 0))
  const avarias = arred(linhas.reduce((s, l) => s + l.danificada * l.valor_danificada + l.perdida * l.valor_perdida, 0))

  const salvar = async () => {
    const validas = linhas
      .map((l) => ({ ...l, ok: Math.round(l.ok), danificada: Math.round(l.danificada), perdida: Math.round(l.perdida) }))
      .filter((l) => l.ok + l.danificada + l.perdida > 0)
    if (!validas.length) return setErro('Informe a quantidade devolvida.')
    for (const l of validas) {
      const pend = resumo.itens.find((i) => i.produto_id === l.produto_id)?.pendentes ?? 0
      if (l.ok + l.danificada + l.perdida > pend) {
        return setErro(`${dados.produtos.find((p) => p.id === l.produto_id)?.nome}: só há ${pend} peças com o cliente.`)
      }
    }
    if (diffDias(pedido.data_saida, data) < 0) return setErro('A data da devolução não pode ser antes da saída.')
    setSalvando(true)
    const dev: Devolucao = { id: novoId(), pedido_id: pedido.id, data, itens: validas, observacoes: obs, created_at: agoraISO() }
    try {
      await registrarDevolucao(dev)
      aoFechar()
    } catch (e) {
      setErro(mensagemErro(e))
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={`Devolução do pedido #${pedido.numero}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar devolução'}</button>
        </>
      }
    >
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="linha-form">
        <label className="campo">
          Data da devolução
          <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        </label>
      </div>
      <p className="ajuda" style={{ marginTop: 0 }}>
        Já vem preenchido com todas as peças que estão com o cliente. Se ele devolveu só uma parte, diminua as quantidades.
      </p>
      {linhas.map((l) => {
        const pend = resumo.itens.find((i) => i.produto_id === l.produto_id)?.pendentes ?? 0
        return (
          <div key={l.produto_id} className="card" style={{ padding: '.8rem' }}>
            <h3>{dados.produtos.find((p) => p.id === l.produto_id)?.nome} <span className="suave">({pend} com o cliente)</span></h3>
            <div className="linha-form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <label className="campo">Em bom estado<CampoNumero valor={l.ok} aoMudar={(n) => setLinha(l.produto_id, { ok: n })} /></label>
              <label className="campo">Danificadas<CampoNumero valor={l.danificada} aoMudar={(n) => setLinha(l.produto_id, { danificada: n })} /></label>
              <label className="campo">Perdidas<CampoNumero valor={l.perdida} aoMudar={(n) => setLinha(l.produto_id, { perdida: n })} /></label>
            </div>
            {(l.danificada > 0 || l.perdida > 0) && (
              <div className="linha-form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 0 }}>
                {l.danificada > 0 && (
                  <label className="campo">Cobrar por peça danificada (R$)<CampoNumero valor={l.valor_danificada} aoMudar={(n) => setLinha(l.produto_id, { valor_danificada: n })} /></label>
                )}
                {l.perdida > 0 && (
                  <label className="campo">Cobrar por peça perdida (R$)<CampoNumero valor={l.valor_perdida} aoMudar={(n) => setLinha(l.produto_id, { valor_perdida: n })} /></label>
                )}
              </div>
            )}
          </div>
        )
      })}
      <label className="campo">
        Observações
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} style={{ minHeight: 60 }} />
      </label>
      {(atraso > 0 || avarias > 0) && (
        <div className="aviso atencao" style={{ marginTop: '1rem', marginBottom: 0 }}>
          {atraso > 0 && <div>Devolução com {atraso} dia(s) de atraso: <strong>{moeda(extra)}</strong> a mais.</div>}
          {avarias > 0 && <div>Peças danificadas/perdidas: <strong>{moeda(avarias)}</strong> (abatido da caução, se houver).</div>}
          <div className="ajuda">Peças danificadas vão para manutenção e peças perdidas saem do estoque.</div>
        </div>
      )}
    </Modal>
  )
}

function PagamentoModal({ item, aoFechar }: { item: PedidoComResumo; aoFechar: () => void }) {
  const { inserir } = useStore()
  const { pedido, resumo } = item
  const sugestao = (t: TipoPagamento) =>
    t === 'aluguel'
      ? Math.max(0, resumo.saldo)
      : t === 'caucao_recebida'
        ? Math.max(0, arred(pedido.caucao - resumo.caucaoRecebida))
        : Math.max(0, resumo.caucaoADevolver)
  const tipoInicial: TipoPagamento =
    resumo.saldo > 0.009 ? 'aluguel' : resumo.pecasPendentes === 0 && resumo.caucaoADevolver > 0.009 ? 'caucao_devolvida' : 'aluguel'
  const [p, setP] = useState<Pagamento>({
    id: novoId(), pedido_id: pedido.id, data: hoje(), valor: sugestao(tipoInicial), forma: 'pix',
    tipo: tipoInicial, observacoes: '', created_at: agoraISO(),
  })
  const [erro, setErro] = useState('')
  const set = (c: Partial<Pagamento>) => setP((x) => ({ ...x, ...c }))

  const salvar = async () => {
    if (p.valor <= 0) return setErro('Informe o valor.')
    try {
      await inserir('pagamentos', { ...p, valor: arred(p.valor) })
      aoFechar()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <Modal
      titulo="Registrar pagamento"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" onClick={salvar}>Salvar</button>
        </>
      }
    >
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="opcoes" style={{ marginBottom: '.9rem' }}>
        {(Object.keys(NOMES_TIPO) as TipoPagamento[]).map((t) => (
          <label key={t} className={`opcao ${p.tipo === t ? 'marcada' : ''}`}>
            <input type="radio" checked={p.tipo === t} onChange={() => set({ tipo: t, valor: sugestao(t) })} />
            {t === 'aluguel' ? 'Pagamento do cliente' : t === 'caucao_recebida' ? 'Recebi a caução' : 'Devolvi a caução'}
          </label>
        ))}
      </div>
      <div className="linha-form">
        <label className="campo">Valor (R$)<CampoNumero valor={p.valor} aoMudar={(n) => set({ valor: n })} autoFocus /></label>
        <label className="campo">
          Forma
          <select value={p.forma} onChange={(e) => set({ forma: e.target.value as FormaPagamento })}>
            {FORMAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className="campo">Data<input type="date" value={p.data} onChange={(e) => e.target.value && set({ data: e.target.value })} /></label>
      </div>
      <label className="campo">Observação<input value={p.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></label>
    </Modal>
  )
}

function ProrrogarModal({ item, aoFechar }: { item: PedidoComResumo; aoFechar: () => void }) {
  const { atualizar } = useStore()
  const { pedido } = item
  const [data, setData] = useState(somarDias(pedido.data_prevista > hoje() ? pedido.data_prevista : hoje(), 7))
  const [erro, setErro] = useState('')
  const novosDias = Math.max(1, diffDias(pedido.data_saida, data))
  const diferenca = arred(pedido.itens.reduce((s, i) => s + i.quantidade * i.valor_dia, 0) * (novosDias - item.resumo.dias))

  const salvar = async () => {
    if (diffDias(pedido.data_saida, data) < 1) return setErro('A nova data precisa ser depois da saída.')
    try {
      await atualizar('pedidos', pedido.id, { data_prevista: data })
      aoFechar()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <Modal
      titulo="Prorrogar aluguel"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" onClick={salvar}>Salvar nova data</button>
        </>
      }
    >
      {erro && <div className="aviso erro">{erro}</div>}
      <p style={{ marginTop: 0 }}>Devolução prevista atual: <strong>{dataBR(pedido.data_prevista)}</strong></p>
      <div className="linha-form">
        <label className="campo">Nova data de devolução<input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} /></label>
        <div className="campo">
          Somar dias à data atual
          <div className="botoes">
            {[7, 15, 30].map((d) => (
              <button key={d} type="button" className="btn pequeno" onClick={() => setData(somarDias(pedido.data_prevista, d))}>+{d} dias</button>
            ))}
          </div>
        </div>
      </div>
      <div className="aviso info" style={{ marginBottom: 0 }}>
        Novo período: {novosDias} dias. Diferença no aluguel: <strong>{moeda(diferenca)}</strong>.
        <div className="ajuda">O valor da diária continua o mesmo do pedido. Para aplicar o preço de outra faixa, use “Editar”.</div>
      </div>
    </Modal>
  )
}
