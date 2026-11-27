import s from '@/components/portal/home/home.module.css'

/*
  Shown the moment you click Home, while the homes and map load. Without it the
  previous page stayed on screen until the server had everything, so the click
  looked as if it had done nothing.
*/
export default function HomeLoading() {
  return (
    <div className={s.app} aria-busy="true" aria-label="Loading your homes">
      <div className={s.head}>
        <h1>Home</h1>
      </div>
      <div className={s.filters}>
        <div className={`${s.fbar} ${s.skelBar}`} />
      </div>
      <section className={s.list}>
        <div className={s.listTools}><span className={s.skel} style={{ width: 120 }} /></div>
        <ul className={s.rows}>
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <div className={s.row} style={{ cursor: 'default' }}>
                <span className={s.skel} style={{ width: 22, height: 22 }} />
                <span className={s.addr}>
                  <span className={s.skel} style={{ width: `${60 - (i % 3) * 8}%` }} />
                  <span className={s.skel} style={{ width: '38%', height: 10, marginTop: 8 }} />
                </span>
                <span className={s.skel} style={{ width: 70 }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className={s.map}>
        <div className={s.mapWait}>Loading map…</div>
      </section>
      <div className={s.dock}>
        <aside className={s.aside}>
          <div className={s.card}>
            <div className={s.face} />
          </div>
        </aside>
      </div>
    </div>
  )
}
