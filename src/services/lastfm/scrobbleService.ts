import { scrobble, updateNowPlaying, LASTFM_API_KEY, LASTFM_API_SECRET } from './api'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'

const SCROBBLE_MIN_DURATION = 120
const SCROBBLE_PERCENTAGE = 0.5

// 取第一个歌手（多艺术家时只取第一个）
const getFirstArtist = (artist: string): string => {
  return artist.split(/[、,，]/)[0].trim()
}

let currentTrackStartTime: number | null = null
let scrobbledTrackId: string | null = null
let reportedNowPlayingTrackId: string | null = null

export const handlePlayStateChange = (isPlay: boolean) => {
  const enabled = settingState.setting['common.lastfm_enabled']
  const sessionKey = settingState.setting['common.lastfm_session_key']
  if (!enabled || !sessionKey) return

  if (isPlay) {
    const musicInfo = playerState.musicInfo
    if (musicInfo?.id) {
      currentTrackStartTime = Date.now()
      scrobbledTrackId = musicInfo.id
      // 上报 Now Playing（切歌时才上报）
      if (reportedNowPlayingTrackId !== musicInfo.id) {
        reportedNowPlayingTrackId = musicInfo.id
        reportNowPlaying()
      }
    }
  } else {
    tryScrobble()
  }
}

export const handleProgressChange = (progress: { nowPlayTime: number; maxPlayTime: number }) => {
  const { nowPlayTime, maxPlayTime } = progress
  const durationMet = nowPlayTime >= SCROBBLE_MIN_DURATION
  const percentageMet = maxPlayTime > 0 && nowPlayTime / maxPlayTime >= SCROBBLE_PERCENTAGE

  if ((durationMet || percentageMet) && scrobbledTrackId) {
    tryScrobble()
  }
}

const tryScrobble = async () => {
  const enabled = settingState.setting['common.lastfm_enabled']
  const sessionKey = settingState.setting['common.lastfm_session_key']
  if (!enabled || !sessionKey) return

  const musicInfo = playerState.musicInfo
  if (!musicInfo?.id || musicInfo.id !== scrobbledTrackId) return
  if (!currentTrackStartTime) return

  const timestamp = Math.floor(currentTrackStartTime / 1000)
  const duration = Math.floor(playerState.progress.nowPlayTime)

  const result = await scrobble(
    getFirstArtist(musicInfo.singer || ''),
    musicInfo.name || '',
    duration,
    timestamp,
    LASTFM_API_KEY,
    sessionKey,
    LASTFM_API_SECRET
  )

  if (!result.error) {
    currentTrackStartTime = null
    scrobbledTrackId = null
  }
}

export const reportNowPlaying = async () => {
  const enabled = settingState.setting['common.lastfm_enabled']
  const nowPlayingEnabled = settingState.setting['common.lastfm_now_playing_enabled']
  const sessionKey = settingState.setting['common.lastfm_session_key']
  if (!enabled || !nowPlayingEnabled || !sessionKey) return

  const musicInfo = playerState.musicInfo
  if (!musicInfo?.id) return

  await updateNowPlaying(
    getFirstArtist(musicInfo.singer || ''),
    musicInfo.name || '',
    Math.floor(playerState.progress.maxPlayTime),
    LASTFM_API_KEY,
    sessionKey,
    LASTFM_API_SECRET
  )
}

export const initScrobbleService = () => {
  global.state_event.on('playStateChanged', handlePlayStateChange)
  global.state_event.on('playProgressChanged', handleProgressChange)
}

export const destroyScrobbleService = () => {
  global.state_event.off('playStateChanged', handlePlayStateChange)
  global.state_event.off('playProgressChanged', handleProgressChange)
}
