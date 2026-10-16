import type { ReactNode } from 'react'
import type { VideoDetail } from '@shared/videoTypes'
import { VideoDetailPrimaryMeta } from './VideoDetailMeta'
import VideoDetailRatings from './VideoDetailRatings'
import styles from './VideoDetailOverview.module.css'

export default function VideoDetailOverview({ video, onRatingChange, children }: {
  video: VideoDetail
  onRatingChange: (rating: number) => void
  children: ReactNode
}): JSX.Element {
  return (
    <div className={styles.root}>
      <div className={styles.columns}>
        <div className={styles.metadata}><VideoDetailPrimaryMeta video={video} /></div>
        <VideoDetailRatings video={video} onRatingChange={onRatingChange} />
      </div>
      <div className={styles.actions}>{children}</div>
    </div>
  )
}
