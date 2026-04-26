import state, { type CardStyle } from './state'

export default {
  open(musicInfo: LX.Music.MusicInfo) {
    state.isShow = true
    state.musicInfo = musicInfo
    global.state_event.shareMusicCardStateChanged({ ...state })
  },
  close() {
    state.isShow = false
    state.musicInfo = null
    global.state_event.shareMusicCardStateChanged({ ...state })
  },
  setStyle(style: CardStyle) {
    state.selectedStyle = style
    global.state_event.shareMusicCardStateChanged({ ...state })
  },
}
