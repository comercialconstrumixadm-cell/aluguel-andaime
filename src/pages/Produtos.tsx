import { useState, type FormEvent } from 'react'
import { avisar, confirmar } from '../components/dialogos'
import { CampoNumero, Cabecalho, Modal, mensagemErro } from '../components/ui'
import { moeda } from '../lib/format'
import { agoraISO, novoId, useStore } from '../lib/store'
import type { FaixaDias, FaixaQtd, Produto } from '../lib/types'

function textoFaixasDias(faixas: FaixaDias[]): string {
  const ord = [...faixas].sort((a, b) => a.dias_min - b.dias_min)
  if (!ord.length) return 'Sem preço'
  return ord
    .map((f, i) => {
      const prox = ord[i + 1]
      const periodo = prox ? `${f.dias_min} a ${prox.dias_min - 1} dias` : `${f.dias_min}+ dias`
      return `${periodo}: ${moeda(f.valor_dia)}`
    })
    .join(' · ')
}

export default function Produtos() {
  const { dados } = useStore()
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null)
  const produtos = [...dados.produtos].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <>
      <Cabecalho titulo="Produtos">
        <button className="btn primario" onClick={() => setEditando('novo')}>+ Novo produto</button>
      </Cabecalho>
      <p className="suave" style={{ marginTop: 0 }}>
        Cadastre aqui os itens que você aluga, o preço por dia de cada um e os descontos por tempo e por quantidade.
      </p>

      {produtos.map((p) => (
        <div key={p.id} className="card" style={{ opacity: p.ativo ? 1 : 0.6 }}>
          <div className="cabecalho" style={{ marginBottom: '.5rem' }}>
            <h2 style={{ margin: 0 }}>{p.nome} {!p.ativo && <span className="tag cancelado">Inativo</span>}</h2>
            <button className="btn pequeno" onClick={() => setEditando(p)}>Editar</button>
          </div>
          <dl className="info-lista">
            <dt>Preço por dia</dt>
            <dd className={p.faixas_dias.length ? '' : 'vermelho'}>{textoFaixasDias(p.faixas_dias)}</dd>
            <dt>Desconto por quantidade</dt>
            <dd>
              {p.faixas_qtd.length
                ? [...p.faixas_qtd].sort((a, b) => a.qtd_min - b.qtd_min).map((f) => `a partir de ${f.qtd_min} peças: ${f.desconto_pct}%`).join(' · ')
                : 'Nenhum'}
            </dd>
            <dt>Quantidade total</dt><dd>{p.quantidade_total} {p.unidade}(s)</dd>
            <dt>Valor da peça (perda)</dt><dd>{p.valor_reposicao ? moeda(p.valor_reposicao) : '-'}</dd>
          </dl>
        </div>
      ))}

      {editando && <ProdutoForm produto={editando === 'novo' ? undefined : editando} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function ProdutoForm({ produto, aoFechar }: { produto?: Produto; aoFechar: () => void }) {
  const { dados, inserir, atualizar, excluir } = useStore()
  const [form, setForm] = useState<Produto>(
    produto ?? {
      id: novoId(), nome: '', unidade: 'peça', quantidade_total: 0, quantidade_manutencao: 0, valor_reposicao: 0,
      faixas_dias: [{ dias_min: 1, valor_dia: 0 }], faixas_qtd: [], ativo: true, created_at: agoraISO(),
    },
  )
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (campos: Partial<Produto>) => setForm((f) => ({ ...f, ...campos }))

  const setFaixaDias = (i: number, campos: Partial<FaixaDias>) =>
    set({ faixas_dias: form.faixas_dias.map((f, j) => (j === i ? { ...f, ...campos } : f)) })
  const setFaixaQtd = (i: number, campos: Partial<FaixaQtd>) =>
    set({ faixas_qtd: form.faixas_qtd.map((f, j) => (j === i ? { ...f, ...campos } : f)) })

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const dias = form.faixas_dias.map((f) => f.dias_min)
    if (new Set(dias).size !== dias.length) return setErro('Há duas faixas de preço começando no mesmo dia.')
    const qtds = form.faixas_qtd.map((f) => f.qtd_min)
    if (new Set(qtds).size !== qtds.length) return setErro('Há duas faixas de desconto começando na mesma quantidade.')
    if (form.faixas_qtd.some((f) => f.desconto_pct < 0 || f.desconto_pct >= 100)) return setErro('O desconto deve ser entre 0 e 99%.')
    setSalvando(true)
    try {
      const limpo: Produto = {
        ...form,
        nome: form.nome.trim(),
        faixas_dias: [...form.faixas_dias].map((f) => ({ ...f, dias_min: Math.max(1, Math.round(f.dias_min)) })).sort((a, b) => a.dias_min - b.dias_min),
        faixas_qtd: [...form.faixas_qtd].map((f) => ({ ...f, qtd_min: Math.max(1, Math.round(f.qtd_min)) })).sort((a, b) => a.qtd_min - b.qtd_min),
        quantidade_total: Math.round(form.quantidade_total),
        quantidade_manutencao: Math.round(form.quantidade_manutencao),
      }
      if (produto) await atualizar('produtos', produto.id, limpo)
      else await inserir('produtos', limpo)
      aoFechar()
    } catch (err) {
      setErro(mensagemErro(err))
      setSalvando(false)
    }
  }

  const remover = async () => {
    if (!produto) return
    if (dados.pedidos.some((p) => p.itens.some((i) => i.produto_id === produto.id))) {
      await avisar('Este produto já foi usado em pedidos. Em vez de excluir, desmarque "Ativo" para escondê-lo dos novos pedidos.')
      return
    }
    if (!await confirmar(`Excluir o produto ${produto.nome}?`)) return
    try {
      await excluir('produtos', produto.id)
      aoFechar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Modal titulo={produto ? `Editar ${produto.nome}` : 'Novo produto'} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        {erro && <div className="aviso erro">{erro}</div>}
        <div className="linha-form">
          <label className="campo">
            Nome *
            <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} required placeholder="Ex.: Perna de andaime" />
          </label>
          <label className="campo">
            Unidade
            <input value={form.unidade} onChange={(e) => set({ unidade: e.target.value })} placeholder="peça" />
          </label>
        </div>
        <div className="linha-form">
          <label className="campo">
            Quantidade total que você tem
            <CampoNumero valor={form.quantidade_total} aoMudar={(n) => set({ quantidade_total: n })} />
            <span className="ajuda">Comprou mais? Some aqui ou use “Entrada” na aba Estoque.</span>
          </label>
          <label className="campo">
            Valor da peça (R$)
            <CampoNumero valor={form.valor_reposicao} aoMudar={(n) => set({ valor_reposicao: n })} />
            <span className="ajuda">Cobrado quando a peça é perdida.</span>
          </label>
        </div>

        <h3 style={{ marginTop: '.5rem' }}>Preço por dia (por peça)</h3>
        <p className="ajuda" style={{ marginTop: 0 }}>
          O preço muda conforme o total de dias do aluguel. Ex.: a partir de 1 dia R$ 2,00; a partir de 16 dias R$ 1,20.
        </p>
        <table>
          <thead><tr><th>A partir de (dias)</th><th>Valor por dia (R$)</th><th /></tr></thead>
          <tbody>
            {form.faixas_dias.map((f, i) => (
              <tr key={i}>
                <td><CampoNumero valor={f.dias_min} aoMudar={(n) => setFaixaDias(i, { dias_min: n })} /></td>
                <td><CampoNumero valor={f.valor_dia} aoMudar={(n) => setFaixaDias(i, { valor_dia: n })} /></td>
                <td><button type="button" className="btn pequeno perigo" onClick={() => set({ faixas_dias: form.faixas_dias.filter((_, j) => j !== i) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn pequeno"
          style={{ margin: '.5rem 0 1rem' }}
          onClick={() => {
            const ultimo = Math.max(0, ...form.faixas_dias.map((f) => f.dias_min))
            set({ faixas_dias: [...form.faixas_dias, { dias_min: ultimo ? ultimo + 15 : 1, valor_dia: 0 }] })
          }}
        >
          + Faixa de dias
        </button>

        <h3>Desconto por quantidade</h3>
        <p className="ajuda" style={{ marginTop: 0 }}>
          Desconto em % sobre o preço por dia quando o cliente aluga muitas peças. Ex.: a partir de 50 peças, 10%.
        </p>
        {form.faixas_qtd.length > 0 && (
          <table>
            <thead><tr><th>A partir de (peças)</th><th>Desconto (%)</th><th /></tr></thead>
            <tbody>
              {form.faixas_qtd.map((f, i) => (
                <tr key={i}>
                  <td><CampoNumero valor={f.qtd_min} aoMudar={(n) => setFaixaQtd(i, { qtd_min: n })} /></td>
                  <td><CampoNumero valor={f.desconto_pct} aoMudar={(n) => setFaixaQtd(i, { desconto_pct: n })} /></td>
                  <td><button type="button" className="btn pequeno perigo" onClick={() => set({ faixas_qtd: form.faixas_qtd.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          type="button"
          className="btn pequeno"
          style={{ margin: '.5rem 0 1rem' }}
          onClick={() => {
            const ultimo = Math.max(0, ...form.faixas_qtd.map((f) => f.qtd_min))
            set({ faixas_qtd: [...form.faixas_qtd, { qtd_min: ultimo ? ultimo * 2 : 50, desconto_pct: 0 }] })
          }}
        >
          + Faixa de quantidade
        </button>

        <label className="opcao" style={{ display: 'inline-flex' }}>
          <input type="checkbox" checked={form.ativo} onChange={(e) => set({ ativo: e.target.checked })} />
          Ativo (aparece nos novos pedidos)
        </label>

        <div className="rodape-modal">
          {produto && <button type="button" className="btn perigo" onClick={remover} style={{ marginRight: 'auto' }}>Excluir</button>}
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  )
}
