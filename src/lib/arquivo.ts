import { dentroDoClaude, usarCapacidade } from './db'

interface Downloads {
  save(req: { filename: string; data: Blob }): Promise<unknown>
}

/**
 * Entrega um arquivo para o usuário salvar. Dentro do claude.ai o download direto é bloqueado,
 * então o pedido passa pelo próprio Claude, que mostra uma confirmação antes de salvar.
 */
export async function salvarArquivo(nome: string, conteudo: Blob): Promise<void> {
  if (dentroDoClaude) {
    const downloads = await usarCapacidade<Downloads>('downloads')
    if (!downloads) throw new Error('Não foi possível baixar o arquivo aqui.')
    try {
      await downloads.save({ filename: nome, data: conteudo })
    } catch (e) {
      const codigo = (e as { code?: string })?.code
      if (codigo === 'declined') return
      throw new Error((e as { message?: string })?.message ?? 'Não foi possível baixar o arquivo.')
    }
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(conteudo)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
