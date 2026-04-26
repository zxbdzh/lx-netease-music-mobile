import { memo, useCallback } from 'react'
import { View } from 'react-native'
import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'

export default memo(() => {
  const theme = useTheme()
  const enabled = useSettingValue('common.lastfm_enabled')
  const sessionKey = useSettingValue('common.lastfm_session_key')
  const username = useSettingValue('common.lastfm_username')
  const scrobbleEnabled = useSettingValue('common.lastfm_scrobble_enabled')
  const nowPlayingEnabled = useSettingValue('common.lastfm_now_playing_enabled')

  const handleEnableChange = (value: boolean) => {
    updateSetting({ 'common.lastfm_enabled': value })
  }

  const handleScrobbleChange = (value: boolean) => {
    updateSetting({ 'common.lastfm_scrobble_enabled': value })
  }

  const handleNowPlayingChange = (value: boolean) => {
    updateSetting({ 'common.lastfm_now_playing_enabled': value })
  }

  const handleAuthorize = useCallback(() => {
    global.app_event.emit('showLastfmLogin')
  }, [])

  const handleUnbind = useCallback(() => {
    updateSetting({ 'common.lastfm_session_key': '', 'common.lastfm_username': '' })
    toast('已解除绑定')
  }, [])

  return (
    <Section title="Last.fm">
      <SubTitle title="基础设置">
        <CheckBoxItem
          check={enabled}
          label="启用 Last.fm"
          onChange={handleEnableChange}
        />

        <View style={{ opacity: enabled ? 1 : 0.5 }}>
          <CheckBoxItem
            check={scrobbleEnabled}
            label="启用 Scrobble（播放记录上报）"
            onChange={handleScrobbleChange}
            disabled={!enabled}
          />
          <CheckBoxItem
            check={nowPlayingEnabled}
            label="启用 Now Playing（正在播放）"
            onChange={handleNowPlayingChange}
            disabled={!enabled}
          />
        </View>
      </SubTitle>

      <SubTitle title="账号绑定">
        <View style={{ opacity: enabled ? 1 : 0.5 }}>
          {sessionKey ? (
            <View style={styles.sessionContainer}>
              <Text size={12} color={theme['c-font-label']}>
                已绑定: {username || '未知用户'}
              </Text>
              <Button onPress={handleUnbind} disabled={!enabled}>
                解除绑定
              </Button>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Button onPress={handleAuthorize} disabled={!enabled}>
                登录 Last.fm
              </Button>
            </View>
          )}
        </View>
      </SubTitle>
    </Section>
  )
})

const styles = createStyle({
  btnRow: {
    flexDirection: 'row',
    paddingLeft: 25,
    marginTop: 10,
    marginBottom: 10,
  },
  sessionContainer: {
    paddingLeft: 25,
    marginTop: 10,
    marginBottom: 10,
  },
})
