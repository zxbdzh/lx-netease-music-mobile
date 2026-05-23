import { getPlayerLyric, saveLyric } from '@/utils/data'
import { updateListMusics } from '@/core/list'
import {
  buildLyricInfo,
  getOnlineOtherSourceLyricByLocal,
  getOnlineOtherSourceLyricInfo,
  getOnlineOtherSourcePicByLocal,
  getOnlineOtherSourcePicUrl,
  getOtherSource,
} from '@/core/music/utils'
import { buildWebDAVFileUrl } from './client'

export const getMusicUrl = async ({
  musicInfo,
}: {
  musicInfo: LX.WebDAVPlay.MusicInfo
  isRefresh: boolean
}): Promise<string> => {
  return buildWebDAVFileUrl(musicInfo.meta.filePath)
}

export const getPicUrl = async ({
  musicInfo,
  isRefresh,
  listId,
}: {
  musicInfo: LX.WebDAVPlay.MusicInfo
  isRefresh: boolean
  listId?: string | null
}): Promise<string> => {
  if (!isRefresh && musicInfo.meta.picUrl) return musicInfo.meta.picUrl

  // WebDAV 无缩略图,从在线源匹配封面
  try {
    return await getOnlineOtherSourcePicByLocal(musicInfo).then(({ url }) => url)
  } catch {}

  const otherSource = await getOtherSource(musicInfo, isRefresh)
  if (otherSource.length) {
    try {
      return await getOnlineOtherSourcePicUrl({
        musicInfos: [...otherSource],
        onToggleSource() {},
        isRefresh,
      }).then(({ url }) => {
        if (url && listId) {
          musicInfo.meta.picUrl = url
          void updateListMusics([{ id: listId, musicInfo }])
        }
        return url
      })
    } catch {}
  }

  return musicInfo.meta.picUrl ?? ''
}

export const getLyricInfo = async ({
  musicInfo,
  isRefresh,
}: {
  musicInfo: LX.WebDAVPlay.MusicInfo
  isRefresh: boolean
}): Promise<LX.Player.LyricInfo> => {
  const cachedLyric = await getPlayerLyric(musicInfo)
  if (cachedLyric.lyric && !isRefresh) return cachedLyric

  try {
    return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(
      ({ lyricInfo, isFromCache }) => {
        if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
        return buildLyricInfo(lyricInfo)
      }
    )
  } catch {}

  const otherSource = await getOtherSource(musicInfo, isRefresh)
  if (otherSource.length) {
    const { lyricInfo, musicInfo: targetMusicInfo, isFromCache } =
      await getOnlineOtherSourceLyricInfo({
        musicInfos: [...otherSource],
        onToggleSource() {},
        isRefresh,
      })
    void saveLyric(musicInfo, lyricInfo)
    if (!isFromCache) void saveLyric(targetMusicInfo, lyricInfo)
    return buildLyricInfo(lyricInfo)
  }

  return cachedLyric
}
