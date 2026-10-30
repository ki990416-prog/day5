import { useCallback, useEffect, useState } from 'react'
import { supabase, hasSupabaseEnv } from './supabaseClient'
import Auth from './components/Auth'
import ProductCard from './components/ProductCard'
import Cart from './components/Cart'
import Orders from './components/Orders'

export default function App() {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('shop')
  const [products, setProducts] = useState([])
  const [likes, setLikes] = useState([])
  const [comments, setComments] = useState([])
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')

  const check = (res) => {
    if (res.error) setError(res.error.message)
    return res
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadPublic = useCallback(async () => {
    const [p, l, c] = await Promise.all([
      supabase.from('products').select('*').order('id'),
      supabase.from('likes').select('*'),
      supabase.from('comments').select('*').order('created_at'),
    ])
    check(p)
    setProducts(p.data ?? [])
    setLikes(l.data ?? [])
    setComments(c.data ?? [])
  }, [])

  const loadMine = useCallback(async () => {
    if (!user) {
      setCart([])
      setOrders([])
      return
    }
    const [c, o] = await Promise.all([
      supabase.from('cart_items').select('*, products(*)').order('id'),
      supabase.from('orders').select('*, order_items(*, products(name, emoji))').order('id', { ascending: false }),
    ])
    setCart(c.data ?? [])
    setOrders(o.data ?? [])
  }, [user])

  useEffect(() => {
    if (hasSupabaseEnv) loadPublic()
  }, [loadPublic])
  useEffect(() => {
    if (hasSupabaseEnv) loadMine()
  }, [loadMine])

  const needLogin = () => {
    setTab('auth')
    setError('로그인이 필요합니다.')
  }

  async function toggleLike(productId, liked) {
    if (!user) return needLogin()
    const q = supabase.from('likes')
    check(
      liked
        ? await q.delete().match({ user_id: user.id, product_id: productId })
        : await q.insert({ user_id: user.id, product_id: productId }),
    )
    loadPublic()
  }

  async function addComment(productId, content) {
    check(await supabase.from('comments').insert({ product_id: productId, user_id: user.id, author_email: user.email, content }))
    loadPublic()
  }

  async function deleteComment(id) {
    check(await supabase.from('comments').delete().eq('id', id))
    loadPublic()
  }

  async function addToCart(product, qty) {
    if (!user) return needLogin()
    const existing = cart.find((c) => c.product_id === product.id)
    check(
      existing
        ? await supabase.from('cart_items').update({ quantity: existing.quantity + qty }).eq('id', existing.id)
        : await supabase.from('cart_items').insert({ user_id: user.id, product_id: product.id, quantity: qty }),
    )
    loadMine()
  }

  async function changeCartQty(id, quantity) {
    check(await supabase.from('cart_items').update({ quantity }).eq('id', id))
    loadMine()
  }

  async function removeCart(id) {
    check(await supabase.from('cart_items').delete().eq('id', id))
    loadMine()
  }

  // items: [{ product_id, quantity, unit_price }]  → 합계(수량 x 가격)를 계산해 DB에 저장
  async function createOrder(items) {
    const address = window.prompt('배송지를 입력해 주세요')
    if (!address?.trim()) return false
    const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const { data: order, error: e1 } = await supabase
      .from('orders')
      .insert({ user_id: user.id, address: address.trim(), total_price: total })
      .select()
      .single()
    if (e1) {
      setError(e1.message)
      return false
    }
    const { error: e2 } = await supabase.from('order_items').insert(items.map((i) => ({ ...i, order_id: order.id })))
    if (e2) {
      setError(e2.message)
      return false
    }
    return true
  }

  async function buyNow(product, qty) {
    if (!user) return needLogin()
    if (await createOrder([{ product_id: product.id, quantity: qty, unit_price: product.price }])) {
      await loadMine()
      setTab('orders')
    }
  }

  async function checkout() {
    const ok = await createOrder(
      cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.products.price })),
    )
    if (ok) {
      check(await supabase.from('cart_items').delete().eq('user_id', user.id))
      await loadMine()
      setTab('orders')
    }
  }

  async function editOrderQty(itemId, quantity) {
    check(await supabase.from('order_items').update({ quantity }).eq('id', itemId))
    loadMine()
  }

  async function editAddress(order) {
    const address = window.prompt('새 배송지', order.address)
    if (!address?.trim()) return
    check(await supabase.from('orders').update({ address: address.trim() }).eq('id', order.id))
    loadMine()
  }

  async function returnOrder(id) {
    if (!window.confirm('이 주문을 반환할까요?')) return
    check(await supabase.from('orders').update({ status: 'returned' }).eq('id', id))
    loadMine()
  }

  if (!hasSupabaseEnv) {
    return (
      <div className="app">
        <p className="card error">
          .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정한 뒤 개발 서버를 다시 시작하세요.
        </p>
      </div>
    )
  }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  return (
    <div className="app">
      <header className="top">
        <h1 onClick={() => setTab('shop')}>🍊 제주 특산물 마켓</h1>
        <nav>
          <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>상품</button>
          <button className={tab === 'cart' ? 'on' : ''} onClick={() => (user ? setTab('cart') : needLogin())}>
            장바구니 {cartCount > 0 && `(${cartCount})`}
          </button>
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => (user ? setTab('orders') : needLogin())}>주문내역</button>
          {user ? (
            <button onClick={() => supabase.auth.signOut().then(() => setTab('shop'))}>로그아웃</button>
          ) : (
            <button className={tab === 'auth' ? 'on' : ''} onClick={() => setTab('auth')}>로그인</button>
          )}
        </nav>
      </header>

      {user && <p className="muted">{user.email} 님 환영합니다</p>}
      {error && <p className="error" onClick={() => setError('')}>⚠ {error}</p>}

      {tab === 'auth' && !user && <Auth />}
      {tab === 'shop' && (
        <section className="grid">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              user={user}
              likeCount={likes.filter((l) => l.product_id === p.id).length}
              liked={likes.some((l) => l.product_id === p.id && l.user_id === user?.id)}
              comments={comments.filter((c) => c.product_id === p.id)}
              onLike={toggleLike}
              onAddCart={addToCart}
              onBuy={buyNow}
              onComment={addComment}
              onDeleteComment={deleteComment}
            />
          ))}
        </section>
      )}
      {tab === 'cart' && user && <Cart items={cart} onChangeQty={changeCartQty} onRemove={removeCart} onCheckout={checkout} />}
      {tab === 'orders' && user && (
        <Orders orders={orders} onEditQty={editOrderQty} onEditAddress={editAddress} onReturn={returnOrder} />
      )}

      <footer>제주 특산물 마켓 · 학습용 프로젝트</footer>
    </div>
  )
}
