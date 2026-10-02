import { useEffect, useState, type ReactNode } from 'react'
import { NOMES_STATUS, type ResumoPedido } from '../lib/calc'

export function Modal({ titulo, aoFechar, children, rodape }: {
  titulo: string
  aoFechar: () => void
  children: ReactNode
  rodape?: ReactNode
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])
  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
        {rodape && <div className="rodape-modal">{rodape}</div>}
      </div>
    </div>
  )
}

export function StatusTag({ resumo }: { resumo: ResumoPedido }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      <span className={`tag ${resumo.status}`}>{NOMES_STATUS[resumo.status]}</span>
      {resumo.atrasado && <span className="tag atrasado">Atrasado {resumo.diasAtraso}d</span>}
    </span>
  )
}

function paraTexto(n: number): string {
  return String(n).replace('.', ',')
}

/** Campo numérico que aceita vírgula ou ponto e entrega um número. */
export function CampoNumero({ valor, aoMudar, ...resto }: {
  valor: number
  aoMudar: (n: number) => void
  placeholder?: string
  id?: string
  required?: boolean
  autoFocus?: boolean
}) {
  const [texto, setTexto] = useState(paraTexto(valor))
  // Acompanha mudanças feitas por fora (ex.: preço recalculado), sem atrapalhar a digitação.
  if (Number(texto.replace(',', '.') || 0) !== valor) setTexto(paraTexto(valor))
  return (
    <input
      type="text"
      inputMode="decimal"
      value={texto}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setTexto(t)
        const n = Number(t.replace(',', '.') || 0)
        aoMudar(Number.isFinite(n) ? n : 0)
      }}
      {...resto}
    />
  )
}

export function Cabecalho({ titulo, children }: { titulo: ReactNode; children?: ReactNode }) {
  return (
    <div className="cabecalho">
      <h1>{titulo}</h1>
      {children && <div className="acoes">{children}</div>}
    </div>
  )
}

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
