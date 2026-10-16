import type { VideoDetail, VideoExternalStats } from '@shared/videoTypes'
import StarRating from './StarRating'
import { externalRatingLink } from './externalRatingLink'
import styles from './VideoDetailRatings.module.css'

function formatExternalScore(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatRatingCount(value: number): string {
  return value.toLocaleString('zh-CN')
}

function hasExternalRating(stat: VideoExternalStats): boolean {
  return stat.rating_average != null && Number.isFinite(stat.rating_average)
}

function buildExternalRatingMeta(stat: VideoExternalStats): string {
  const parts: string[] = [stat.source]
  if (stat.rating_count != null && stat.rating_count > 0) {
    parts.push(`${formatRatingCount(stat.rating_count)} 人`)
  }
  return parts.join(' · ')
}

interface Props {
  video: VideoDetail
  onRatingChange: (rating: number) => void
}

export default function VideoDetailRatings({ video, onRatingChange }: Props): JSX.Element {
  const externalRatings = video.external_stats.filter(hasExternalRating)

  return (
    <div className="detail-ratings" aria-label="评分">
      <div className="detail-rating-group">
        <span className="detail-rating-label">自定义评分</span>
        <StarRating value={video.rating} onChange={onRatingChange} size={22} />
      </div>
      {externalRatings.length > 0 && (
        <>
          <span className="detail-ratings-divider" aria-hidden />
          <div className="detail-rating-group">
            <span className="detail-rating-label">外部评分</span>
            <div className="detail-external-ratings">
              {externalRatings.map((stat) => {
                const url = externalRatingLink(stat.source, video.code, video.links, stat.source_url)
                return (
                  <div key={stat.id} className="detail-external-rating" title={buildExternalRatingMeta(stat)}>
                    <span className="detail-external-rating-score">
                      {formatExternalScore(stat.rating_average!)}
                    </span>
                    <span className="detail-external-rating-meta">
                      {url ? (
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
                      ) : stat.source}
                      {stat.rating_count != null && stat.rating_count > 0
                        ? ` · ${formatRatingCount(stat.rating_count)} 人` : null}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
