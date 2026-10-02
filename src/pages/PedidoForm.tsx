import { useMemo, useState, type FormEvent } from 'react'
import { confirmar } from '../components/dialogos'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ClienteForm from '../components/ClienteForm'
import { CampoNumero, Cabecalho, mensagemErro } from '../components/ui'
import { diasContratados, estoque, precoDia } from '../lib/calc'
import { FORMAS, arred, diffDias, hoje, moeda, somarDias } from '../lib/format'
import { agoraISO, novoId, useStore } from '../lib/store'
import type { FormaPagamento, Pedido, PedidoItem } from '../lib/types'

interface LinhaItem extends PedidoItem {
  chave: string
  manual: boolean
}

export default function PedidoForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { dados, inserir, atualizar } = useStore()
  const existente = id ? dados.pedidos.find((p) => p.id === id) : undefined
  const devolucoes = existente ? dados.devolucoes.filter((d) => d.pedido_id === existente.id) : []

  const [pedido, setPedido] = useState<Pedido>(() => {
    if (existente) return structuredClone(existente)
    const saida = hoje()
    return {
      id: novoId(),
      numero: 0,
      cliente_id: params.get('cliente') ?? '',
      endereco_obra: '',
      data_saida: saida,
      data_prevista: somarDias(saida, 7),
      entrega: 'retirada',
      valor_frete: 0,
      caucao: 0,
      desconto: 0,
      observacoes: '',
      cancelado: false,
      itens: [],
      created_at: agoraISO(),
    }
  })
  const [itens, setItens] = useState<LinhaItem[]>(() =>
    existente
      ? existente.itens.map((i) => ({ ...i, chave: novoId(), manual: true }))
      : [{ produto_id: '', quantidade: 0, valor_dia: 0, chave: novoId(), manual: false }],
  )
  const [valorPago, setValorPago] = useState<number | null>(null)
  const [formaPag, setFormaPag] = useState<FormaPagamento>('pix')
  const [caucaoRecebida, setCaucaoRecebida] = useState(true)
  const [novoCliente, setNovoCliente] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const set = (campos: Partial<Pedido>) => setPedido((p) => ({ ...p, ...campos }))
  const dias = diasContratados(pedido)
  const produtos = dados.produtos.filter((p) => p.ativo || itens.some((i) => i.produto_id === p.id))
  const cliente = dados.clientes.find((c) => c.id === pedido.cliente_id)
  const disponiveis = useMemo(
    () => new Map(estoque(dados.produtos, dados.pedidos, dados.devolucoes, existente?.id).map((l) => [l.produto.id, l.disponivel])),
    [dados.produtos, dados.pedidos, dados.devolucoes, existente?.id],
  )

  // Itens com preço automático acompanham dias e quantidade.
  const comPreco = itens.map((i) => {
    if (i.manual || !i.produto_id) return i
    const produto = dados.produtos.find((p) => p.id === i.produto_id)
    return produto ? { ...i, valor_dia: precoDia(produto, dias, i.quantidade) } : i
  })

  const aluguel = arred(comPreco.reduce((s, i) => s + i.quantidade * i.valor_dia * dias, 0))
  const frete = pedido.entrega === 'frete' ? pedido.valor_frete : 0
  const total = arred(aluguel + frete - pedido.desconto)
  const pagoAgora = valorPago ?? total

  const setItem = (chave: string, campos: Partial<LinhaItem>) =>
    setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...campos } : i)))

  const devolvidasDe = (produtoId: string) =>
    devolucoes.reduce((s, d) => s + d.itens.filter((i) => i.produto_id === produtoId).reduce((t, i) => t + i.ok + i.danificada + i.perdida, 0), 0)

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    const validos = comPreco.filter((i) => i.produto_id && i.quantidade > 0)
    if (!pedido.cliente_id) return setErro('Escolha o cliente.')
    if (!validos.length) return setErro('Adicione pelo menos um item com quantidade.')
    if (diffDias(pedido.data_saida, pedido.data_prevista) < 0) return setErro('A devolução prevista não pode ser antes da saída.')
    const ids = validos.map((i) => i.produto_id)
    if (new Set(ids).size !== ids.length) return setErro('O mesmo produto aparece duas vezes. Junte as quantidades em uma linha só.')
    for (const d of devolucoes) {
      for (const di of d.itens) {
        const item = validos.find((i) => i.produto_id === di.produto_id)
        const devolvidas = devolvidasDe(di.produto_id)
        if (!item || item.quantidade < devolvidas) {
          const nome = dados.produtos.find((p) => p.id === di.produto_id)?.nome
          return setErro(`${nome}: já foram devolvidas ${devolvidas} peças, então a quantidade não pode ser menor que isso.`)
        }
      }
    }
    const faltando = validos.filter((i) => i.quantidade - devolvidasDe(i.produto_id) > (disponiveis.get(i.produto_id) ?? 0))
    if (faltando.length) {
      const nomes = faltando.map((i) => `${dados.produtos.find((p) => p.id === i.produto_id)?.nome} (disponível: ${disponiveis.get(i.produto_id) ?? 0})`).join(', ')
      if (!await confirmar(`Estoque insuficiente: ${nomes}. Salvar mesmo assim?`)) return
    }

    setSalvando(true)
    try {
      const final: Pedido = {
        ...pedido,
        valor_frete: frete,
        itens: validos.map(({ produto_id, quantidade, valor_dia }) => ({ produto_id, quantidade: Math.round(quantidade), valor_dia })),
      }
      if (existente) {
        await atualizar('pedidos', existente.id, final)
      } else {
        final.numero = Math.max(0, ...dados.pedidos.map((p) => p.numero)) + 1
        await inserir('pedidos', final)
        if (pagoAgora > 0) {
          await inserir('pagamentos', {
            id: novoId(), pedido_id: final.id, data: hoje(), valor: arred(pagoAgora), forma: formaPag,
            tipo: 'aluguel', observacoes: 'Pagamento adiantado', created_at: agoraISO(),
          })
        }
        if (final.caucao > 0 && caucaoRecebida) {
          await inserir('pagamentos', {
            id: novoId(), pedido_id: final.id, data: hoje(), valor: final.caucao, forma: formaPag,
            tipo: 'caucao_recebida', observacoes: '', created_at: agoraISO(),
          })
        }
      }
      navegar(`/pedidos/${final.id}`, { replace: true })
    } catch (err) {
      setErro(mensagemErro(err))
      setSalvando(false)
    }
  }

  if (id && !existente) return <div className="vazio">Pedido não encontrado. <Link to="/pedidos">Voltar</Link></div>

  return (
    <>
      <p style={{ margin: '0 0 .5rem' }}><Link to={existente ? `/pedidos/${existente.id}` : '/pedidos'}>← Voltar</Link></p>
      <Cabecalho titulo={existente ? `Editar pedido #${existente.numero}` : 'Novo pedido'} />
      <form onSubmit={salvar}>
        {erro && <div className="aviso erro">{erro}</div>}

        <div className="card">
          <h2>Cliente</h2>
          <div className="linha-form" style={{ alignItems: 'end' }}>
            <label className="campo">
              Cliente *
              <select value={pedido.cliente_id} onChange={(e) => set({ cliente_id: e.target.value })} required>
                <option value="">Escolha…</option>
                {[...dados.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}</option>
                ))}
              </select>
            </label>
            <div><button type="button" className="btn" onClick={() => setNovoCliente(true)}>+ Cadastrar cliente</button></div>
          </div>
          <div className="linha-form">
            <label className="campo">
              Endereço da obra
              <input value={pedido.endereco_obra} onChange={(e) => set({ endereco_obra: e.target.value })} placeholder={cliente?.endereco ? `Se vazio: ${cliente.endereco}` : 'Onde o material vai ficar'} />
            </label>
          </div>
        </div>

        <div className="card">
          <h2>Período</h2>
          <div className="linha-form">
            <label className="campo">
              Data de saída
              <input type="date" value={pedido.data_saida} onChange={(e) => e.target.value && set({ data_saida: e.target.value, data_prevista: somarDias(e.target.value, dias) })} required />
            </label>
            <label className="campo">
              Dias de aluguel
              <CampoNumero valor={dias} aoMudar={(n) => set({ data_prevista: somarDias(pedido.data_saida, Math.max(1, Math.round(n))) })} />
            </label>
            <label className="campo">
              Devolução prevista
              <input type="date" value={pedido.data_prevista} onChange={(e) => e.target.value && set({ data_prevista: e.target.value })} required />
            </label>
          </div>
        </div>

        <div className="card">
          <h2>Itens</h2>
          {itens.map((i) => {
            const linha = comPreco.find((c) => c.chave === i.chave)!
            const disp = i.produto_id ? (disponiveis.get(i.produto_id) ?? 0) + devolvidasDe(i.produto_id) : null
            return (
              <div key={i.chave} style={{ borderBottom: '1px solid var(--borda)', paddingBottom: '.8rem', marginBottom: '.8rem' }}>
                <div className="linha-form" style={{ marginBottom: '.4rem' }}>
                  <label className="campo">
                    Produto
                    <select value={i.produto_id} onChange={(e) => setItem(i.chave, { produto_id: e.target.value, manual: false })}>
                      <option value="">Escolha…</option>
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </label>
                  <label className="campo">
                    Quantidade
                    <CampoNumero valor={i.quantidade} aoMudar={(n) => setItem(i.chave, { quantidade: n })} />
                    {disp !== null && (
                      <span className={`ajuda ${i.quantidade > disp ? 'vermelho' : ''}`}>Disponível: {disp}</span>
                    )}
                  </label>
                  <label className="campo">
                    Valor por dia (R$)
                    <CampoNumero valor={linha.valor_dia} aoMudar={(n) => setItem(i.chave, { valor_dia: n, manual: true })} />
                    <span className="ajuda">
                      {i.manual ? (
                        <button type="button" className="btn pequeno" onClick={() => setItem(i.chave, { manual: false })}>Usar preço da tabela</button>
                      ) : 'Preço da tabela'}
                    </span>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="suave">Subtotal: <strong>{moeda(linha.quantidade * linha.valor_dia * dias)}</strong></span>
                  {itens.length > 1 && (
                    <button type="button" className="btn pequeno perigo" onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))}>Remover</button>
                  )}
                </div>
              </div>
            )
          })}
          <button type="button" className="btn" onClick={() => setItens((l) => [...l, { produto_id: '', quantidade: 0, valor_dia: 0, chave: novoId(), manual: false }])}>
            + Adicionar item
          </button>
        </div>

        <div className="card">
          <h2>Entrega</h2>
          <div className="opcoes" style={{ marginBottom: '.9rem' }}>
            <label className={`opcao ${pedido.entrega === 'retirada' ? 'marcada' : ''}`}>
              <input type="radio" checked={pedido.entrega === 'retirada'} onChange={() => set({ entrega: 'retirada' })} /> Cliente retira
            </label>
            <label className={`opcao ${pedido.entrega === 'frete' ? 'marcada' : ''}`}>
              <input type="radio" checked={pedido.entrega === 'frete'} onChange={() => set({ entrega: 'frete' })} /> Frete (entrego na obra)
            </label>
          </div>
          {pedido.entrega === 'frete' && (
            <div className="linha-form">
              <label className="campo">
                Valor do frete (R$)
                <CampoNumero valor={pedido.valor_frete} aoMudar={(n) => set({ valor_frete: n })} />
              </label>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Valores</h2>
          <div className="linha-form">
            <label className="campo">
              Caução (R$)
              <CampoNumero valor={pedido.caucao} aoMudar={(n) => set({ caucao: n })} />
              <span className="ajuda">Peças danificadas ou perdidas são abatidas daqui.</span>
            </label>
            <label className="campo">
              Desconto (R$)
              <CampoNumero valor={pedido.desconto} aoMudar={(n) => set({ desconto: n })} />
            </label>
          </div>
          <div className="resumo-valores" style={{ maxWidth: 420 }}>
            <span>Aluguel ({dias} {dias === 1 ? 'dia' : 'dias'})</span><span>{moeda(aluguel)}</span>
            {frete > 0 && (<><span>Frete</span><span>{moeda(frete)}</span></>)}
            {pedido.desconto > 0 && (<><span>Desconto</span><span>- {moeda(pedido.desconto)}</span></>)}
            <span className="total">Total</span><span className="total">{moeda(total)}</span>
            {pedido.caucao > 0 && (<><span className="suave">Caução (à parte)</span><span className="suave">{moeda(pedido.caucao)}</span></>)}
          </div>
        </div>

        {!existente && (
          <div className="card">
            <h2>Pagamento adiantado</h2>
            <div className="linha-form">
              <label className="campo">
                Valor recebido agora (R$)
                <CampoNumero valor={pagoAgora} aoMudar={setValorPago} />
                <span className="ajuda">Coloque 0 se o cliente ainda não pagou.</span>
              </label>
              <label className="campo">
                Forma de pagamento
                <select value={formaPag} onChange={(e) => setFormaPag(e.target.value as FormaPagamento)}>
                  {FORMAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </label>
            </div>
            {pedido.caucao > 0 && (
              <label className="opcao" style={{ display: 'inline-flex' }}>
                <input type="checkbox" checked={caucaoRecebida} onChange={(e) => setCaucaoRecebida(e.target.checked)} />
                Caução de {moeda(pedido.caucao)} recebida agora
              </label>
            )}
          </div>
        )}

        <div className="card">
          <label className="campo">
            Observações
            <textarea value={pedido.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
          </label>
        </div>

        <div className="botoes" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => navegar(-1)}>Cancelar</button>
          <button className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : existente ? 'Salvar alterações' : 'Criar pedido'}</button>
        </div>
      </form>

      {novoCliente && <ClienteForm aoFechar={() => setNovoCliente(false)} aoSalvar={(c) => set({ cliente_id: c.id })} />}
    </>
  )
}
