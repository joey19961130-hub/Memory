-- 已經執行過舊版 schema.sql 的專案，請在 SQL Editor 執行這一份（可重複執行）。
-- 新增：每個商品多張照片（images，第一張為封面）。Logo 存在 site_settings.data 裡，不需改表。
alter table public.products add column if not exists images text[] not null default '{}';

-- 把舊的單張照片搬進 images
update public.products
set images = array[image_url]
where coalesce(array_length(images, 1), 0) = 0 and image_url <> '';
