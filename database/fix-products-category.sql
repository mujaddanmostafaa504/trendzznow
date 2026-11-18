-- TrendzzNow hotfix for Supabase error 42703: column "category" does not exist
-- Safe additive change: does not drop tables or delete existing rows.
-- Run this once in Supabase SQL Editor, then rerun database/supabase-setup.sql.

alter table if exists public.products
  add column if not exists category text default 'Trending';

update public.products
   set category = 'Trending'
 where category is null or btrim(category) = '';

create index if not exists idx_products_category
  on public.products (category);

notify pgrst, 'reload schema';
