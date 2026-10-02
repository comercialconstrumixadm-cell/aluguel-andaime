# Aluguel Andaime

Sistema de gestão de aluguel de andaimes, para uso interno: clientes, pedidos, estoque, financeiro e documentos (contrato, recibo e romaneio em PDF). Funciona no computador e no celular.

## O que o app faz

- **Painel**: devoluções atrasadas, aluguéis que vencem nos próximos dias, valores a receber e cauções a devolver.
- **Clientes**: nome, CPF/CNPJ, telefone e endereço, com o histórico de pedidos de cada cliente.
- **Produtos**: perna de andaime, roldana, piso e o que mais você quiser cadastrar. Cada produto tem:
  - preço por dia em faixas de dias (ex.: de 1 a 15 dias, R$ 2,00; a partir de 16 dias, R$ 1,20)
  - desconto em % por quantidade de peças
  - valor da peça, cobrado em caso de perda
- **Estoque**: total, alugado, em manutenção e disponível. Atualiza sozinho com os pedidos e as devoluções.
- **Pedidos**:
  - itens com cálculo automático do valor (e a opção de alterar o preço na hora)
  - retirada ou frete, com o valor do frete
  - caução, desconto e pagamento adiantado
  - prorrogação
  - devolução parcial, com peças danificadas e perdidas abatidas da caução
  - cobrança automática dos dias de atraso
- **Financeiro**: recebimentos do mês por forma de pagamento, clientes com valor em aberto e cauções a devolver.
- **Documentos em PDF**: contrato, recibo, romaneio de entrega/retirada e romaneio de devolução. No celular, o botão 📤 abre o compartilhamento direto pro WhatsApp.
- **Cobrança no WhatsApp**: abre a conversa com o cliente e a mensagem pronta (o texto pode ser editado em Configurações).

Sem o banco de dados configurado, o app roda em **modo demonstração**, com os dados salvos só no navegador.

---

## Como colocar no ar (uma vez só, uns 15 minutos)

### 1. Criar o banco de dados no Supabase

1. Acesse **https://supabase.com**, clique em **Start your project** e entre com sua conta do GitHub.
2. Clique em **New project**:
   - **Name**: `aluguel-andaime`
   - **Database Password**: clique em *Generate a password* (não precisa guardar)
   - **Region**: *South America (São Paulo)*
   - Clique em **Create new project** e espere uns 2 minutos.
3. No menu da esquerda, abra **SQL Editor** → **New query**. Cole todo o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Deve aparecer *Success*.
4. Crie o seu usuário de acesso: menu **Authentication** → **Users** → **Add user** → **Create new user**. Coloque seu e-mail e uma senha, marque **Auto Confirm User** e clique em **Create user**.
5. Bloqueie novos cadastros: **Authentication** → **Sign In / Providers** (ou *Settings*) → desligue **Allow new users to sign up** → **Save**.
6. Pegue as chaves: **Project Settings** (engrenagem) → **Data API** / **API**. Copie:
   - **Project URL** (ex.: `https://abcdxyz.supabase.co`)
   - **anon public** key (um texto longo que começa com `eyJ...`, ou a *publishable key*)

### 2. Publicar na Vercel

1. Acesse **https://vercel.com** e entre com sua conta do GitHub.
2. Clique em **Add New… → Project**, encontre o repositório **aluguel-andaime** e clique em **Import**.
   - Se ele não aparecer, clique em *Adjust GitHub App Permissions* e libere o repositório.
3. Abra **Environment Variables** e adicione as duas:
   - `VITE_SUPABASE_URL` = o Project URL do passo 1.6
   - `VITE_SUPABASE_ANON_KEY` = a chave anon/publishable do passo 1.6
4. Clique em **Deploy**. Quando terminar, a Vercel mostra o link do app (ex.: `aluguel-andaime.vercel.app`).

### 3. Usar no celular

Abra o link no navegador do celular e entre com o e-mail e a senha do passo 1.4. Para virar um "aplicativo" na tela inicial:
- **Android (Chrome)**: menu ⋮ → **Adicionar à tela inicial**
- **iPhone (Safari)**: botão compartilhar → **Adicionar à Tela de Início**

---

## Para desenvolvedores

```bash
npm install
cp .env.example .env.local   # opcional: sem isso roda em modo demonstração
npm run dev                  # http://localhost:5173
npm test                     # testes dos cálculos
npm run build
```

- React + TypeScript + Vite, Supabase (Postgres + login), jsPDF para os documentos.
- Regras de cálculo (preço, atraso, caução, estoque) em `src/lib/calc.ts`, com testes em `src/lib/calc.test.ts`.
- Esquema do banco em `supabase/schema.sql`.
