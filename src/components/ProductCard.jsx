import { useState } from 'react'
import { won } from '../supabaseClient'

export default function ProductCard({ product, user, likeCount, liked, comments, onLike, onAddCart, onBuy, onComment, onDeleteComment }) {
  const [qty, setQty] = useState(1)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  async function submitComment(e) {
    e.preventDefault()
    if (!text.trim()) return
    await onComment(product.id, text.trim())
    setText('')
  }

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
        <button className={liked ? 'liked' : ''} onClick={() => onLike(product.id, liked)}>
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
      </div>

      <button className="link" onClick={() => setOpen(!open)}>💬 방명록 ({comments.length})</button>
      {open && (
        <div className="comments">
          {comments.map((c) => (
            <p key={c.id}>
              <b>{c.author_email.split('@')[0]}</b> {c.content}
              {user?.id === c.user_id && (
                <button className="x" onClick={() => onDeleteComment(c.id)} aria-label="삭제">✕</button>
              )}
            </p>
          ))}
          {user ? (
            <form className="row" onSubmit={submitComment}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="댓글을 남겨보세요" maxLength={500} />
              <button>등록</button>
            </form>
          ) : (
            <p className="muted">로그인하면 댓글을 쓸 수 있어요.</p>
          )}
        </div>
      )}
    </article>
  )
}
