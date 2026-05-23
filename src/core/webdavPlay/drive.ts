import type { FileStat } from 'webdav'
import { getClient, getWebDAVPlayConfig, saveWebDAVPlayConfig } from './client'

const audioExts = new Set([
  'mp3',
  'flac',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wma',
  'ape',
])

const getExt = (name: string) => {
  const ext = name.split('.').pop()
  return ext && ext != name ? ext.toLowerCase() : ''
}

const parseFileName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.')
  const rawName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  if (!rawName.includes('-')) return { name: rawName.trim(), singer: '' }
  const [left, ...rest] = rawName.split('-')
  return {
    name: left.trim(),
    singer: rest.join('-').trim(),
  }
}

const getDirectoryItems = async (path?: string | null): Promise<FileStat[]> => {
  const cli = getClient()
  if (!cli) throw new Error('WebDAV 未配置')
  const contents = await cli.getDirectoryContents(path || '/')
  return Array.isArray(contents) ? contents : contents.data
}

const toMusicInfo = (item: FileStat): LX.WebDAVPlay.MusicInfo => {
  const path = item.filename
  const ext = getExt(item.basename)
  const title = parseFileName(item.basename)
  const modifiedTime = item.lastmod ? new Date(item.lastmod).getTime() : 0
  return {
    id: `webdav_${path}`,
    name: title.name,
    singer: title.singer,
    source: 'local',
    interval: null,
    meta: {
      songId: path,
      albumName: '',
      webdav: true,
      filePath: path,
      fileName: item.basename,
      ext,
      size: item.size,
      picUrl: '',
      lastModifiedTime: modifiedTime,
    },
  }
}

export const listWebDAVFolders = async (
  folder?: LX.WebDAVPlay.DriveFolder | null
): Promise<LX.WebDAVPlay.DriveFolder[]> => {
  const items = await getDirectoryItems(folder?.path)
  return items
    .filter(item => item.type === 'directory')
    .sort((a, b) => a.basename.localeCompare(b.basename))
    .map<LX.WebDAVPlay.DriveFolder>(item => ({
      path: item.filename,
      name: item.basename,
    }))
}

export const saveWebDAVSelectedFolder = async (
  folder: LX.WebDAVPlay.DriveFolder | null
): Promise<LX.WebDAVPlay.Config> => {
  const config = await getWebDAVPlayConfig()
  config.selectedFolder = folder
  await saveWebDAVPlayConfig(config)
  return config
}

const scanFolder = async (
  folder: LX.WebDAVPlay.DriveFolder | null,
  onProgress?: (count: number, folderPath: string) => void
): Promise<LX.WebDAVPlay.MusicInfo[]> => {
  const result: LX.WebDAVPlay.MusicInfo[] = []
  const items = await getDirectoryItems(folder?.path)
  for (const item of items) {
    if (item.type === 'directory') {
      result.push(
        ...(await scanFolder({ path: item.filename, name: item.basename }, onProgress))
      )
      onProgress?.(result.length, item.filename)
      continue
    }
    if (item.type !== 'file') continue
    const ext = getExt(item.basename)
    if (!audioExts.has(ext)) continue
    result.push(toMusicInfo(item))
  }
  return result
}

export const scanWebDAVSongs = async (
  folder: LX.WebDAVPlay.DriveFolder | null,
  onProgress?: (count: number, folderPath: string) => void
): Promise<LX.WebDAVPlay.Config> => {
  const songs = await scanFolder(folder, onProgress)
  songs.sort((a, b) => b.meta.lastModifiedTime - a.meta.lastModifiedTime)

  const config = await getWebDAVPlayConfig()
  config.selectedFolder = folder
  config.songs = songs
  config.scannedAt = Date.now()
  await saveWebDAVPlayConfig(config)
  return config
}
