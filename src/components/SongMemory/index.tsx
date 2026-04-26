import { useEffect, useRef, forwardRef } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity, Image } from 'react-native'
import Modal, { type ModalType } from '@/components/common/Modal'
import { useSongMemory } from '@/store/songMemory/hook'
import songMemoryAction from '@/store/songMemory/action'
import { getSongFirstListenInfo } from '@/utils/musicSdk/wy/utils/songMemory'
import settingState from '@/store/setting/state'
import { styles } from './styles'

const SongMemoryModal = forwardRef<ModalType>((_, ref) => {
  const { isShow, musicInfo, data, loading } = useSongMemory()
  const modalRef = useRef<ModalType>(null)

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.setVisible(isShow)
    }
  }, [isShow])

  useEffect(() => {
    if (isShow && musicInfo?.id && musicInfo.source === 'wy') {
      songMemoryAction.setLoading(true)
      const songId = musicInfo.meta?.songId || musicInfo.id
      const cookie = settingState.setting['common.wy_cookie'] || ''
      getSongFirstListenInfo(songId, cookie)
        .then(result => {
          if (result) {
            songMemoryAction.setData(result)
          } else {
            songMemoryAction.setLoading(false)
          }
        })
        .catch(() => {
          songMemoryAction.setLoading(false)
        })
    } else if (isShow) {
      songMemoryAction.setLoading(false)
    }
  }, [isShow, musicInfo])

  const handleClose = () => {
    songMemoryAction.close()
  }

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return ''
    const currentYear = new Date().getFullYear()
    // 匹配完整日期时间格式: 2026-02-03 21:06:06
    const fullMatch = dateStr.match(/(\d{4})-(\d+)-(\d+)\s+(\d+):(\d+):(\d+)/)
    if (fullMatch) {
      const year = parseInt(fullMatch[1])
      const month = parseInt(fullMatch[2])
      const day = parseInt(fullMatch[3])
      const time = `${fullMatch[4]}:${fullMatch[5]}`
      let result = ''
      if (year !== currentYear) {
        result = `${year}年${month}月${day}日`
      } else {
        result = `${month}月${day}日`
      }
      if (fullMatch[4] !== '00' || fullMatch[5] !== '00' || fullMatch[6] !== '00') {
        result += ` ${time}`
      }
      return result
    }
    // 匹配纯日期格式: 2026-02-06
    const dateMatch = dateStr.match(/(\d{4})-(\d+)-(\d+)/)
    if (dateMatch) {
      const year = parseInt(dateMatch[1])
      const month = parseInt(dateMatch[2])
      const day = parseInt(dateMatch[3])
      if (year !== currentYear) {
        return `${year}年${month}月${day}日`
      }
      return `${month}月${day}日`
    }
    return dateStr
  }

  const formatTimeDesc = (timeDesc: string | undefined | null) => {
    if (!timeDesc) return ''
    const map: Record<string, string> = {
      morning: '早上',
      noon: '中午',
      afternoon: '下午',
      evening: '傍晚',
      night: '夜晚',
      deep_night: '深夜',
    }
    return map[timeDesc] || timeDesc
  }

  const renderCard = (icon: string, label: string, value: string | number | null, sub?: string | null) => {
    if (value === null || value === undefined) return null
    return (
      <View style={styles.card}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        {sub && <Text style={styles.cardSub}>{sub}</Text>}
      </View>
    )
  }

  const coverUrl = data?.songInfoDto?.coverUrl || musicInfo?.meta?.picUrl
  const songName = data?.songInfoDto?.songName || musicInfo?.name || '未知歌曲'
  const singer = data?.songInfoDto?.singer || musicInfo?.singer || '未知歌手'

  return (
    <Modal ref={modalRef} onHide={handleClose} bgHide={true}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>坐标回忆</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>关闭</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#07c560" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : data ? (
              <>
                <View style={styles.songInfo}>
                  {coverUrl && <Image source={{ uri: coverUrl }} style={styles.songCover} />}
                  <View style={styles.songDetail}>
                    <Text style={styles.songName} numberOfLines={1}>{songName}</Text>
                    <Text style={styles.singer} numberOfLines={1}>{singer}</Text>
                  </View>
                </View>

                <View style={styles.cards}>
                  {renderCard('🌟', '首次试听', formatDate(data.musicFirstListenDto?.date), 
                    data.musicFirstListenDto ? `${data.musicFirstListenDto.period} · ${data.musicFirstListenDto.time}` : null)}
                  {renderCard('🎧', '累计播放', data.musicTotalPlayDto?.playCount ? `${data.musicTotalPlayDto.playCount}次` : null, data.musicTotalPlayDto?.text)}
                  {renderCard('✨', '最特别的一天', formatDate(data.musicPlayMostDto?.date), 
                    data.musicPlayMostDto ? `播放 ${data.musicPlayMostDto.mostPlayedCount} 次` : null)}
                  {renderCard('⏰', '常听时段', formatTimeDesc(data.musicFrequentListenDto?.timeDesc), data.musicFrequentListenDto?.describe)}
                </View>

                {data.musicLikeSongDto?.like && (
                  <View style={styles.likeCard}>
                    <Text style={styles.likeIcon}>❤️</Text>
                    <View style={styles.likeContent}>
                      <Text style={styles.likeDate}>红心于 {formatDate(data.musicLikeSongDto.redTime)}</Text>
                      <Text style={styles.likeDesc}>{data.musicLikeSongDto.redDesc}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>暂无数据</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
})

export default SongMemoryModal
