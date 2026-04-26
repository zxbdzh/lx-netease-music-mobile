export type CardStyle = 'nebula' | 'amber' | 'mono' | 'cover'

interface InitState {
  isShow: boolean
  musicInfo: LX.Music.MusicInfo | null
  selectedStyle: CardStyle
}

const state: InitState = {
  isShow: false,
  musicInfo: null,
  selectedStyle: 'nebula',
}

export default state
