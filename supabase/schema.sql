-- 在 Supabase Dashboard → SQL Editor 貼上並執行一次即可。

-- 主頁內容（只有一列，id = 1）
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 商品
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  price integer check (price is null or price >= 0),
  description text not null default '',
  image_url text not null default '',
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
alter table public.products enable row level security;

-- 所有人可讀；只有登入的管理員可寫
drop policy if exists "settings read" on public.site_settings;
create policy "settings read" on public.site_settings for select using (true);
drop policy if exists "settings write" on public.site_settings;
create policy "settings write" on public.site_settings for all to authenticated using (true) with check (true);

drop policy if exists "products read published" on public.products;
create policy "products read published" on public.products for select using (published or auth.role() = 'authenticated');
drop policy if exists "products write" on public.products;
create policy "products write" on public.products for all to authenticated using (true) with check (true);

-- 圖片儲存空間（公開讀取）
insert into storage.buckets (id, name, public) values ('images', 'images', true)
on conflict (id) do update set public = true;

drop policy if exists "images read" on storage.objects;
create policy "images read" on storage.objects for select using (bucket_id = 'images');
drop policy if exists "images write" on storage.objects;
create policy "images write" on storage.objects for insert to authenticated with check (bucket_id = 'images');
drop policy if exists "images update" on storage.objects;
create policy "images update" on storage.objects for update to authenticated using (bucket_id = 'images');
drop policy if exists "images delete" on storage.objects;
create policy "images delete" on storage.objects for delete to authenticated using (bucket_id = 'images');
