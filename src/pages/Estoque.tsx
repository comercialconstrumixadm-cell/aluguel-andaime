import { useState } from 'react'
import { CampoNumero, Cabecalho, Modal, mensagemErro } from '../components/ui'
import { estoque, type LinhaEstoque } from '../lib/calc'
import { useStore } from '../lib/store'

type Acao = 'entrada' | 'manutencao' | 'consertada' | 'baixa'

const ACOES: Record<Acao, { titulo: string; ajuda: string }> = {
  entrada: { titulo: 'Entrada de peças (compra)', ajuda: 'Soma peças novas ao total do estoque.' },
  manutencao: { titulo: 'Mandar para manutenção', ajuda: 'Peças disponíveis que precisam de conserto. Elas deixam de aparecer como disponíveis.' },
  consertada: { titulo: 'Peças consertadas', ajuda: 'Peças que saíram da manutenção e voltam a ficar disponíveis.' },
  baixa: { titulo: 'Dar baixa (descartar)', ajuda: 'Peças em manutenção sem conserto. Saem do estoque de vez.' },
}

export default function Estoque() {
  const { dados } = useStore()
  const [acao, setAcao] = useState<{ linha: LinhaEstoque; tipo: Acao } | null>(null)
  const linhas = estoque(dados.produtos, dados.pedidos, dados.devolucoes).sort(
    (a, b) => Number(b.produto.ativo) - Number(a.produto.ativo) || a.produto.nome.localeCompare(b.produto.nome, 'pt-BR'),
  )

  return (
    <>
      <Cabecalho titulo="Estoque" />
      <p className="suave" style={{ marginTop: 0 }}>
        Disponível = total − alugado − em manutenção. O alugado é atualizado sozinho pelos pedidos e devoluções.
      </p>

      <div className="grade grade-3">
        {linhas.map((l) => (
          <div key={l.produto.id} className="card" style={{ opacity: l.produto.ativo ? 1 : 0.6 }}>
            <h2>{l.produto.nome}</h2>
            <div className="grade grade-2" style={{ gap: '.5rem', gridTemplateColumns: '1fr 1fr' }}>
              <div className="indicador positivo">
                <div className="rotulo">Disponível</div>
                <div className={`valor ${l.disponivel < 0 ? 'vermelho' : ''}`}>{l.disponivel}</div>
              </div>
              <div className="indicador atencao">
                <div className="rotulo">Alugado</div>
                <div className="valor">{l.alugado}</div>
              </div>
              <div className="indicador">
                <div className="rotulo">Manutenção</div>
                <div className="valor">{l.manutencao}</div>
              </div>
              <div className="indicador">
                <div className="rotulo">Total</div>
                <div className="valor">{l.total}</div>
              </div>
            </div>
            {l.disponivel < 0 && (
              <div className="aviso erro" style={{ marginTop: '.5rem' }}>
                Há mais peças alugadas do que o estoque cadastrado. Confira a quantidade total.
              </div>
            )}
            <div className="botoes">
              <button className="btn pequeno primario" onClick={() => setAcao({ linha: l, tipo: 'entrada' })}>+ Entrada</button>
              <button className="btn pequeno" onClick={() => setAcao({ linha: l, tipo: 'manutencao' })}>Manutenção</button>
              {l.manutencao > 0 && (
                <>
                  <button className="btn pequeno" onClick={() => setAcao({ linha: l, tipo: 'consertada' })}>Consertadas</button>
                  <button className="btn pequeno perigo" onClick={() => setAcao({ linha: l, tipo: 'baixa' })}>Dar baixa</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {acao && <AjusteEstoque linha={acao.linha} tipo={acao.tipo} aoFechar={() => setAcao(null)} />}
    </>
  )
}

function AjusteEstoque({ linha, tipo, aoFechar }: { linha: LinhaEstoque; tipo: Acao; aoFechar: () => void }) {
  const { atualizar } = useStore()
  const [qtd, setQtd] = useState(0)
  const [erro, setErro] = useState('')
  const p = linha.produto
  const maximo = tipo === 'manutencao' ? linha.disponivel : tipo === 'entrada' ? Infinity : linha.manutencao

  const salvar = async () => {
    const n = Math.round(qtd)
    if (n <= 0) return setErro('Informe uma quantidade.')
    if (n > maximo) return setErro(`O máximo é ${maximo}.`)
    const campos = {
      entrada: { quantidade_total: p.quantidade_total + n },
      manutencao: { quantidade_manutencao: p.quantidade_manutencao + n },
      consertada: { quantidade_manutencao: p.quantidade_manutencao - n },
      baixa: { quantidade_manutencao: p.quantidade_manutencao - n, quantidade_total: p.quantidade_total - n },
    }[tipo]
    try {
      await atualizar('produtos', p.id, campos)
      aoFechar()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <Modal
      titulo={`${ACOES[tipo].titulo}: ${p.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" onClick={salvar}>Confirmar</button>
        </>
      }
    >
      {erro && <div className="aviso erro">{erro}</div>}
      <p className="suave" style={{ marginTop: 0 }}>{ACOES[tipo].ajuda}</p>
      <label className="campo">
        Quantidade {Number.isFinite(maximo) && <span className="ajuda">(máximo {maximo})</span>}
        <CampoNumero valor={qtd} aoMudar={setQtd} autoFocus />
      </label>
    </Modal>
  )
}
