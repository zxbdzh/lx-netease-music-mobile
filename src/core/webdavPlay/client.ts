import { createClient, type WebDAVClient } from 'webdav'
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
