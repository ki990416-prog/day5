-- 1. 상품
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text    not null,
  description text,
  emoji       text,
  price       integer not null check (price > 0),
  created_at  timestamptz default now()
);

-- 2. 장바구니
create table if not exists cart_items (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0),
  unique (user_id, product_id)
);

-- 3. 주문 (total_price = 수량 x 단가, DB가 자동 계산)
create table if not exists orders (
  id           bigint generated always as identity primary key,
  user_id      uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  product_id   bigint references products(id) on delete set null,
  product_name text    not null,
  unit_price   integer not null,
  quantity     integer not null check (quantity > 0),
  total_price  integer generated always as (unit_price * quantity) stored,
  status       text    not null default 'ordered' check (status in ('ordered', 'returned')),
  created_at   timestamptz default now()
);

-- 4. 방명록 / 댓글 / 좋아요
create table if not exists guestbook_posts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author     text not null,
  content    text not null,
  created_at timestamptz default now()
);

create table if not exists guestbook_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references guestbook_posts(id) on delete cascade,
  user_id    uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  author     text   not null,
  content    text   not null,
  created_at timestamptz default now()
);

create table if not exists guestbook_likes (
  post_id bigint not null references guestbook_posts(id) on delete cascade,
  user_id uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

-- 5. RLS (행 단위 보안)
alter table products            enable row level security;
alter table cart_items          enable row level security;
alter table orders              enable row level security;
alter table guestbook_posts     enable row level security;
alter table guestbook_comments  enable row level security;
alter table guestbook_likes     enable row level security;

create policy "products read" on products for select using (true);

create policy "cart own"   on cart_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders own" on orders     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "posts read"   on guestbook_posts for select using (true);
create policy "posts insert" on guestbook_posts for insert with check (auth.uid() = user_id);
create policy "posts delete" on guestbook_posts for delete using (auth.uid() = user_id);

create policy "comments read"   on guestbook_comments for select using (true);
create policy "comments insert" on guestbook_comments for insert with check (auth.uid() = user_id);
create policy "comments delete" on guestbook_comments for delete using (auth.uid() = user_id);

create policy "likes read"   on guestbook_likes for select using (true);
create policy "likes insert" on guestbook_likes for insert with check (auth.uid() = user_id);
create policy "likes delete" on guestbook_likes for delete using (auth.uid() = user_id);

-- 6. 상품 샘플 데이터 (가격은 임의 설정)
insert into products (name, description, emoji, price) values
  ('한라봉 3kg',         '달콤새콤 제주 한라봉 선물세트',     '🍊', 28700),
  ('천혜향 2kg',         '향이 진한 프리미엄 천혜향',         '🍊', 34300),
  ('흑돼지 오겹살 600g', '쫄깃고소한 제주 흑돼지 구이용',     '🐖', 31900),
  ('옥돔 3마리',         '제주 바다에서 잡은 손질 옥돔',      '🐟', 45200),
  ('갈치 2마리',         '은빛 제주 은갈치 (대)',             '🐟', 39800),
  ('제주 감귤 초콜릿',   '감귤 풍미 가득한 수제 초콜릿',      '🍫', 12600),
  ('오메기떡 10개입',    '쫀득한 제주 전통 오메기떡',         '🍡', 17400),
  ('우도 땅콩 막걸리',   '우도 땅콩으로 빚은 고소한 막걸리',  '🍶',  9300),
  ('제주 말차 세트',     '제주 오설록 스타일 말차 티백 세트', '🍵', 21500),
  ('성게 미역국 세트',   '제주 성게알이 듬뿍 든 간편 미역국', '🥣', 24900);
