-- 제주 특산물 쇼핑몰 스키마 (Supabase SQL Editor에서 한 번에 실행)

-- 1. 상품
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text not null,
  emoji       text not null default '🍊',
  description text,
  price       integer not null check (price >= 0),
  created_at  timestamptz not null default now()
);

-- 2. 장바구니 (회원당 상품 1행, 수량만 증감)
create table if not exists cart_items (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  unique (user_id, product_id)
);

-- 3. 주문 (status: ordered 주문완료 / returned 반환)
create table if not exists orders (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  address     text not null,
  total_price integer not null default 0,
  status      text not null default 'ordered' check (status in ('ordered','returned')),
  created_at  timestamptz not null default now()
);

-- 4. 주문 상품 (total_price = 수량 x 단가, DB가 자동 계산)
create table if not exists order_items (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  product_id  bigint not null references products(id),
  quantity    integer not null check (quantity > 0),
  unit_price  integer not null check (unit_price >= 0),
  total_price integer generated always as (quantity * unit_price) stored
);

-- 5. 좋아요
create table if not exists likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- 6. 방명록 댓글
create table if not exists comments (
  id           bigint generated always as identity primary key,
  product_id   bigint not null references products(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  content      text not null check (char_length(content) between 1 and 500),
  created_at   timestamptz not null default now()
);

-- 주문 상품이 바뀌면 주문 합계(orders.total_price)를 다시 계산
create or replace function recalc_order_total() returns trigger
language plpgsql security definer as $$
declare oid bigint := coalesce(new.order_id, old.order_id);
begin
  update orders
     set total_price = coalesce((select sum(total_price) from order_items where order_id = oid), 0)
   where id = oid;
  return null;
end $$;

drop trigger if exists trg_recalc_order_total on order_items;
create trigger trg_recalc_order_total
after insert or update or delete on order_items
for each row execute function recalc_order_total();

-- RLS
alter table products    enable row level security;
alter table cart_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table likes       enable row level security;
alter table comments    enable row level security;

create policy "products_read" on products for select using (true);

create policy "cart_own" on cart_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "orders_own" on orders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "order_items_own" on order_items for all
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()))
  with check (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

create policy "likes_read"  on likes for select using (true);
create policy "likes_write" on likes for insert with check (auth.uid() = user_id);
create policy "likes_del"   on likes for delete using (auth.uid() = user_id);

create policy "comments_read"  on comments for select using (true);
create policy "comments_write" on comments for insert with check (auth.uid() = user_id);
create policy "comments_del"   on comments for delete using (auth.uid() = user_id);

-- 상품 시드 (가격은 임의 설정)
insert into products (name, emoji, description, price) values
 ('한라봉',          '🍊', '새콤달콤한 제주 한라봉 3kg',            23800),
 ('감귤',            '🍊', '당도 높은 노지 감귤 5kg',               14500),
 ('천혜향',          '🍊', '향이 진한 천혜향 2kg',                   27900),
 ('흑돼지 오겹살',   '🐖', '제주 흑돼지 오겹살 500g (냉동)',         19800),
 ('제주 갈치',       '🐟', '은갈치 3마리 세트',                      38600),
 ('옥돔',            '🐠', '손질 옥돔 3미',                          45200),
 ('말린 전복',       '🐚', '제주 말린 전복 200g',                    52300),
 ('제주 녹차',       '🍵', '햇녹차 티백 20입',                       11700),
 ('감귤 초콜릿',     '🍫', '감귤 칩이 들어간 초콜릿 3박스',           9900),
 ('우도 땅콩 막걸리','🥜', '우도 땅콩을 넣은 막걸리 4병',            16400);
