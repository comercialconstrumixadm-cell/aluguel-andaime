import { useState } from 'react'
import { Cabecalho, mensagemErro } from '../components/ui'
import { mascaraCpfCnpj, mascaraTelefone } from '../lib/format'
import { CLAUSULAS_PADRAO, MENSAGEM_COBRANCA_PADRAO } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Config } from '../lib/types'

export default function Configuracoes({ aoSair }: { aoSair?: () => void }) {
  const { config, dados, atualizar, inserir, modo } = useStore()
  const [form, setForm] = useState<Config>(config)
  const [msg, setMsg] = useState<{ tipo: 'info' | 'erro'; texto: string } | null>(null)
  const set = (c: Partial<Config>) => setForm((f) => ({ ...f, ...c }))

  const salvar = async () => {
    try {
      if (dados.configuracoes.length) await atualizar('configuracoes', form.id, form)
      else await inserir('configuracoes', form)
      setMsg({ tipo: 'info', texto: 'Configurações salvas.' })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemErro(e) })
    }
  }

  const exportar = () => {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `backup-aluguel-andaime-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <Cabecalho titulo="Configurações">
        <button className="btn primario" onClick={salvar}>Salvar</button>
      </Cabecalho>
      {msg && <div className={`aviso ${msg.tipo}`}>{msg.texto}</div>}

      <div className="card">
        <h2>Seus dados (aparecem no contrato e no recibo)</h2>
        <p className="ajuda" style={{ marginTop: 0 }}>Tudo opcional. Se ficar em branco, o contrato sai sem os dados do locador.</p>
        <div className="linha-form">
          <label className="campo">Nome<input value={form.locador_nome} onChange={(e) => set({ locador_nome: e.target.value })} /></label>
          <label className="campo">CPF / CNPJ<input value={form.locador_documento} onChange={(e) => set({ locador_documento: mascaraCpfCnpj(e.target.value) })} /></label>
        </div>
        <div className="linha-form">
          <label className="campo">Endereço<input value={form.locador_endereco} onChange={(e) => set({ locador_endereco: e.target.value })} /></label>
          <label className="campo">Telefone<input value={form.locador_telefone} onChange={(e) => set({ locador_telefone: mascaraTelefone(e.target.value) })} /></label>
          <label className="campo">Cidade<input value={form.cidade} onChange={(e) => set({ cidade: e.target.value })} placeholder="Usada na data e no foro" /></label>
        </div>
      </div>

      <div className="card">
        <h2>Cláusulas do contrato</h2>
        <p className="ajuda" style={{ marginTop: 0 }}>
          Uma cláusula por linha. Pode usar {'{cidade}'}, {'{cliente}'} e {'{numero}'}, que são trocados pelos dados do pedido.
        </p>
        <textarea value={form.contrato_clausulas} onChange={(e) => set({ contrato_clausulas: e.target.value })} style={{ minHeight: 260 }} />
        <button className="btn pequeno" style={{ marginTop: '.5rem' }} onClick={() => set({ contrato_clausulas: CLAUSULAS_PADRAO })}>Restaurar modelo padrão</button>
      </div>

      <div className="card">
        <h2>Mensagem de cobrança (WhatsApp)</h2>
        <p className="ajuda" style={{ marginTop: 0 }}>
          Pode usar {'{cliente}'}, {'{numero}'}, {'{data_prevista}'}, {'{saldo}'} e {'{pecas}'}.
        </p>
        <textarea value={form.mensagem_cobranca} onChange={(e) => set({ mensagem_cobranca: e.target.value })} />
        <button className="btn pequeno" style={{ marginTop: '.5rem' }} onClick={() => set({ mensagem_cobranca: MENSAGEM_COBRANCA_PADRAO })}>Restaurar mensagem padrão</button>
      </div>

      <div className="card">
        <h2>Dados</h2>
        <p className="suave" style={{ marginTop: 0 }}>
          {modo === 'supabase' ? 'Seus dados estão salvos na nuvem (Supabase).' : 'Modo demonstração: os dados estão só neste navegador.'}
        </p>
        <div className="botoes">
          <button className="btn" onClick={exportar}>Baixar cópia de segurança</button>
          {aoSair && <button className="btn perigo" onClick={aoSair}>Sair da conta</button>}
        </div>
      </div>
    </>
  )
}
