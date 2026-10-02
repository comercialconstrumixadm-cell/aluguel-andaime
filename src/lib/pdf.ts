import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { salvarArquivo } from './arquivo'
import type { ResumoPedido } from './calc'
import { dataBR, hoje, moeda, porExtenso } from './format'
import type { Cliente, Config, Pagamento, Pedido, Produto } from './types'

const MARGEM = 15
const LARGURA = 210 - MARGEM * 2

export interface DadosDoc {
  pedido: Pedido
  cliente: Cliente
  produtos: Produto[]
  resumo: ResumoPedido
  config: Config
}

type DocComCursor = jsPDF & { lastAutoTable?: { finalY: number } }

function novoDoc(): DocComCursor {
  return new jsPDF({ unit: 'mm', format: 'a4' }) as DocComCursor
}

function titulo(doc: jsPDF, texto: string, y: number, subtitulo?: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(texto, 105, y, { align: 'center' })
  if (subtitulo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(subtitulo, 105, y + 6, { align: 'center' })
    return y + 14
  }
  return y + 9
}

function paragrafo(doc: jsPDF, texto: string, y: number, tamanho = 10, negrito = false): number {
  doc.setFont('helvetica', negrito ? 'bold' : 'normal')
  doc.setFontSize(tamanho)
  const linhas = doc.splitTextToSize(texto, LARGURA) as string[]
  for (const linha of linhas) {
    if (y > 280) {
      doc.addPage()
      y = 20
    }
    doc.text(linha, MARGEM, y)
    y += tamanho * 0.45
  }
  return y + 1.5
}

function campos(doc: jsPDF, pares: [string, string][], y: number): number {
  doc.setFontSize(10)
  for (const [rotulo, valor] of pares) {
    if (!valor) continue
    doc.setFont('helvetica', 'bold')
    doc.text(`${rotulo}:`, MARGEM, y)
    doc.setFont('helvetica', 'normal')
    const linhas = doc.splitTextToSize(valor, LARGURA - 38) as string[]
    doc.text(linhas, MARGEM + 38, y)
    y += 5 * linhas.length
  }
  return y + 2
}

function assinatura(doc: jsPDF, x: number, y: number, largura: number, rotulo: string, detalhe?: string) {
  doc.setLineWidth(0.3)
  doc.line(x, y, x + largura, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(rotulo, x + largura / 2, y + 4.5, { align: 'center' })
  if (detalhe) doc.text(detalhe, x + largura / 2, y + 9, { align: 'center' })
}

function nomeProduto(produtos: Produto[], id: string): string {
  return produtos.find((p) => p.id === id)?.nome ?? 'Produto removido'
}

function blocoLocatario(cliente: Cliente, pedido: Pedido): [string, string][] {
  return [
    ['Nome', cliente.nome],
    ['CPF/CNPJ', cliente.cpf_cnpj],
    ['Telefone', cliente.telefone],
    ['Endereço', cliente.endereco],
    ['Endereço da obra', pedido.endereco_obra || cliente.endereco],
  ]
}

function aplicar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, chave: string) => vars[chave] ?? m)
}

export function gerarContrato({ pedido, cliente, produtos, resumo, config }: DadosDoc): jsPDF {
  const doc = novoDoc()
  let y = titulo(doc, 'CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS', 18, `Pedido nº ${pedido.numero}`)

  if (config.locador_nome) {
    y = paragrafo(doc, 'LOCADOR', y, 11, true)
    y = campos(doc, [
      ['Nome', config.locador_nome],
      ['CPF/CNPJ', config.locador_documento],
      ['Endereço', config.locador_endereco],
      ['Telefone', config.locador_telefone],
    ], y + 1)
  }

  y = paragrafo(doc, 'LOCATÁRIO', y, 11, true)
  y = campos(doc, blocoLocatario(cliente, pedido), y + 1)

  y = paragrafo(doc, 'PERÍODO E ENTREGA', y, 11, true)
  y = campos(doc, [
    ['Saída', dataBR(pedido.data_saida)],
    ['Devolução prevista', `${dataBR(pedido.data_prevista)} (${resumo.dias} ${resumo.dias === 1 ? 'dia' : 'dias'})`],
    ['Entrega', pedido.entrega === 'frete' ? `Frete - ${moeda(pedido.valor_frete)}` : 'Retirada pelo cliente'],
  ], y + 1)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM },
    head: [['Equipamento', 'Qtd.', 'Diária/peça', 'Dias', 'Subtotal']],
    body: pedido.itens.map((i) => [
      nomeProduto(produtos, i.produto_id),
      String(i.quantidade),
      moeda(i.valor_dia),
      String(resumo.dias),
      moeda(i.quantidade * i.valor_dia * resumo.dias),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  const totais: [string, string][] = [['Aluguel', moeda(resumo.aluguel)]]
  if (resumo.frete) totais.push(['Frete', moeda(resumo.frete)])
  if (resumo.desconto) totais.push(['Desconto', `- ${moeda(resumo.desconto)}`])
  totais.push(['Total', moeda(resumo.aluguel + resumo.frete - resumo.desconto)])
  if (pedido.caucao) totais.push(['Caução', moeda(pedido.caucao)])
  y = campos(doc, totais, y)

  const vars = {
    cidade: config.cidade || '____________',
    cliente: cliente.nome,
    numero: String(pedido.numero),
  }
  y = paragrafo(doc, 'CLÁUSULAS', y + 2, 11, true)
  for (const bloco of aplicar(config.contrato_clausulas, vars).split(/\n+/)) {
    y = paragrafo(doc, bloco.trim(), y, 9)
  }
  if (pedido.observacoes) {
    y = paragrafo(doc, 'OBSERVAÇÕES', y + 2, 11, true)
    y = paragrafo(doc, pedido.observacoes, y, 9)
  }

  if (y > 245) {
    doc.addPage()
    y = 30
  }
  y = paragrafo(doc, `${config.cidade ? config.cidade + ', ' : ''}${dataBR(hoje())}.`, y + 6, 10)
  assinatura(doc, MARGEM, y + 20, 80, 'LOCADOR', config.locador_nome || undefined)
  assinatura(doc, 210 - MARGEM - 80, y + 20, 80, 'LOCATÁRIO', cliente.nome)
  return doc
}

export function gerarRecibo({ pedido, cliente, config }: DadosDoc, pagamento: Pagamento): jsPDF {
  const doc = novoDoc()
  let y = titulo(doc, 'RECIBO', 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(moeda(pagamento.valor), 210 - MARGEM, 22, { align: 'right' })

  const referente =
    pagamento.tipo === 'caucao_recebida'
      ? `caução da locação de equipamentos do pedido nº ${pedido.numero}`
      : pagamento.tipo === 'caucao_devolvida'
        ? `devolução de caução do pedido nº ${pedido.numero}`
        : `locação de equipamentos do pedido nº ${pedido.numero}`
  const forma = { pix: 'Pix', dinheiro: 'dinheiro', cartao: 'cartão', transferencia: 'transferência', outro: 'outro meio' }[pagamento.forma]
  const docCliente = cliente.cpf_cnpj ? `, CPF/CNPJ ${cliente.cpf_cnpj}` : ''

  const texto =
    pagamento.tipo === 'caucao_devolvida'
      ? `Eu, ${cliente.nome}${docCliente}, declaro que recebi a quantia de ${moeda(pagamento.valor)} (${porExtenso(pagamento.valor)}), referente à ${referente}, paga em ${forma}.`
      : `Recebi de ${cliente.nome}${docCliente}, a quantia de ${moeda(pagamento.valor)} (${porExtenso(pagamento.valor)}), referente à ${referente}, paga em ${forma}.`
  y = paragrafo(doc, texto, y + 8, 11)
  if (pagamento.observacoes) y = paragrafo(doc, `Observação: ${pagamento.observacoes}`, y + 2, 10)
  y = paragrafo(doc, `${config.cidade ? config.cidade + ', ' : ''}${dataBR(pagamento.data)}.`, y + 8, 11)

  const quemAssina = pagamento.tipo === 'caucao_devolvida' ? cliente.nome : config.locador_nome
  assinatura(doc, 105 - 45, y + 25, 90, quemAssina || 'Assinatura', config.locador_nome && pagamento.tipo !== 'caucao_devolvida' ? config.locador_documento : undefined)
  return doc
}

/** Romaneio com as peças do pedido; `pecas` permite listar só o que falta voltar. */
export function gerarRomaneio({ pedido, cliente, produtos, resumo }: DadosDoc, tipo: 'saida' | 'devolucao'): jsPDF {
  const doc = novoDoc()
  const nomeTipo =
    tipo === 'devolucao'
      ? 'ROMANEIO DE DEVOLUÇÃO'
      : pedido.entrega === 'frete'
        ? 'ROMANEIO DE ENTREGA'
        : 'ROMANEIO DE RETIRADA'
  let y = titulo(doc, nomeTipo, 18, `Pedido nº ${pedido.numero} - ${dataBR(tipo === 'saida' ? pedido.data_saida : hoje())}`)

  y = campos(doc, [
    ['Cliente', cliente.nome],
    ['Telefone', cliente.telefone],
    ['Endereço da obra', pedido.endereco_obra || cliente.endereco],
    ['Entrega', pedido.entrega === 'frete' ? 'Frete (entrega na obra)' : 'Retirada pelo cliente'],
    ['Devolução prevista', dataBR(pedido.data_prevista)],
  ], y)

  const linhas = resumo.itens
    .filter((i) => (tipo === 'saida' ? i.quantidade : i.pendentes) > 0)
    .map((i) => [nomeProduto(produtos, i.produto_id), String(tipo === 'saida' ? i.quantidade : i.pendentes), ''])
  const total = linhas.reduce((s, l) => s + Number(l[1]), 0)

  autoTable(doc, {
    startY: y + 2,
    margin: { left: MARGEM, right: MARGEM },
    head: [['Item', 'Quantidade', 'Conferido']],
    body: linhas,
    foot: [['Total de peças', String(total), '']],
    styles: { fontSize: 11, minCellHeight: 9, valign: 'middle' },
    headStyles: { fillColor: [40, 40, 40] },
    footStyles: { fillColor: [235, 235, 235], textColor: 20 },
    columnStyles: { 1: { halign: 'center', cellWidth: 35 }, 2: { cellWidth: 35 } },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 10

  y = paragrafo(doc, 'Observações:', y, 10, true)
  doc.setLineWidth(0.2)
  for (let i = 0; i < 3; i++) doc.line(MARGEM, y + 6 + i * 8, 210 - MARGEM, y + 6 + i * 8)
  y += 40

  if (y > 250) {
    doc.addPage()
    y = 40
  }
  paragrafo(
    doc,
    tipo === 'saida'
      ? 'Declaro que recebi os itens acima, conferidos e em perfeito estado.'
      : 'Declaro que os itens acima foram devolvidos e conferidos.',
    y - 8,
    9,
  )
  assinatura(doc, 105 - 50, y + 12, 100, 'Assinatura de quem recebeu', 'Nome legível / Documento / Data')
  return doc
}

function nomeArquivo(prefixo: string, pedido: Pedido, cliente: Cliente): string {
  const nome = cliente.nome.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
  return `${prefixo}-pedido-${pedido.numero}-${nome || 'cliente'}.pdf`
}

/** Abre o compartilhamento do celular (WhatsApp etc.) ou baixa o PDF no computador. */
export async function entregarPdf(doc: jsPDF, prefixo: string, pedido: Pedido, cliente: Cliente, compartilhar: boolean) {
  const nome = nomeArquivo(prefixo, pedido, cliente)
  if (compartilhar) {
    const arquivo = new File([doc.output('blob')], nome, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: nome })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
  }
  await salvarArquivo(nome, doc.output('blob'))
}
