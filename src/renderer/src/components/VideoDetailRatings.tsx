import type { VideoDetail, VideoExternalStats } from '@shared/videoTypes'
import { LOCAL_NFO_SOURCE_ID, LOCAL_NFO_SOURCE_NAME } from '@shared/videoMetadataSourceConstants'
import StarRating from './StarRating'
import { externalRatingLink } from './externalRatingLink'
import styles from './VideoDetailRatings.module.css'

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function ratingCount(value: number | null): number | null {
  return value != null && Number.isSafeInteger(value) && value > 0 ? value : null
}

function compactCount(value: number): string {
  return value >= 10_000
    ? `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}万人`
    : `${value.toLocaleString('zh-CN')}人`
}

function isLocalNfo(stat: VideoExternalStats): boolean {
  return stat.source === LOCAL_NFO_SOURCE_ID || stat.source === LOCAL_NFO_SOURCE_NAME
}

function RatingValue({ stat, video }: { stat: VideoExternalStats; video: VideoDetail }): JSX.Element {
  const local = isLocalNfo(stat)
  const url = local ? null : externalRatingLink(stat.source, video.code, video.links, stat.source_url)
  const count = ratingCount(stat.rating_count)
  const exactCount = count == null ? undefined : `${count.toLocaleString('zh-CN')} 人评分`
  return (
    <div className={styles.value}>
      <span className={styles.score}>{formatScore(stat.rating_average!)}</span>
      {!local && (url ? (
        <a
          className={styles.platformLink}
          href={url}
          title={`在默认浏览器中打开 ${stat.source}`}
          onClick={(event) => {
            event.preventDefault()
            void window.api.externalLinks.open(url)
          }}
        >
          {stat.source}
        </a>
      ) : <span className={styles.source}>{stat.source}</span>)}
      {count != null && (
        <span className={styles.count} title={exactCount} aria-label={exactCount}>
          · {compactCount(count)}
        </span>
      )}
    </div>
  )
}

interface Props {
  video: VideoDetail
  onRatingChange: (rating: number) => void
}

export default function VideoDetailRatings({ video, onRatingChange }: Props): JSX.Element {
  const ratings = video.external_stats.filter(stat => stat.rating_average != null && Number.isFinite(stat.rating_average))
  const external = ratings.filter(stat => !isLocalNfo(stat))
  const local = ratings.filter(isLocalNfo)
  return (
    <dl className={styles.root} aria-label="评分">
      <div className={styles.row}>
        <dt className={styles.label}>自定义评分</dt>
        <dd className={styles.values}>
          <StarRating value={video.rating} onChange={onRatingChange} size={20} />
        </dd>
      </div>
      {external.length > 0 && (
        <div className={styles.row}>
          <dt className={styles.label}>外部评分</dt>
          <dd className={styles.values}>
            {external.map(stat => <RatingValue key={stat.id} stat={stat} video={video} />)}
          </dd>
        </div>
      )}
      {local.length > 0 && (
        <div className={styles.row}>
          <dt className={styles.label}>{LOCAL_NFO_SOURCE_NAME}</dt>
          <dd className={styles.values}>
            {local.map(stat => <RatingValue key={stat.id} stat={stat} video={video} />)}
          </dd>
        </div>
      )}
    </dl>
  )
}
