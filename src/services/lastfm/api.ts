/**
 * Last.fm API 服务
 */

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/'
export const LASTFM_API_KEY = '08625d47af4b9b8f08a69d15c7aaf19a'
export const LASTFM_API_SECRET = '0dac6ec147d68263691661c34a7424a7'

interface ApiParams {
  method: string
  api_key: string
  sk?: string
  [key: string]: string | undefined
}

interface ApiResponse {
  error?: number
  message?: string
  data?: any
}

/**
 * 发起 Last.fm API 请求
 */
const apiRequest = async (
  method: string,
  params: Record<string, string>,
  apiKey: string,
  sessionKey: string,
  requestSecret?: string
): Promise<ApiResponse> => {
  try {
    const allParams: ApiParams = {
      method,
      api_key: apiKey,
      sk: sessionKey,
      ...params,
    }

    // 如果有 secret，进行签名
    if (requestSecret) {
      const signature = generateSignature(
        Object.fromEntries(
          Object.entries(allParams).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string>,
        requestSecret
      )
      allParams.api_sig = signature
    }

    allParams.format = 'json'

    const formBody = Object.entries(allParams)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
      .join('&')

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    })

    const data = await response.json()

    if (data.error) {
      return { error: data.error, message: data.message }
    }

    return { data }
  } catch (error: any) {
    return { error: -1, message: error.message || 'Unknown error' }
  }
}

/**
 * 获取 Auth Token（桌面应用授权流程第一步）
 */
export const getToken = async (apiKey: string, apiSecret: string): Promise<ApiResponse> => {
  return apiRequest('auth.getToken', {}, apiKey, '', apiSecret)
}

/**
 * 获取 Auth URL（使用 token，无需回调 URL）
 */
export const getAuthUrl = (apiKey: string, token: string): string => {
  return `https://www.last.fm/api/auth/?api_key=${apiKey}&token=${token}`
}

/**
 * 获取 Session Key
 */
export const getSession = async (
  token: string,
  apiKey: string,
  apiSecret: string
): Promise<ApiResponse> => {
  return apiRequest(
    'auth.getSession',
    { token },
    apiKey,
    '', // 无 session key
    apiSecret
  )
}

/**
 * Scrobble 歌曲
 */
export const scrobble = async (
  artist: string,
  track: string,
  duration: number,
  timestamp: number,
  apiKey: string,
  sessionKey: string,
  apiSecret: string
): Promise<ApiResponse> => {
  return apiRequest(
    'track.scrobble',
    {
      artist,
      track,
      duration: String(Math.floor(duration)),
      timestamp: String(timestamp),
    },
    apiKey,
    sessionKey,
    apiSecret
  )
}

/**
 * 更新正在播放
 */
export const updateNowPlaying = async (
  artist: string,
  track: string,
  duration: number,
  apiKey: string,
  sessionKey: string,
  apiSecret: string
): Promise<ApiResponse> => {
  return apiRequest(
    'track.updateNowPlaying',
    {
      artist,
      track,
      duration: String(Math.floor(duration)),
    },
    apiKey,
    sessionKey,
    apiSecret
  )
}

import { generateSignature } from './crypto'
