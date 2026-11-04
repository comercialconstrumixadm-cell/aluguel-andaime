import { useState, type ChangeEvent } from 'react'
import { confirmar } from '../components/dialogos'
import { Cabecalho, mensagemErro } from '../components/ui'
import { mascaraCpfCnpj, mascaraTelefone } from '../lib/format'
import { CLAUSULAS_PADRAO, MENSAGEM_COBRANCA_PADRAO } from '../lib/seed'
import { salvarArquivo } from '../lib/arquivo'
import { TABELAS, type Dados } from '../lib/db'
import { useStore } from '../lib/store'
import type { Config } from '../lib/types'

export default function Configuracoes({ aoSair }: { aoSair?: () => void }) {
  const { config, dados, atualizar, inserir, modo, restaurar } = useStore()
  const [progresso, setProgresso] = useState<string | null>(null)
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

  const exportar = async () => {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
    try {
      await salvarArquivo(`backup-aluguel-andaime-${new Date().toISOString().slice(0, 10)}.json`, blob)
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemErro(e) })
    }
  }

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    let copia: Dados
    try {
      const lido = JSON.parse(await arquivo.text()) as Partial<Dados>
      if (!TABELAS.every((t) => Array.isArray(lido[t]))) throw new Error()
      copia = lido as Dados
    } catch {
      setMsg({ tipo: 'erro', texto: 'Este arquivo não é uma cópia de segurança do Aluguel Andaime. Escolha o arquivo "backup-aluguel-andaime-....json".' })
      return
    }
    const resumo = `${copia.clientes.length} cliente(s), ${copia.pedidos.length} pedido(s) e ${copia.produtos.length} produto(s)`
    const ok = await confirmar(
      `A cópia tem ${resumo}. Restaurar vai SUBSTITUIR todos os dados que estão no app agora pelos da cópia. Continuar?`,
    )
    if (!ok) return
    setMsg(null)
    try {
      await restaurar(copia, (feitos, total) => setProgresso(`Restaurando… ${feitos} de ${total}`))
      setMsg({ tipo: 'info', texto: `Cópia restaurada: ${resumo}.` })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: `A restauração parou no meio: ${mensagemErro(err)} Tente de novo com o mesmo arquivo.` })
    } finally {
      setProgresso(null)
    }
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
          {modo === 'local' ? 'Modo demonstração: os dados estão só neste navegador.' : 'Seus dados estão salvos na nuvem e aparecem no computador e no celular.'}
        </p>
        <div className="botoes">
          <button className="btn" onClick={() => void exportar()}>Baixar cópia de segurança</button>
          <label className="btn" htmlFor="restaurar-copia">
            Restaurar cópia de segurança
            <input id="restaurar-copia" type="file" accept=".json,application/json" hidden onChange={(e) => void importar(e)} disabled={!!progresso} />
          </label>
          {aoSair && <button className="btn perigo" onClick={aoSair}>Sair da conta</button>}
        </div>
        {progresso && <p className="suave" style={{ marginBottom: 0 }}>{progresso}</p>}
        <p className="ajuda" style={{ marginBottom: 0 }}>
          Restaurar substitui tudo o que está no app pelos dados do arquivo. Use para trazer os dados de outro aparelho ou de outra versão do app.
        </p>
      </div>
    </>
  )
}
