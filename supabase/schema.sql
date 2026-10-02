-- Banco de dados do Aluguel Andaime.
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo sem perder dados (só cria o que ainda não existe).

create table if not exists produtos (
  id uuid primary key,
  nome text not null,
  unidade text not null default 'peça',
  quantidade_total integer not null default 0,
  quantidade_manutencao integer not null default 0,
  valor_reposicao numeric(12,2) not null default 0,
  faixas_dias jsonb not null default '[]',
  faixas_qtd jsonb not null default '[]',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key,
  nome text not null,
  cpf_cnpj text not null default '',
  telefone text not null default '',
  endereco text not null default '',
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists pedidos (
  id uuid primary key,
  numero integer not null unique,
  cliente_id uuid not null references clientes(id) on delete restrict,
  endereco_obra text not null default '',
  data_saida date not null,
  data_prevista date not null,
  entrega text not null default 'retirada' check (entrega in ('retirada', 'frete')),
  valor_frete numeric(12,2) not null default 0,
  caucao numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  observacoes text not null default '',
  cancelado boolean not null default false,
  itens jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists devolucoes (
  id uuid primary key,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  data date not null,
  itens jsonb not null default '[]',
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists pagamentos (
  id uuid primary key,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  data date not null,
  valor numeric(12,2) not null,
  forma text not null check (forma in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  tipo text not null check (tipo in ('aluguel', 'caucao_recebida', 'caucao_devolvida')),
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists configuracoes (
  id text primary key,
  locador_nome text not null default '',
  locador_documento text not null default '',
  locador_endereco text not null default '',
  locador_telefone text not null default '',
  cidade text not null default '',
  contrato_clausulas text not null default '',
  mensagem_cobranca text not null default ''
);

create index if not exists pedidos_cliente_idx on pedidos (cliente_id);
create index if not exists devolucoes_pedido_idx on devolucoes (pedido_id);
create index if not exists pagamentos_pedido_idx on pagamentos (pedido_id);

-- Segurança: só quem fez login no app consegue ler e alterar os dados.
do $$
declare t text;
begin
  foreach t in array array['produtos', 'clientes', 'pedidos', 'devolucoes', 'pagamentos', 'configuracoes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "acesso_logado" on %I', t);
    execute format('create policy "acesso_logado" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
