import { useEffect, useState, type FormEvent } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { dentroDoClaude, supabase } from './lib/db'
import { traduzirErro } from './lib/format'
import { Dialogos } from './components/dialogos'
import { StoreProvider, useStore } from './lib/store'
import Painel from './pages/Painel'
import Pedidos from './pages/Pedidos'
import PedidoForm from './pages/PedidoForm'
import PedidoDetalhe from './pages/PedidoDetalhe'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import Produtos from './pages/Produtos'
import Estoque from './pages/Estoque'
import Financeiro from './pages/Financeiro'
import Configuracoes from './pages/Configuracoes'

const MENU = [
  { para: '/', nome: 'Painel', ico: '🏠' },
  { para: '/pedidos', nome: 'Pedidos', ico: '📋' },
  { para: '/clientes', nome: 'Clientes', ico: '👤' },
  { para: '/estoque', nome: 'Estoque', ico: '📦' },
  { para: '/produtos', nome: 'Produtos', ico: '🏗️' },
  { para: '/financeiro', nome: 'Financeiro', ico: '💰' },
  { para: '/configuracoes', nome: 'Configurações', ico: '⚙️' },
]
const MENU_MOVEL = ['/', '/pedidos', '/clientes', '/estoque', '/financeiro']

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (supabase && sessao === undefined) return <div className="vazio">Carregando…</div>
  if (supabase && !sessao) return <Login />

  return (
    <StoreProvider>
      {/* Dentro do claude.ai a página fica num quadro sem endereço próprio: a navegação fica em memória. */}
      {dentroDoClaude ? (
        <MemoryRouter>
          <Estrutura />
        </MemoryRouter>
      ) : (
        <BrowserRouter>
          <Estrutura />
        </BrowserRouter>
      )}
    </StoreProvider>
  )
}

function Estrutura() {
  const { carregando, erro, modo, recarregar } = useStore()
  const sair = () => supabase?.auth.signOut()

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">🏗️ Aluguel Andaime</div>
        <nav>
          {MENU.map((m) => (
            <NavLink key={m.para} to={m.para} end={m.para === '/'}>
              <span>{m.ico}</span> {m.nome}
            </NavLink>
          ))}
        </nav>
        <div className="rodape">
          {supabase ? <button onClick={sair}>Sair</button> : modo === 'claude' ? 'Dados salvos na nuvem' : 'Modo demonstração'}
        </div>
      </aside>

      <header className="topo-movel">
        <span>🏗️ Aluguel Andaime</span>
        <span style={{ display: 'flex', gap: '1rem' }}>
          <NavLink to="/produtos">Produtos</NavLink>
          <NavLink to="/configuracoes">⚙️</NavLink>
        </span>
      </header>

      <main className="conteudo">
        {modo === 'local' && (
          <div className="aviso info">
            <strong>Modo demonstração:</strong> os dados ficam salvos só neste navegador. Depois de ligar o banco de dados
            (Supabase), eles passam a ficar na nuvem e aparecem no celular e no computador.
          </div>
        )}
        {erro && (
          <div className="aviso erro">
            Erro ao carregar os dados: {erro}{' '}
            <button className="btn pequeno" onClick={() => void recarregar()}>Tentar de novo</button>
          </div>
        )}
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : (
          <Routes>
            <Route path="/" element={<Painel />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/pedidos/novo" element={<PedidoForm />} />
            <Route path="/pedidos/:id" element={<PedidoDetalhe />} />
            <Route path="/pedidos/:id/editar" element={<PedidoForm />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/configuracoes" element={<Configuracoes aoSair={supabase ? sair : undefined} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <nav className="abas-movel">
        {MENU.filter((m) => MENU_MOVEL.includes(m.para)).map((m) => (
          <NavLink key={m.para} to={m.para} end={m.para === '/'}>
            <span className="ico">{m.ico}</span>
            {m.nome}
          </NavLink>
        ))}
      </nav>
      <Dialogos />
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      const { error } = await supabase!.auth.signInWithPassword({ email, password: senha })
      if (error) setErro(traduzirErro(error.message))
    } catch (err) {
      setErro(traduzirErro(err instanceof Error ? err.message : String(err)))
    }
    setEnviando(false)
  }

  return (
    <div className="login">
      <form className="card" onSubmit={entrar}>
        <h1 style={{ marginBottom: '1rem' }}>🏗️ Aluguel Andaime</h1>
        {erro && <div className="aviso erro">{erro}</div>}
        <div className="linha-form">
          <label className="campo">
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
        </div>
        <div className="linha-form">
          <label className="campo">
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
          </label>
        </div>
        <button className="btn primario" style={{ width: '100%' }} disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
