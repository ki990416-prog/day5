import { won } from '../supabaseClient'

export default function Orders({ orders, onEditQty, onEditAddress, onReturn }) {
  if (!orders.length) return <p className="card muted">주문 내역이 없어요.</p>

  return (
    <>
      {orders.map((o) => (
        <section className="card" key={o.id}>
          <h2>
            주문 #{o.id} <span className={`badge ${o.status}`}>{o.status === 'ordered' ? '주문완료' : '반환됨'}</span>
          </h2>
          <p className="muted">{new Date(o.created_at).toLocaleString('ko-KR')} · 배송지: {o.address}</p>
          {o.order_items.map((it) => (
            <div className="line" key={it.id}>
              <span>{it.products.emoji} {it.products.name}</span>
              <span>{won(it.unit_price)} ×</span>
              {o.status === 'ordered' ? (
                <input type="number" min="1" defaultValue={it.quantity}
                  onBlur={(e) => Number(e.target.value) !== it.quantity && onEditQty(it.id, Math.max(1, Number(e.target.value) || 1))} />
              ) : (
                <span>{it.quantity}</span>
              )}
              <b>{won(it.total_price)}</b>
            </div>
          ))}
          <p className="total">합계 {won(o.total_price)}</p>
          {o.status === 'ordered' && (
            <div className="row">
              <button onClick={() => onEditAddress(o)}>배송지 수정</button>
              <button onClick={() => onReturn(o.id)}>반환 요청</button>
            </div>
          )}
        </section>
      ))}
    </>
  )
}
