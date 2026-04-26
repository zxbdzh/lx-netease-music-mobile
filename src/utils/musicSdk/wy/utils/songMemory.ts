/**
 * 坐标回忆 API
 * 获取歌曲的初次聆听、累计播放等信息
 */

import { httpFetch } from '@/utils/request'

const API_BASE_URL = 'https://music.zxbdwy.online'

export interface SongMemoryData {
  songInfoDto: {
    songId: number
    songName: string
    singer: string
    coverUrl: string
  } | null
  musicFirstListenDto: {
    date: string
    period: string
    time: string
  } | null
  musicTotalPlayDto: {
    playCount: number
    text: string
  } | null
  musicPlayMostDto: {
    date: string
    mostPlayedCount: number
  } | null
  musicFrequentListenDto: {
    timeDesc: string
    describe: string
  } | null
  musicLikeSongDto: {
    like: boolean
    redTime: string
    redDesc: string
  } | null
}

interface ApiResponse {
  code: number
  message?: string
  data: SongMemoryData | null
}

/**
 * 获取歌曲的记忆信息
 */
export const getSongFirstListenInfo = async (
  songId: string | number,
  cookie: string
): Promise<SongMemoryData | null> => {
  try {
    if (!cookie) {
      console.log('getSongFirstListenInfo: no cookie')
      return null
    }

    const url = `${API_BASE_URL}/music/first/listen/info?id=${songId}&cookie=${encodeURIComponent(cookie)}`

    const { promise } = httpFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    const response = await promise
    if (response.statusCode !== 200) {
      console.log('getSongFirstListenInfo: HTTP error', response.statusCode)
      return null
    }

    const body = response.body as ApiResponse
    if (body.code !== 200) {
      console.log('getSongFirstListenInfo: API error', body.code, body.message)
      return null
    }

    return body.data
  } catch (error) {
    console.log('getSongFirstListenInfo error:', error)
    return null
  }
}
