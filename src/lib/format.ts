import type { FormaPagamento } from './types'

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(valor: number): string {
  return moedaFmt.format(Number.isFinite(valor) ? valor : 0)
}

export function arred(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** Data de hoje no fuso local, no formato AAAA-MM-DD. */
export function hoje(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function paraUTC(data: string): number {
  const [a, m, d] = data.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

/** Quantidade de dias de `de` até `ate` (pode ser negativa). */
export function diffDias(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000)
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(paraUTC(data) + dias * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function dataBR(data: string): string {
  if (!data) return ''
  const [a, m, d] = data.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function mascaraCpfCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function mascaraTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function linkWhatsApp(telefone: string, mensagem: string): string {
  let d = soDigitos(telefone)
  if (d.length === 10 || d.length === 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`
}

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c) partes.push(CENTENAS[c])
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto])
  } else {
    const dz = Math.floor(resto / 10)
    const u = resto % 10
    partes.push(u ? `${DEZENAS[dz]} e ${UNIDADES[u]}` : DEZENAS[dz])
  }
  return partes.join(' e ')
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`)
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`)
  if (resto) partes.push(ate999(resto))
  if (partes.length > 1 && resto && (resto < 100 || resto % 100 === 0)) {
    const ultimo = partes.pop()!
    return `${partes.join(' ')} e ${ultimo}`
  }
  return partes.join(' ')
}

/** Valor em reais por extenso, ex.: 1250.5 → "mil duzentos e cinquenta reais e cinquenta centavos". */
export function porExtenso(valor: number): string {
  const centavosTotal = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(centavosTotal / 100)
  const centavos = centavosTotal % 100
  const partes: string[] = []
  if (reais) {
    const de = reais % 1_000_000 === 0 ? 'de ' : ''
    partes.push(`${inteiroPorExtenso(reais)} ${de}${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  if (!partes.length) return 'zero reais'
  return partes.join(' e ')
}

export const FORMAS: { id: FormaPagamento; nome: string }[] = [
  { id: 'pix', nome: 'Pix' },
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'cartao', nome: 'Cartão' },
  { id: 'transferencia', nome: 'Transferência' },
  { id: 'outro', nome: 'Outro' },
]
