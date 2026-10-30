import { won } from '../supabaseClient'

export default function Cart({ items, onChangeQty, onRemove, onCheckout }) {
  const total = items.reduce((s, i) => s + i.quantity * i.products.price, 0)
  if (!items.length) return <p className="card muted">장바구니가 비어 있어요.</p>

  return (
    <section className="card">
      <h2>장바구니</h2>
      {items.map((i) => (
        <div className="line" key={i.id}>
          <span>{i.products.emoji} {i.products.name}</span>
          <span>{won(i.products.price)} ×</span>
          <input type="number" min="1" value={i.quantity} onChange={(e) => onChangeQty(i.id, Math.max(1, Number(e.target.value) || 1))} />
          <b>{won(i.quantity * i.products.price)}</b>
          <button className="x" onClick={() => onRemove(i.id)} aria-label="삭제">✕</button>
        </div>
      ))}
      <p className="total">총 {won(total)}</p>
      <button className="primary" onClick={onCheckout}>주문하기</button>
    </section>
  )
}
