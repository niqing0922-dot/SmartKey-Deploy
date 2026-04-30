create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  keyword text not null,
  type text not null default 'core',
  priority text not null default 'medium',
  status text not null default 'pending',
  notes text not null default '',
  position text not null default '',
  related_article text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content text not null default '',
  status text not null default 'draft',
  keyword_ids_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists geo_article_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  primary_keyword text not null,
  secondary_keywords_json jsonb not null default '[]'::jsonb,
  audience text not null default '',
  industry text not null default '',
  target_market text not null default '',
  article_type text not null default '',
  tone text not null default '',
  target_length integer not null default 1200,
  brief_json jsonb not null default '{}'::jsonb,
  title_options_json jsonb not null default '[]'::jsonb,
  meta_title text not null default '',
  meta_description text not null default '',
  outline_json jsonb not null default '[]'::jsonb,
  draft_sections_json jsonb not null default '[]'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  suggestions_json jsonb not null default '[]'::jsonb,
  provider text not null default 'system',
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user on workspace_members(user_id);
create index if not exists idx_keywords_workspace_status on keywords(workspace_id, status);
create index if not exists idx_keywords_workspace_type on keywords(workspace_id, type);
create index if not exists idx_keywords_workspace_priority on keywords(workspace_id, priority);
create index if not exists idx_articles_workspace_updated on articles(workspace_id, updated_at desc);
create index if not exists idx_geo_drafts_workspace_updated on geo_article_drafts(workspace_id, updated_at desc);

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table keywords enable row level security;
alter table articles enable row level security;
alter table geo_article_drafts enable row level security;
alter table app_settings enable row level security;

create policy "profiles_self_select" on profiles for select using (id = auth.uid());
create policy "profiles_self_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_self_update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_member_select" on workspaces for select using (
  exists (select 1 from workspace_members wm where wm.workspace_id = id and wm.user_id = auth.uid())
);
create policy "workspaces_owner_insert" on workspaces for insert with check (created_by = auth.uid());
create policy "workspaces_member_update" on workspaces for update using (
  exists (select 1 from workspace_members wm where wm.workspace_id = id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin', 'editor'))
);

create policy "workspace_members_self_select" on workspace_members for select using (user_id = auth.uid());
create policy "workspace_members_owner_write" on workspace_members for all using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

create policy "keywords_member_all" on keywords for all using (
  exists (select 1 from workspace_members wm where wm.workspace_id = keywords.workspace_id and wm.user_id = auth.uid())
) with check (
  exists (select 1 from workspace_members wm where wm.workspace_id = keywords.workspace_id and wm.user_id = auth.uid())
);

create policy "articles_member_all" on articles for all using (
  exists (select 1 from workspace_members wm where wm.workspace_id = articles.workspace_id and wm.user_id = auth.uid())
) with check (
  exists (select 1 from workspace_members wm where wm.workspace_id = articles.workspace_id and wm.user_id = auth.uid())
);

create policy "geo_drafts_member_all" on geo_article_drafts for all using (
  exists (select 1 from workspace_members wm where wm.workspace_id = geo_article_drafts.workspace_id and wm.user_id = auth.uid())
) with check (
  exists (select 1 from workspace_members wm where wm.workspace_id = geo_article_drafts.workspace_id and wm.user_id = auth.uid())
);

create policy "app_settings_member_all" on app_settings for all using (
  exists (select 1 from workspace_members wm where wm.workspace_id = app_settings.workspace_id and wm.user_id = auth.uid())
) with check (
  exists (select 1 from workspace_members wm where wm.workspace_id = app_settings.workspace_id and wm.user_id = auth.uid())
);
