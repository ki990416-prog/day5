import { useState } from 'react'

function Comments({ post, comments, user, onAdd, onDelete }) {
  const [text, setText] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    await onAdd(post.id, text.trim())
    setText('')
  }

  return (
    <div className="comments">
      {comments.map((c) => (
        <p key={c.id}>
          <b>{c.author}</b> {c.content}
          {user?.id === c.user_id && (
            <button className="x" onClick={() => onDelete(c.id)} aria-label="삭제">✕</button>
          )}
        </p>
      ))}
      {user && (
        <form className="row" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="댓글 쓰기" />
          <button>등록</button>
        </form>
      )}
    </div>
  )
}

export default function Guestbook({ user, posts, comments, likes, onPost, onDeletePost, onLike, onAddComment, onDeleteComment }) {
  const [text, setText] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    await onPost(text.trim())
    setText('')
  }

  return (
    <>
      {user ? (
        <form className="card row" onSubmit={submit}>
          <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="제주 여행·특산물 후기를 남겨보세요" />
          <button className="primary">글쓰기</button>
        </form>
      ) : (
        <p className="card muted">로그인하면 방명록에 글을 쓰고 댓글·좋아요를 남길 수 있어요.</p>
      )}

      {posts.map((p) => {
        const postLikes = likes.filter((l) => l.post_id === p.id)
        const liked = postLikes.some((l) => l.user_id === user?.id)
        return (
          <section className="card" key={p.id}>
            <p>
              <b>{p.author}</b> <small className="muted">{new Date(p.created_at).toLocaleString('ko-KR')}</small>
              {user?.id === p.user_id && (
                <button className="x" onClick={() => onDeletePost(p.id)} aria-label="삭제">✕</button>
              )}
            </p>
            <p>{p.content}</p>
            <button className={liked ? 'liked' : ''} onClick={() => onLike(p.id, liked)}>
              {liked ? '❤️' : '🤍'} {postLikes.length}
            </button>
            <Comments
              post={p}
              comments={comments.filter((c) => c.post_id === p.id)}
              user={user}
              onAdd={onAddComment}
              onDelete={onDeleteComment}
            />
          </section>
        )
      })}
      {!posts.length && <p className="card muted">아직 글이 없어요. 첫 글을 남겨보세요!</p>}
    </>
  )
}
