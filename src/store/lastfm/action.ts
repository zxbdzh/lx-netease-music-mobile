import state from './state'
import settingState from '@/store/setting/state'

const updateLastfmSetting = (key: string, value: any) => {
  settingState.setting[key] = value
}

export default {
  syncFromSetting() {
    state.enabled = settingState.setting['common.lastfm_enabled']
    state.sessionKey = settingState.setting['common.lastfm_session_key']
    state.username = settingState.setting['common.lastfm_username']
    state.scrobbleEnabled = settingState.setting['common.lastfm_scrobble_enabled']
    state.nowPlayingEnabled = settingState.setting['common.lastfm_now_playing_enabled']
    global.state_event.lastfmConfigChanged({ ...state })
  },
  setEnabled(enabled: boolean) {
    state.enabled = enabled
    updateLastfmSetting('common.lastfm_enabled', enabled)
    global.state_event.lastfmConfigChanged({ ...state })
  },
  setSessionKey(sessionKey: string) {
    state.sessionKey = sessionKey
    updateLastfmSetting('common.lastfm_session_key', sessionKey)
    global.state_event.lastfmConfigChanged({ ...state })
  },
  setScrobbleEnabled(enabled: boolean) {
    state.scrobbleEnabled = enabled
    updateLastfmSetting('common.lastfm_scrobble_enabled', enabled)
    global.state_event.lastfmConfigChanged({ ...state })
  },
  setNowPlayingEnabled(enabled: boolean) {
    state.nowPlayingEnabled = enabled
    updateLastfmSetting('common.lastfm_now_playing_enabled', enabled)
    global.state_event.lastfmConfigChanged({ ...state })
  },
}
