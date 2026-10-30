import { useCallback, useEffect, useState } from 'react'
import { supabase, hasSupabaseEnv } from './supabaseClient'
import Auth from './components/Auth'
import ProductCard from './components/ProductCard'
import Cart from './components/Cart'
import Orders from './components/Orders'
import Guestbook from './components/Guestbook'

export default function App() {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('shop')
  const [products, setProducts] = useState([])
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [likes, setLikes] = useState([])
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
    const [p, g, c, l] = await Promise.all([
      supabase.from('products').select('*').order('id'),
      supabase.from('guestbook_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('guestbook_comments').select('*').order('created_at'),
      supabase.from('guestbook_likes').select('*'),
    ])
    check(p)
    setProducts(p.data ?? [])
    setPosts(g.data ?? [])
    setComments(c.data ?? [])
    setLikes(l.data ?? [])
  }, [])

  const loadMine = useCallback(async () => {
    if (!user) {
      setCart([])
      setOrders([])
      return
    }
    const [c, o] = await Promise.all([
      supabase.from('cart_items').select('*, products(*)').order('id'),
      supabase.from('orders').select('*').order('id', { ascending: false }),
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
  const authorName = () => user.email.split('@')[0]

  // ---- 장바구니 ----
  async function addToCart(product, qty) {
    if (!user) return needLogin()
    const existing = cart.find((c) => c.product_id === product.id)
    check(
      existing
        ? await supabase.from('cart_items').update({ quantity: existing.quantity + qty }).eq('id', existing.id)
        : await supabase.from('cart_items').insert({ product_id: product.id, quantity: qty }),
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

  // ---- 주문 (total_price = 단가 x 수량은 DB가 계산) ----
  const orderRow = (product, quantity) => ({
    product_id: product.id,
    product_name: product.name,
    unit_price: product.price,
    quantity,
  })

  async function buyNow(product, qty) {
    if (!user) return needLogin()
    const { error: e } = await supabase.from('orders').insert(orderRow(product, qty))
    if (e) return setError(e.message)
    await loadMine()
    setTab('orders')
  }

  async function checkout() {
    const { error: e } = await supabase.from('orders').insert(cart.map((c) => orderRow(c.products, c.quantity)))
    if (e) return setError(e.message)
    check(await supabase.from('cart_items').delete().eq('user_id', user.id))
    await loadMine()
    setTab('orders')
  }

  async function editOrderQty(id, quantity) {
    check(await supabase.from('orders').update({ quantity }).eq('id', id))
    loadMine()
  }

  async function returnOrder(id) {
    if (!window.confirm('이 주문을 반환할까요?')) return
    check(await supabase.from('orders').update({ status: 'returned' }).eq('id', id))
    loadMine()
  }

  // ---- 방명록 ----
  async function addPost(content) {
    check(await supabase.from('guestbook_posts').insert({ author: authorName(), content }))
    loadPublic()
  }

  async function deletePost(id) {
    check(await supabase.from('guestbook_posts').delete().eq('id', id))
    loadPublic()
  }

  async function addComment(postId, content) {
    check(await supabase.from('guestbook_comments').insert({ post_id: postId, author: authorName(), content }))
    loadPublic()
  }

  async function deleteComment(id) {
    check(await supabase.from('guestbook_comments').delete().eq('id', id))
    loadPublic()
  }

  async function toggleLike(postId, liked) {
    if (!user) return needLogin()
    const q = supabase.from('guestbook_likes')
    check(
      liked
        ? await q.delete().match({ user_id: user.id, post_id: postId })
        : await q.insert({ post_id: postId }),
    )
    loadPublic()
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
  const guarded = (t) => () => (user ? setTab(t) : needLogin())

  return (
    <div className="app">
      <header className="top">
        <h1 onClick={() => setTab('shop')}>🍊 제주 특산물 마켓</h1>
        <nav>
          <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>상품</button>
          <button className={tab === 'guestbook' ? 'on' : ''} onClick={() => setTab('guestbook')}>방명록</button>
          <button className={tab === 'cart' ? 'on' : ''} onClick={guarded('cart')}>
            장바구니 {cartCount > 0 && `(${cartCount})`}
          </button>
          <button className={tab === 'orders' ? 'on' : ''} onClick={guarded('orders')}>주문내역</button>
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
            <ProductCard key={p.id} product={p} onAddCart={addToCart} onBuy={buyNow} />
          ))}
        </section>
      )}
      {tab === 'guestbook' && (
        <Guestbook
          user={user}
          posts={posts}
          comments={comments}
          likes={likes}
          onPost={addPost}
          onDeletePost={deletePost}
          onLike={toggleLike}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
        />
      )}
      {tab === 'cart' && user && <Cart items={cart} onChangeQty={changeCartQty} onRemove={removeCart} onCheckout={checkout} />}
      {tab === 'orders' && user && <Orders orders={orders} onEditQty={editOrderQty} onReturn={returnOrder} />}

      <footer>제주 특산물 마켓 · 학습용 프로젝트</footer>
    </div>
  )
}
