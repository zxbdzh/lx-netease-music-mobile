import { useEffect, useRef, forwardRef, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import Modal, { type ModalType } from '@/components/common/Modal'
import { useShareMusicCard } from '@/store/shareMusicCard/hook'
import shareMusicCardAction from '@/store/shareMusicCard/action'
import { styles } from './styles'
import Card from './Card'
import ViewShot from 'react-native-view-shot'
import Share from 'react-native-share'
import { toast } from '@/utils/tools'

const ShareMusicCardModal = forwardRef<ModalType>((_, ref) => {
  const { isShow, musicInfo } = useShareMusicCard()
  const modalRef = useRef<ModalType>(null)
  const cardRef = useRef<ViewShot>(null)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.setVisible(isShow)
    }
  }, [isShow])

  const handleClose = () => {
    shareMusicCardAction.close()
  }

  const handleShare = async () => {
    if (isSharing || !cardRef.current) return

    setIsSharing(true)
    try {
      const uri = await cardRef.current.capture()
      await Share.open({
        title: `分享歌曲: ${musicInfo?.name || ''}`,
        message: `我在听: ${musicInfo?.name || ''} - ${musicInfo?.singer || ''}`,
        url: `file://${uri}`,
        type: 'image/png',
      })
      shareMusicCardAction.close()
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        toast('分享失败: ' + error.message)
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Modal ref={modalRef} onHide={handleClose} bgHide={true}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>分享卡片</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>关闭</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }} style={styles.viewShot}>
              <Card musicInfo={musicInfo} />
            </ViewShot>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.shareButton]}
                onPress={handleShare}
                disabled={isSharing}
              >
                <Text style={[styles.buttonText, styles.shareButtonText]}>
                  {isSharing ? '生成中...' : '分享'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
})

export default ShareMusicCardModal
