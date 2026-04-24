-- ═══════════════════════════════════════════════
-- 关键词矩阵 · Supabase 部署脚本
-- 在 Supabase → SQL Editor 中执行此文件
-- ═══════════════════════════════════════════════

-- 1. 删除旧表（如已存在，重新部署时使用）
drop table if exists articles cascade;
drop table if exists keywords cascade;

-- 2. 创建 keywords 表
create table keywords (
  id       serial primary key,
  kw       text        not null,
  type     text        not null default '长尾词',
  status   text        not null default 'pending',
  article  text                 default '',
  position text                 default '',
  priority text                 default '中',
  note     text                 default '',
  created_at timestamptz not null default now()
);

-- 3. 创建 articles 表
create table articles (
  id         serial primary key,
  title      text        not null,
  keywords   text[]               default '{}',
  status     text        not null default 'planned',
  created_at timestamptz not null default now()
);

-- 4. 索引
create index idx_keywords_status   on keywords(status);
create index idx_keywords_type     on keywords(type);
create index idx_keywords_priority on keywords(priority);
create index idx_articles_status   on articles(status);

-- 5. 开启 Row Level Security
alter table keywords enable row level security;
alter table articles enable row level security;

-- 6. 匿名访问策略（anon key 可读写）
create policy "keywords_anon_select" on keywords for select using (true);
create policy "keywords_anon_insert" on keywords for insert with check (true);
create policy "keywords_anon_update" on keywords for update using (true) with check (true);
create policy "keywords_anon_delete" on keywords for delete using (true);

create policy "articles_anon_select" on articles for select using (true);
create policy "articles_anon_insert" on articles for insert with check (true);
create policy "articles_anon_update" on articles for update using (true) with check (true);
create policy "articles_anon_delete" on articles for delete using (true);

-- 执行完成后，在网页「配置 API 密钥」中填入：
--   Supabase URL : https://naygxdeuyehiwazhlltt.supabase.co
--   Anon Key     : sb_publishable_8CX7M-Axh6zBFfNXNZFAmQ_2WLS7Uoj
