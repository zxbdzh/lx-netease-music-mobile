interface InitState {
  enabled: boolean
  sessionKey: string
  username: string
  scrobbleEnabled: boolean
  nowPlayingEnabled: boolean
}

const state: InitState = {
  enabled: false,
  sessionKey: '',
  username: '',
  scrobbleEnabled: true,
  nowPlayingEnabled: false,
}

export default state
