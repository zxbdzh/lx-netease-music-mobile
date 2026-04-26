import state from './state'

export default {
  open(musicInfo: LX.Music.MusicInfo) {
    state.isShow = true
    state.musicInfo = musicInfo
    state.data = null
    state.loading = true
    global.state_event.songMemoryStateChanged({ ...state })
  },
  close() {
    state.isShow = false
    state.musicInfo = null
    state.data = null
    state.loading = false
    global.state_event.songMemoryStateChanged({ ...state })
  },
  setData(data: typeof state.data) {
    state.data = data
    state.loading = false
    global.state_event.songMemoryStateChanged({ ...state })
  },
  setLoading(loading: boolean) {
    state.loading = loading
    global.state_event.songMemoryStateChanged({ ...state })
  },
}
