import type { SongMemoryData } from '@/utils/musicSdk/wy/utils/songMemory'

interface InitState {
  isShow: boolean
  musicInfo: LX.Music.MusicInfo | null
  data: SongMemoryData | null
  loading: boolean
}

const state: InitState = {
  isShow: false,
  musicInfo: null,
  data: null,
  loading: false,
}

export default state
export type { InitState }
