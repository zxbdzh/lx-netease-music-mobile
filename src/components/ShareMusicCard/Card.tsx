import React from 'react'
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { resolveMusicDetailWebUrl } from '@/utils/shareMusicCard'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_SIZE = Math.min(SCREEN_WIDTH - 64, 400)

interface CardProps {
  musicInfo: LX.Music.MusicInfo | null
}

const Card: React.FC<CardProps> = ({ musicInfo }) => {
  const musicUrl = musicInfo ? resolveMusicDetailWebUrl(musicInfo) : ''
  const picUrl = musicInfo?.meta?.picUrl ?? null

  return (
    <View style={[styles.card, { width: CARD_SIZE, height: CARD_SIZE }]}>
      {picUrl ? (
        <Image source={{ uri: picUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}

      <View style={styles.overlay}>
        <View style={styles.info}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {musicInfo?.name || '未知歌曲'}
          </Text>
          <Text style={styles.singerName} numberOfLines={1}>
            {musicInfo?.singer || '未知歌手'}
          </Text>
        </View>

        {musicUrl ? (
          <View style={styles.qrContainer}>
            <QRCode value={musicUrl} size={72} backgroundColor="#fff" color="#000" />
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#1a1a1a',
  },
  cover: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  songTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  singerName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  qrContainer: {
    padding: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
})

export default Card
