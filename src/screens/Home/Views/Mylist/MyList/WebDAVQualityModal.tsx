import { View } from 'react-native'
import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import { createStyle, toast } from '@/utils/tools'
import { getLastSelectQuality, saveLastSelectQuality } from '@/utils/data'
import { getWebDAVBaseUrl, getWebDAVPlayConfig } from '@/core/webdavPlay/client'
import { handleDownloadToWebDAV } from './listAction'

// 整张歌单转存:无单曲 meta.qualitys 可依据,改用固定音质键集由用户统一选定,
// 解析直链时逐首交给 getMusicUrl 处理(不可用则计入失败数)。
const QUALITY_KEYS: LX.Quality[] = ['128k', '320k', 'flac', 'hires', 'atmos', 'atmos_plus', 'master']

export interface WebDAVQualityModalType {
  show: (listInfo: LX.List.MyListInfo) => void
}

export default forwardRef<WebDAVQualityModalType, {}>((props, ref) => {
  const alertRef = useRef<ConfirmAlertType>(null)
  const listInfoRef = useRef<LX.List.MyListInfo | null>(null)
  const [title, setTitle] = useState('')
  const [selectedQuality, setSelectedQuality] = useState<LX.Quality>('128k')
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    async show(listInfo) {
      // 配置门:未配置连接或未选目录则直接提示,不弹音质选择
      const config = await getWebDAVPlayConfig()
      if (!getWebDAVBaseUrl() || !config.selectedFolder) {
        toast(global.i18n.t('list_download_to_webdav_not_configured'), 'long')
        return
      }
      listInfoRef.current = listInfo
      setTitle(global.i18n.t('list_download_to_webdav_quality_title', { name: listInfo.name }))
      const last = await getLastSelectQuality()
      setSelectedQuality(QUALITY_KEYS.includes(last) ? last : '128k')
      if (visible) alertRef.current?.setVisible(true)
      else setVisible(true)
    },
  }))

  useEffect(() => {
    if (visible) alertRef.current?.setVisible(true)
  }, [visible])

  const handleConfirm = () => {
    const listInfo = listInfoRef.current
    if (!listInfo) return
    void saveLastSelectQuality(selectedQuality)
    alertRef.current?.setVisible(false)
    handleDownloadToWebDAV(listInfo, selectedQuality)
  }

  return visible ? (
    <ConfirmAlert
      ref={alertRef}
      onConfirm={handleConfirm}
      onHide={() => setVisible(false)}
      confirmText={global.i18n.t('list_download_to_webdav_confirm_button')}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.list}>
          {QUALITY_KEYS.map((id) => (
            <CheckBox
              key={id}
              marginRight={8}
              check={selectedQuality === id}
              label={global.i18n.t(id)}
              onChange={() => setSelectedQuality(id)}
              need
            />
          ))}
        </View>
      </View>
    </ConfirmAlert>
  ) : null
})

const styles = createStyle({
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  title: {
    marginBottom: 10,
  },
  list: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
})
