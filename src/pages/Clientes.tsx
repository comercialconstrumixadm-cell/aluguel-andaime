import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClienteForm from '../components/ClienteForm'
import { Cabecalho } from '../components/ui'
import { soDigitos } from '../lib/format'
import { usePedidos } from '../lib/hooks'
import { useStore } from '../lib/store'

function normalizar(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function Clientes() {
  const { dados } = useStore()
  const pedidos = usePedidos()
  const navegar = useNavigate()
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim())
    const digitos = soDigitos(busca)
    return [...dados.clientes]
      .filter((c) => !termo || normalizar(c.nome).includes(termo) || (digitos && (soDigitos(c.cpf_cnpj).includes(digitos) || soDigitos(c.telefone).includes(digitos))))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [dados.clientes, busca])

  const ativosPorCliente = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pedidos) if (p.resumo.pecasPendentes > 0 && !p.pedido.cancelado) m.set(p.pedido.cliente_id, (m.get(p.pedido.cliente_id) ?? 0) + 1)
    return m
  }, [pedidos])

  return (
    <>
      <Cabecalho titulo="Clientes">
        <button className="btn primario" onClick={() => setNovo(true)}>+ Novo cliente</button>
      </Cabecalho>

      <div className="card">
        <input placeholder="Buscar por nome, CPF/CNPJ ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="card">
        {lista.length === 0 ? (
          <div className="vazio">{dados.clientes.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</div>
        ) : (
          <>
            <div className="tabela-wrap so-desktop">
              <table>
                <thead>
                  <tr><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th>Endereço</th><th className="num">Aluguéis ativos</th></tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id} className="clicavel" onClick={() => navegar(`/clientes/${c.id}`)}>
                      <td><strong>{c.nome}</strong></td>
                      <td>{c.cpf_cnpj}</td>
                      <td>{c.telefone}</td>
                      <td>{c.endereco}</td>
                      <td className="num">{ativosPorCliente.get(c.id) ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lista-movel">
              {lista.map((c) => (
                <Link key={c.id} to={`/clientes/${c.id}`} className="item-lista">
                  <div className="linha1">
                    <span>{c.nome}</span>
                    {(ativosPorCliente.get(c.id) ?? 0) > 0 && <span className="tag ativo">{ativosPorCliente.get(c.id)} ativo(s)</span>}
                  </div>
                  <div className="linha2"><span>{c.telefone}</span><span>{c.cpf_cnpj}</span></div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {novo && <ClienteForm aoFechar={() => setNovo(false)} aoSalvar={(c) => navegar(`/clientes/${c.id}`)} />}
    </>
  )
}
