import { useState, type FormEvent } from 'react'
import { confirmar } from './dialogos'
import { mascaraCpfCnpj, mascaraTelefone } from '../lib/format'
import { agoraISO, novoId, useStore } from '../lib/store'
import type { Cliente } from '../lib/types'
import { Modal, mensagemErro } from './ui'

export default function ClienteForm({ cliente, aoFechar, aoSalvar }: {
  cliente?: Cliente
  aoFechar: () => void
  aoSalvar?: (c: Cliente) => void
}) {
  const { dados, inserir, atualizar } = useStore()
  const [form, setForm] = useState<Cliente>(
    cliente ?? { id: novoId(), nome: '', cpf_cnpj: '', telefone: '', endereco: '', observacoes: '', created_at: agoraISO() },
  )
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (campos: Partial<Cliente>) => setForm((f) => ({ ...f, ...campos }))

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const duplicado = form.cpf_cnpj && dados.clientes.find((c) => c.cpf_cnpj === form.cpf_cnpj && c.id !== form.id)
    if (duplicado && !await confirmar(`Já existe um cliente com este CPF/CNPJ (${duplicado.nome}). Salvar mesmo assim?`)) return
    setSalvando(true)
    try {
      const limpo = { ...form, nome: form.nome.trim() }
      if (cliente) await atualizar('clientes', cliente.id, limpo)
      else await inserir('clientes', limpo)
      aoSalvar?.(limpo)
      aoFechar()
    } catch (err) {
      setErro(mensagemErro(err))
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={cliente ? 'Editar cliente' : 'Novo cliente'} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        {erro && <div className="aviso erro">{erro}</div>}
        <div className="linha-form">
          <label className="campo">
            Nome completo *
            <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} required autoFocus />
          </label>
        </div>
        <div className="linha-form">
          <label className="campo">
            CPF / CNPJ
            <input inputMode="numeric" value={form.cpf_cnpj} onChange={(e) => set({ cpf_cnpj: mascaraCpfCnpj(e.target.value) })} />
          </label>
          <label className="campo">
            Telefone / WhatsApp
            <input type="tel" inputMode="tel" value={form.telefone} onChange={(e) => set({ telefone: mascaraTelefone(e.target.value) })} />
          </label>
        </div>
        <div className="linha-form">
          <label className="campo">
            Endereço
            <input value={form.endereco} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" />
          </label>
        </div>
        <div className="linha-form">
          <label className="campo">
            Observações
            <textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
          </label>
        </div>
        <div className="rodape-modal">
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  )
}
