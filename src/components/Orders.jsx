import { won } from '../supabaseClient'

export default function Orders({ orders, onEditQty, onReturn }) {
  if (!orders.length) return <p className="card muted">주문 내역이 없어요.</p>

  return (
    <section className="card">
      <h2>주문내역</h2>
      {orders.map((o) => (
        <div className="line" key={o.id}>
          <span>
            {o.product_name} <span className={`badge ${o.status}`}>{o.status === 'ordered' ? '주문완료' : '반환됨'}</span>
            <br />
            <small className="muted">{new Date(o.created_at).toLocaleString('ko-KR')}</small>
          </span>
          <span>{won(o.unit_price)} ×</span>
          {o.status === 'ordered' ? (
            <input
              type="number"
              min="1"
              defaultValue={o.quantity}
              onBlur={(e) => Number(e.target.value) !== o.quantity && onEditQty(o.id, Math.max(1, Number(e.target.value) || 1))}
            />
          ) : (
            <span>{o.quantity}</span>
          )}
          <b>{won(o.total_price)}</b>
          {o.status === 'ordered' && <button onClick={() => onReturn(o.id)}>반환</button>}
        </div>
      ))}
    </section>
  )
}
