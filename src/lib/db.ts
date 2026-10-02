import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { configPadrao, produtosIniciais } from './seed'
import type { NomeTabela, Tabelas } from './types'

export type Dados = { [K in NomeTabela]: Tabelas[K][] }

export interface Backend {
  modo: 'supabase' | 'local'
  carregar(): Promise<Dados>
  inserir<K extends NomeTabela>(tabela: K, linha: Tabelas[K]): Promise<void>
  atualizar<K extends NomeTabela>(tabela: K, id: string, campos: Partial<Tabelas[K]>): Promise<void>
  excluir(tabela: NomeTabela, id: string): Promise<void>
}

const TABELAS: NomeTabela[] = ['produtos', 'clientes', 'pedidos', 'devolucoes', 'pagamentos', 'configuracoes']

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null

function vazio(): Dados {
  return { produtos: [], clientes: [], pedidos: [], devolucoes: [], pagamentos: [], configuracoes: [] }
}

function supabaseBackend(sb: SupabaseClient): Backend {
  const verificar = (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  }
  return {
    modo: 'supabase',
    async carregar() {
      const dados = vazio()
      const resultados = await Promise.all(TABELAS.map((t) => sb.from(t).select('*')))
      TABELAS.forEach((t, i) => {
        verificar(resultados[i].error)
        ;(dados as Record<string, unknown[]>)[t] = (resultados[i].data ?? []).map(normalizar)
      })
      return dados
    },
    async inserir(tabela, linha) {
      const { error } = await sb.from(tabela).insert(linha as never)
      verificar(error)
    },
    async atualizar(tabela, id, campos) {
      const { error } = await sb.from(tabela).update(campos as never).eq('id', id)
      verificar(error)
    },
    async excluir(tabela, id) {
      const { error } = await sb.from(tabela).delete().eq('id', id)
      verificar(error)
    },
  }
}

/** O Postgres devolve colunas `numeric` como texto; converte de volta para número. */
function normalizar(linha: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(linha)) {
    out[k] = typeof v === 'string' && CAMPOS_NUMERICOS.has(k) ? Number(v) : v
  }
  return out
}

const CAMPOS_NUMERICOS = new Set([
  'quantidade_total', 'quantidade_manutencao', 'valor_reposicao', 'valor_frete', 'caucao', 'desconto', 'valor',
])

const CHAVE_LOCAL = 'aluguel-andaime:dados'

function localBackend(): Backend {
  const ler = (): Dados => {
    try {
      const txt = localStorage.getItem(CHAVE_LOCAL)
      if (txt) return { ...vazio(), ...JSON.parse(txt) }
    } catch {
      /* armazenamento indisponível: começa vazio */
    }
    const inicial = vazio()
    inicial.produtos = produtosIniciais()
    inicial.configuracoes = [configPadrao()]
    return inicial
  }
  let dados = ler()
  const salvar = () => {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(dados))
    } catch {
      /* ignora */
    }
  }
  const lista = <K extends NomeTabela>(t: K) => dados[t] as Tabelas[K][]
  return {
    modo: 'local',
    async carregar() {
      salvar()
      return structuredClone(dados)
    },
    async inserir(tabela, linha) {
      lista(tabela).push(structuredClone(linha))
      salvar()
    },
    async atualizar(tabela, id, campos) {
      dados = { ...dados, [tabela]: lista(tabela).map((l) => (l.id === id ? { ...l, ...structuredClone(campos) } : l)) }
      salvar()
    },
    async excluir(tabela, id) {
      dados = { ...dados, [tabela]: lista(tabela).filter((l) => l.id !== id) }
      salvar()
    },
  }
}

export const backend: Backend = supabase ? supabaseBackend(supabase) : localBackend()
