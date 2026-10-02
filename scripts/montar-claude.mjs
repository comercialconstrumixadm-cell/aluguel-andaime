// Converte dist-claude/index.html no formato que o claude.ai publica: só o conteúdo da página,
// sem <!doctype>, <html>, <head> e <body> (o claude.ai coloca essa moldura sozinho).
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist-claude/index.html', 'utf8')
const pegar = (re) => [...html.matchAll(re)].map((m) => m[0])
const titulo = pegar(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Aluguel Andaime</title>'
const estilos = pegar(/<style[\s\S]*?<\/style>/g).join('\n')
const scripts = pegar(/<script[\s\S]*?<\/script>/g).join('\n')
const pagina = `${titulo}\n${estilos}\n<div id="root"></div>\n${scripts}\n`
writeFileSync('dist-claude/aluguel-andaime.html', pagina)
console.log(`dist-claude/aluguel-andaime.html: ${(pagina.length / 1024).toFixed(0)} KB`)
