import { VIDEO_CONTENT_MARKS, type VideoContentMark } from '@shared/videoContentMarks'
import styles from './VideoContentBadges.module.css'

export default function VideoContentBadges({ marks }: { marks?: VideoContentMark[] }): JSX.Element | null {
  const selected = VIDEO_CONTENT_MARKS.filter((mark) => marks?.includes(mark.id))
  if (!selected.length) return null
  return (
    <span className={styles.root} role="group" aria-label={`影片标记：${selected.map((mark) => mark.label).join('、')}`}>
      {selected.map((mark) => (
        <span key={mark.id} className={styles.badge} data-kind={mark.id} title={mark.label}>
          {mark.shortLabel}
        </span>
      ))}
    </span>
  )
}
