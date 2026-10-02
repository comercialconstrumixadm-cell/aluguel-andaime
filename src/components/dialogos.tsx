import { useEffect, useState } from 'react'
import { Modal } from './ui'

interface Pedido {
  mensagem: string
  confirmacao: boolean
  responder: (ok: boolean) => void
}

let abrir: ((p: Pedido) => void) | null = null

/** Pergunta sim/não dentro da própria página (o app roda onde `confirm()` não funciona). */
export function confirmar(mensagem: string): Promise<boolean> {
  return new Promise((responder) => (abrir ? abrir({ mensagem, confirmacao: true, responder }) : responder(false)))
}

export function avisar(mensagem: string): Promise<void> {
  return new Promise((resolve) => (abrir ? abrir({ mensagem, confirmacao: false, responder: () => resolve() }) : resolve()))
}

export function Dialogos() {
  const [atual, setAtual] = useState<Pedido | null>(null)
  useEffect(() => {
    abrir = setAtual
    return () => {
      abrir = null
    }
  }, [])
  if (!atual) return null
  const fechar = (ok: boolean) => {
    setAtual(null)
    atual.responder(ok)
  }
  return (
    <Modal
      titulo={atual.confirmacao ? 'Confirmar' : 'Atenção'}
      aoFechar={() => fechar(false)}
      rodape={
        atual.confirmacao ? (
          <>
            <button className="btn" onClick={() => fechar(false)}>Não</button>
            <button className="btn primario" onClick={() => fechar(true)} autoFocus>Sim</button>
          </>
        ) : (
          <button className="btn primario" onClick={() => fechar(true)} autoFocus>Entendi</button>
        )
      }
    >
      <p style={{ margin: 0 }}>{atual.mensagem}</p>
    </Modal>
  )
}
