import { useState } from 'react'
import { won } from '../supabaseClient'

export default function ProductCard({ product, onAddCart, onBuy }) {
  const [qty, setQty] = useState(1)

  return (
    <article className="product">
      <div className="emoji">{product.emoji}</div>
      <h3>{product.name}</h3>
      <p className="desc">{product.description}</p>
      <p className="price">{won(product.price)}</p>

      <div className="row">
        <input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        <span className="sum">합계 {won(qty * product.price)}</span>
      </div>
      <div className="row">
        <button onClick={() => onAddCart(product, qty)}>🛒 담기</button>
        <button className="primary" onClick={() => onBuy(product, qty)}>바로 구매</button>
      </div>
    </article>
  )
}
