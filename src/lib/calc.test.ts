import { describe, expect, it } from 'vitest'
import { estoque, precoDia, resumoPedido } from './calc'
import { porExtenso } from './format'
import type { Devolucao, Pagamento, Pedido, Produto } from './types'

const perna: Produto = {
  id: 'perna',
  nome: 'Perna de andaime',
  unidade: 'peça',
  quantidade_total: 100,
  quantidade_manutencao: 0,
  valor_reposicao: 150,
  faixas_dias: [
    { dias_min: 16, valor_dia: 1.2 },
    { dias_min: 1, valor_dia: 2 },
  ],
  faixas_qtd: [{ qtd_min: 50, desconto_pct: 10 }],
  ativo: true,
  created_at: '',
}

const pedido: Pedido = {
  id: 'p1',
  numero: 1,
  cliente_id: 'c1',
  endereco_obra: '',
  data_saida: '2026-10-01',
  data_prevista: '2026-10-11',
  entrega: 'frete',
  valor_frete: 50,
  caucao: 200,
  desconto: 0,
  observacoes: '',
  cancelado: false,
  itens: [{ produto_id: 'perna', quantidade: 20, valor_dia: 2 }],
  created_at: '',
}

function pag(valor: number, tipo: Pagamento['tipo']): Pagamento {
  return { id: Math.random().toString(), pedido_id: 'p1', data: '2026-10-01', valor, forma: 'pix', tipo, observacoes: '', created_at: '' }
}

describe('precoDia', () => {
  it('usa a faixa de dias correta', () => {
    expect(precoDia(perna, 8, 10)).toBe(2)
    expect(precoDia(perna, 15, 10)).toBe(2)
    expect(precoDia(perna, 16, 10)).toBe(1.2)
  })
  it('aplica desconto por quantidade', () => {
    expect(precoDia(perna, 10, 50)).toBe(1.8)
    expect(precoDia(perna, 20, 60)).toBe(1.08)
  })
  it('retorna zero sem faixas', () => {
    expect(precoDia({ ...perna, faixas_dias: [] }, 5, 5)).toBe(0)
  })
})

describe('resumoPedido', () => {
  it('calcula o aluguel adiantado e o saldo', () => {
    const r = resumoPedido(pedido, [], [pag(450, 'aluguel')], '2026-10-05')
    expect(r.dias).toBe(10)
    expect(r.aluguel).toBe(400)
    expect(r.total).toBe(450)
    expect(r.saldo).toBe(0)
    expect(r.status).toBe('ativo')
    expect(r.atrasado).toBe(false)
  })

  it('cobra dias extras das peças ainda com o cliente', () => {
    const r = resumoPedido(pedido, [], [pag(450, 'aluguel')], '2026-10-14')
    expect(r.diasAtraso).toBe(3)
    expect(r.atraso).toBe(120)
    expect(r.saldo).toBe(120)
    expect(r.atrasado).toBe(true)
  })

  it('devolução parcial e avarias abatidas da caução', () => {
    const dev: Devolucao = {
      id: 'd1',
      pedido_id: 'p1',
      data: '2026-10-11',
      observacoes: '',
      created_at: '',
      itens: [{ produto_id: 'perna', ok: 15, danificada: 1, perdida: 1, valor_danificada: 30, valor_perdida: 150 }],
    }
    const pags = [pag(450, 'aluguel'), pag(200, 'caucao_recebida')]
    const r = resumoPedido(pedido, [dev], pags, '2026-10-11')
    expect(r.status).toBe('parcial')
    expect(r.pecasPendentes).toBe(3)
    expect(r.avarias).toBe(180)
    expect(r.caucaoAbatida).toBe(180)
    expect(r.caucaoADevolver).toBe(20)
    expect(r.saldo).toBe(0)

    const dev2: Devolucao = { ...dev, id: 'd2', data: '2026-10-13', itens: [{ ...dev.itens[0], ok: 3, danificada: 0, perdida: 0 }] }
    const r2 = resumoPedido(pedido, [dev, dev2], [...pags, pag(12, 'aluguel'), pag(20, 'caucao_devolvida')], '2026-10-20')
    expect(r2.atraso).toBe(12)
    expect(r2.saldo).toBe(0)
    expect(r2.caucaoADevolver).toBe(0)
    expect(r2.status).toBe('finalizado')
  })

  it('pedido cancelado não gera cobrança', () => {
    const r = resumoPedido({ ...pedido, cancelado: true }, [], [], '2026-12-01')
    expect(r.total).toBe(0)
    expect(r.status).toBe('cancelado')
  })
})

describe('estoque', () => {
  it('desconta as peças alugadas e as devolvidas', () => {
    const dev: Devolucao = {
      id: 'd1', pedido_id: 'p1', data: '2026-10-11', observacoes: '', created_at: '',
      itens: [{ produto_id: 'perna', ok: 5, danificada: 0, perdida: 0, valor_danificada: 0, valor_perdida: 0 }],
    }
    const [linha] = estoque([{ ...perna, quantidade_manutencao: 2 }], [pedido], [dev])
    expect(linha.alugado).toBe(15)
    expect(linha.disponivel).toBe(83)
    const [semEste] = estoque([perna], [pedido], [dev], 'p1')
    expect(semEste.alugado).toBe(0)
  })
})

describe('porExtenso', () => {
  it('escreve valores', () => {
    expect(porExtenso(1)).toBe('um real')
    expect(porExtenso(450)).toBe('quatrocentos e cinquenta reais')
    expect(porExtenso(1250.5)).toBe('mil duzentos e cinquenta reais e cinquenta centavos')
    expect(porExtenso(2100)).toBe('dois mil e cem reais')
    expect(porExtenso(0.01)).toBe('um centavo')
  })
})
