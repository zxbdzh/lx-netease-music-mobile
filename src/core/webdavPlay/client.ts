import { createClient, type WebDAVClient } from 'webdav'
import { Buffer } from '@craftzdog/react-native-buffer'
import RNFetchBlob from 'rn-fetch-blob'
import { getData, saveData } from '@/plugins/storage'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'

const CONFIG_KEY = '@webdav_play_config'

// 独立单例,不复用 utils/webdav.ts(那里是同步功能用的客户端)
let client: WebDAVClient | null = null

export const getWebDAVBaseUrl = (): string => {
  const url = settingState.setting['webdavPlay.url'] || ''
  return url.trim().replace(/\/+$/, '')
}

export const getWebDAVPlayCredentials = (): { username: string; password: string } => {
  const settings = settingState.setting
  return {
    username: settings['webdavPlay.username'] || '',
    password: settings['webdavPlay.password'] || '',
  }
}

export const getClient = (): WebDAVClient | null => {
  if (client) return client

  const url = getWebDAVBaseUrl()
  const { username, password } = getWebDAVPlayCredentials()
  if (!url || !username) {
    log.warn('WebDAV 播放未配置: URL 或用户名为空')
    return null
  }

  client = createClient(url, { username, password })
  return client
}

/**
 * 配置变更(url/username/password)时调用,清空单例以便下次用新凭证重建。
 */
export const resetWebDAVPlayClient = (): void => {
  client = null
}

export const testWebDAVPlayConnection = async (): Promise<boolean> => {
  const cli = getClient()
  if (!cli) throw new Error('WebDAV 播放未配置')
  await cli.getDirectoryContents('/')
  return true
}

/**
 * 拼接可直连播放的文件 URL。
 * 编码约定(契约 2.4):按 `/` 分段后每段 encodeURIComponent,再 join('/');
 * 禁止整体 encodeURI(会漏编码 `#` `?` 等)。
 */
export const buildWebDAVFileUrl = (filePath: string): string => {
  const base = getWebDAVBaseUrl()
  const encoded = filePath
    .split('/')
    .map(segment => (segment ? encodeURIComponent(segment) : ''))
    .join('/')
  const path = encoded.startsWith('/') ? encoded : `/${encoded}`
  return `${base}${path}`
}

export const getWebDAVPlayConfig = async (): Promise<LX.WebDAVPlay.Config> => {
  const config = (await getData<LX.WebDAVPlay.Config>(CONFIG_KEY)) ?? {
    selectedFolder: null,
    songs: [],
  }
  config.songs = config.songs ?? []
  return config
}

export const saveWebDAVPlayConfig = async (config: LX.WebDAVPlay.Config): Promise<void> => {
  await saveData(CONFIG_KEY, config)
}

/**
 * 上传二进制/文本文件到 WebDAV(覆盖已存在文件)。
 * remotePath 为服务器绝对路径(原始未编码),交由库自行编码,与读路径一致。
 */
export const uploadWebDAVFile = async (
  remotePath: string,
  data: Buffer | string
): Promise<void> => {
  const cli = getClient()
  if (!cli) throw new Error('WebDAV 未配置')
  const ok = await cli.putFileContents(remotePath, data as any, { overwrite: true })
  if (!ok) throw new Error(`上传失败: ${remotePath}`)
}

/**
 * 从本地文件路径流式上传到 WebDAV(避免整文件读入内存导致 OOM)。
 * 直接以 RNFetchBlob.wrap(localPath) 作为 PUT body,由原生分块读取;
 * URL 复用 buildWebDAVFileUrl,与播放读路径保持一致;凭证仅运行时现取。
 */
export const uploadWebDAVFileFromPath = async (
  remotePath: string,
  localPath: string
): Promise<void> => {
  const { username, password } = getWebDAVPlayCredentials()
  const token = Buffer.from(`${username}:${password}`).toString('base64')
  const url = buildWebDAVFileUrl(remotePath)
  const res = await RNFetchBlob.fetch(
    'PUT',
    url,
    {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    RNFetchBlob.wrap(localPath)
  )
  const status = res.info().status
  if (status < 200 || status >= 300) {
    throw new Error(`上传失败(${status}): ${remotePath}`)
  }
}

/**
 * 确保目录存在(递归创建)。已存在则跳过。
 */
export const ensureWebDAVDirectory = async (dirPath: string): Promise<void> => {
  const cli = getClient()
  if (!cli) throw new Error('WebDAV 未配置')
  if (await cli.exists(dirPath)) return
  await cli.createDirectory(dirPath, { recursive: true })
}

export const webdavExists = async (remotePath: string): Promise<boolean> => {
  const cli = getClient()
  if (!cli) throw new Error('WebDAV 未配置')
  return cli.exists(remotePath)
}

/**
 * 读取并解析 JSON 文件;不存在/解析失败均返回 null。
 */
export const getWebDAVJsonFile = async <T>(remotePath: string): Promise<T | null> => {
  const cli = getClient()
  if (!cli) return null
  try {
    if (!(await cli.exists(remotePath))) return null
    const text = (await cli.getFileContents(remotePath, { format: 'text' })) as string
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
