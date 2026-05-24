import RNFetchBlob from 'rn-fetch-blob'
import { Buffer } from '@craftzdog/react-native-buffer'
import { getMusicUrl, getLyricInfo } from '@/core/music'
import { getPicUrl } from '@/core/music/online'
import { mergeLyrics } from '@/screens/Home/Views/Mylist/MusicList/download/lrcTool'
import {
  getFileExtension,
  getFileExtensionFromUrl,
} from '@/screens/Home/Views/Mylist/MusicList/download/utils'
import { writeMetadata, writePic, writeLyric } from '@/utils/localMediaMetadata'
import { unlink, temporaryDirectoryPath } from '@/utils/fs'
import { filterFileName } from '@/utils'
import { getListMusics } from '@/utils/listManage'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'
import {
  ensureWebDAVDirectory,
  getWebDAVJsonFile,
  getWebDAVPlayConfig,
  getWebDAVPlayCredentials,
  uploadWebDAVFile,
  uploadWebDAVFileFromPath,
  webdavExists,
} from './client'

const DOWNLOAD_UA =
  'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36'

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`

// 🔴 凭证只在运行时现取生成头,绝不入 meta / manifest
const getFetchHeaders = (musicInfo: LX.Music.MusicInfo): Record<string, string> => {
  if (musicInfo.source === 'local' && (musicInfo.meta as any).webdav) {
    const { username, password } = getWebDAVPlayCredentials()
    const token = Buffer.from(`${username}:${password}`).toString('base64')
    return { Authorization: `Basic ${token}` }
  }
  if (musicInfo.source === 'wy') return { 'User-Agent': '' }
  return { 'User-Agent': DOWNLOAD_UA }
}

const resolveExt = (musicInfo: LX.Music.MusicInfo, quality: LX.Quality): string => {
  if (musicInfo.source === 'local') return (musicInfo.meta as any).ext || 'mp3'
  return getFileExtension(quality)
}

interface UploadResult {
  uploaded: number
  skipped: number
  failed: number
  folderPath: string
}

/**
 * 把一个本地歌单下载并转存为 WebDAV 歌单:
 * 逐首解析直链 → 拉流到临时文件 → 内嵌封面/歌词 → 上传音频 + .lrc → 写 lx_playlist.json。
 * 🔴 manifest 仅存业务元数据(相对文件名),不含凭证/绝对 URL。
 */
export const downloadListToWebDAV = async ({
  listId,
  playlistName,
  quality,
  onProgress,
}: {
  listId: string
  playlistName: string
  quality?: LX.Quality
  onProgress?: (done: number, total: number, current: string) => void
}): Promise<UploadResult> => {
  const config = await getWebDAVPlayConfig()
  const root = config.selectedFolder
  if (!root) throw new Error('请先在 WebDAV 页选择一个目录')

  const songs = await getListMusics(listId)
  if (!songs.length) throw new Error('歌单为空')

  const targetQuality = quality ?? settingState.setting['player.playQuality']
  const folderName = filterFileName(playlistName)
  const folderPath = joinPath(root.path, folderName)
  await ensureWebDAVDirectory(folderPath)

  // 读现有 manifest,按 songId 建索引,用于跳过已存在歌曲
  const existingManifest = await getWebDAVJsonFile<LX.WebDAVPlay.PlaylistManifest>(
    joinPath(folderPath, 'lx_playlist.json')
  )
  const existingBySongId = new Map<string, LX.WebDAVPlay.PlaylistManifestSong>()
  if (existingManifest?.songs?.length) {
    for (const s of existingManifest.songs) {
      if (s.songId) existingBySongId.set(s.songId, s)
    }
  }

  const manifestSongs: LX.WebDAVPlay.PlaylistManifestSong[] = []
  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < songs.length; i++) {
    const musicInfo = songs[i]
    onProgress?.(i, songs.length, musicInfo.name)

    // 稳妥跳过:songId 已在现有 manifest 且服务器上文件仍在,则复用旧条目不重传
    const songId = String(musicInfo.meta.songId ?? musicInfo.id)
    const existing = existingBySongId.get(songId)
    if (existing) {
      const fileOnServer = await webdavExists(
        joinPath(folderPath, existing.fileName)
      ).catch(() => false)
      if (fileOnServer) {
        manifestSongs.push(existing)
        skipped++
        continue
      }
    }

    const ext = resolveExt(musicInfo, targetQuality)
    const baseName = filterFileName(
      musicInfo.singer ? `${musicInfo.name} - ${musicInfo.singer}` : musicInfo.name
    )
    const audioFileName = `${baseName}.${ext}`
    const tmpAudio = joinPath(temporaryDirectoryPath, `webdav_up_${Date.now()}_${i}.${ext}`)
    let tmpPic: string | null = null
    let picUrlForManifest = ''

    try {
      // 1. 解析直链 + 拉流到临时文件
      const url = await getMusicUrl({ musicInfo, quality: targetQuality, isRefresh: true })
      if (!url) throw new Error('未取到播放地址')
      await RNFetchBlob.config({ path: tmpAudio, fileCache: true }).fetch(
        'GET',
        url,
        getFetchHeaders(musicInfo)
      )

      // 2. 写标签
      try {
        await writeMetadata(
          tmpAudio,
          {
            name: musicInfo.name,
            singer: musicInfo.singer,
            albumName: musicInfo.meta.albumName ?? '',
          },
          true
        )
      } catch (e) {
        log.warn(`[webdav upload] 写标签失败: ${musicInfo.name}`)
      }

      // 3. 内嵌封面
      try {
        const picUrl = await getPicUrl({
          musicInfo: musicInfo as LX.Music.MusicInfoOnline,
          isRefresh: false,
        })
        if (picUrl) {
          picUrlForManifest = picUrl
          tmpPic = joinPath(temporaryDirectoryPath, `webdav_pic_${Date.now()}_${i}.${getFileExtensionFromUrl(picUrl)}`)
          await RNFetchBlob.config({ path: tmpPic }).fetch('GET', picUrl)
          await writePic(tmpAudio, tmpPic)
        }
      } catch (e) {
        log.warn(`[webdav upload] 封面处理失败: ${musicInfo.name}`)
      }

      // 4. 内嵌歌词 + 旁车 .lrc
      let lrcContent = ''
      try {
        const lyrics = await getLyricInfo({ musicInfo })
        lrcContent = mergeLyrics(lyrics.lyric, lyrics.tlyric, null)
        if (lrcContent) await writeLyric(tmpAudio, lrcContent)
      } catch (e) {
        log.warn(`[webdav upload] 歌词处理失败: ${musicInfo.name}`)
      }

      // 5. 流式上传音频(直接从文件路径 PUT,避免整文件读入内存导致 OOM)
      await uploadWebDAVFileFromPath(joinPath(folderPath, audioFileName), tmpAudio)

      // 6. 上传旁车 .lrc(文本)
      if (lrcContent) {
        await uploadWebDAVFile(joinPath(folderPath, `${baseName}.lrc`), lrcContent)
      }

      manifestSongs.push({
        fileName: audioFileName,
        name: musicInfo.name,
        singer: musicInfo.singer,
        albumName: musicInfo.meta.albumName ?? '',
        interval: musicInfo.interval ?? null,
        source: musicInfo.source,
        songId,
        ext,
        picUrl: picUrlForManifest || undefined,
      })
      uploaded++
    } catch (e: any) {
      failed++
      log.error(`[webdav upload] 上传失败 ${musicInfo.name}: ${e?.message ?? e}`)
    } finally {
      void unlink(tmpAudio).catch(() => {})
      if (tmpPic) void unlink(tmpPic).catch(() => {})
    }
  }

  // 7. 写 manifest
  const now = Date.now()
  const manifest: LX.WebDAVPlay.PlaylistManifest = {
    version: 1,
    name: playlistName,
    createTime: now,
    updateTime: now,
    songs: manifestSongs,
  }
  await uploadWebDAVFile(
    joinPath(folderPath, 'lx_playlist.json'),
    JSON.stringify(manifest, null, 2)
  )

  onProgress?.(songs.length, songs.length, '')
  return { uploaded, skipped, failed, folderPath }
}
