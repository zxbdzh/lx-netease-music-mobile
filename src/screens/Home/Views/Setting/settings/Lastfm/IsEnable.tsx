import { memo } from 'react'
import { View, Switch, Text } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import settingState from '@/store/setting/state'

export default memo(() => {
  const theme = useTheme()
  const enabled = useSettingValue('common.lastfm_enabled')

  const handleChange = (value: boolean) => {
    settingState.setting['common.lastfm_enabled'] = value
    global.state_event.configUpdated(['common.lastfm_enabled'], { 'common.lastfm_enabled': value })
  }

  return (
    <View style={styles.container}>
      <Text style={{ color: theme['c-button-font'] }}>Last.fm</Text>
      <Switch
        value={enabled}
        onValueChange={handleChange}
        trackColor={{ false: theme['c-border'], true: theme['c-button-background'] }}
        thumbColor={enabled ? theme['c-primary-font'] : theme['c-font']}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
})
