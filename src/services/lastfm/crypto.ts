/**
 * Last.fm API 签名工具
 * 使用 MD5 签名算法
 */

import CryptoJS from 'crypto-js'

/**
 * 生成 Last.fm API 签名
 * @param params 所有请求参数（不含 sign 和 api_key）
 * @param secret API Secret
 */
export const generateSignature = (params: Record<string, string>, secret: string): string => {
  // 按参数名排序
  const sortedKeys = Object.keys(params).sort()
  const stringToSign = sortedKeys.map((key) => `${key}${params[key]}`).join('') + secret

  // 使用 MD5
  return CryptoJS.MD5(stringToSign).toString()
}

/**
 * 构建 Last.fm API 请求参数
 * @param method API 方法
 * @param params 其他参数
 * @param apiKey API Key
 * @param sessionKey Session Key
 */
export const buildApiParams = (
  method: string,
  params: Record<string, string>,
  apiKey: string,
  sessionKey?: string
) => {
  const allParams: Record<string, string> = {
    method,
    api_key: apiKey,
    sk: sessionKey || '',
    ...params,
  }

  return allParams
}
