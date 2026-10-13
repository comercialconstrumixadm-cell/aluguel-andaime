import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { obterBackend, type Backend, type Dados, type Modo } from './db'
import { gerarId, traduzirErro } from './format'
import { configPadrao, produtosIniciais } from './seed'
import type { Config, Devolucao, NomeTabela, Tabelas } from './types'

interface Store {
  dados: Dados
  config: Config
  carregando: boolean
  erro: string
  modo: Modo | null
  inserir<K extends NomeTabela>(tabela: K, linha: Tabelas[K]): Promise<void>
  atualizar<K extends NomeTabela>(tabela: K, id: string, campos: Partial<Tabelas[K]>): Promise<void>
  excluir(tabela: NomeTabela, id: string): Promise<void>
  registrarDevolucao(dev: Devolucao): Promise<void>
  excluirDevolucao(dev: Devolucao): Promise<void>
  recarregar(): Promise<void>
}

const Ctx = createContext<Store | null>(null)

const VAZIO: Dados = { produtos: [], clientes: [], pedidos: [], devolucoes: [], pagamentos: [], configuracoes: [] }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados>(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [backend, setBackend] = useState<Backend | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const backend = await obterBackend()
      setBackend(backend)
      const d = await backend.carregar()
      // Primeiro acesso: cria as configurações e os produtos iniciais.
      if (!d.configuracoes.length) {
        const cfg = configPadrao()
        await backend.inserir('configuracoes', cfg)
        d.configuracoes = [cfg]
        if (!d.produtos.length) {
          for (const p of produtosIniciais()) await backend.inserir('produtos', p)
          d.produtos = (await backend.carregar()).produtos
        }
      }
      setDados(d)
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const inserir = useCallback(async <K extends NomeTabela>(tabela: K, linha: Tabelas[K]) => {
    await (await obterBackend()).inserir(tabela, linha)
    setDados((d) => ({ ...d, [tabela]: [...d[tabela], linha] }))
  }, [])

  const atualizar = useCallback(async <K extends NomeTabela>(tabela: K, id: string, campos: Partial<Tabelas[K]>) => {
    await (await obterBackend()).atualizar(tabela, id, campos)
    setDados((d) => ({
      ...d,
      [tabela]: (d[tabela] as Tabelas[K][]).map((l) => (l.id === id ? { ...l, ...campos } : l)),
    }))
  }, [])

  const excluir = useCallback(async (tabela: NomeTabela, id: string) => {
    await (await obterBackend()).excluir(tabela, id)
    setDados((d) => ({ ...d, [tabela]: (d[tabela] as { id: string }[]).filter((l) => l.id !== id) }))
  }, [])

  /** Peças danificadas vão para manutenção e peças perdidas saem do estoque. */
  const ajustarEstoque = useCallback(
    async (dev: Devolucao, sinal: 1 | -1) => {
      for (const item of dev.itens) {
        if (!item.danificada && !item.perdida) continue
        const produto = dados.produtos.find((p) => p.id === item.produto_id)
        if (!produto) continue
        await atualizar('produtos', produto.id, {
          quantidade_manutencao: Math.max(0, produto.quantidade_manutencao + sinal * item.danificada),
          quantidade_total: Math.max(0, produto.quantidade_total - sinal * item.perdida),
        })
      }
    },
    [dados.produtos, atualizar],
  )

  const registrarDevolucao = useCallback(
    async (dev: Devolucao) => {
      await inserir('devolucoes', dev)
      await ajustarEstoque(dev, 1)
    },
    [inserir, ajustarEstoque],
  )

  const excluirDevolucao = useCallback(
    async (dev: Devolucao) => {
      await excluir('devolucoes', dev.id)
      await ajustarEstoque(dev, -1)
    },
    [excluir, ajustarEstoque],
  )

  const valor = useMemo<Store>(
    () => ({
      dados,
      config: dados.configuracoes[0] ?? configPadrao(),
      carregando,
      erro,
      modo: backend?.modo ?? null,
      inserir,
      atualizar,
      excluir,
      registrarDevolucao,
      excluirDevolucao,
      recarregar,
    }),
    [dados, carregando, erro, backend, inserir, atualizar, excluir, registrarDevolucao, excluirDevolucao, recarregar],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

export function novoId(): string {
  return gerarId()
}

export function agoraISO(): string {
  return new Date().toISOString()
}
