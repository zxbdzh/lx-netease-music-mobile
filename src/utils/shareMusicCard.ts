const timeFieldExp = /^(?:\[[\d:.]+\])+/g
const timeExp = /\d{1,3}(?::\d{1,3}){0,2}(?:\.\d{1,3})/g

const formatTimeLabel = (label: string) => {
  return label
    .replace(/^0+(\d+)/, '$1')
    .replace(/:0+(\d+)/g, ':$1')
    .replace(/\.0+(\d+)/, '.$1')
}

const parseLyricLines = (lyric = '') => {
  if (!lyric) return []
  const linesMap = new Map<string, { key: string; text: string; time: string }>()
  const rows = lyric.split(/\r\n|\n|\r/)
  for (const row of rows) {
    const line = row.trim()
    const timeField = line.match(timeFieldExp)?.[0]
    if (!timeField) continue
    const text = line
      .replace(timeFieldExp, '')
      .replace(/<\d+(?:,\d+)?>/g, '')
      .trim()
    if (!text || text === '//') continue
    const times = timeField.match(timeExp)
    if (!times) continue
    for (const label of times) {
      const key = formatTimeLabel(label)
      if (!linesMap.has(key)) {
        linesMap.set(key, { key, text, time: key })
      }
    }
  }
  return Array.from(linesMap.values())
}

export interface LyricLine {
  key: string
  text: string
  time: string
  translation: string
}

export const buildLyricSelectableLines = (lyric = '', tlyric = ''): LyricLine[] => {
  const baseLines = parseLyricLines(lyric)
  const transMap = new Map(parseLyricLines(tlyric).map(line => [line.key, line.text]))
  return baseLines
    .map(line => ({ ...line, translation: transMap.get(line.key) || '' }))
    .filter(line => line.text)
}

export const resolveMusicDetailWebUrl = (musicInfo: LX.Music.MusicInfo | null): string => {
  if (!musicInfo) return ''
  const meta = musicInfo.meta as any
  switch (musicInfo.source) {
    case 'wy':
      if (meta?.songId) return `https://project.zxbdwy.online/music?id=${meta.songId}`
      return `https://music.163.com/song?id=${musicInfo.id}`
    case 'tx':
      if (meta?.strMediaMid) return `https://y.qq.com/n/ryqq/songDetail/${meta.strMediaMid}`
      break
    case 'kg':
      if (meta?.hash) return `https://www.kugou.com/song/#hash=${meta.hash}`
      break
    case 'kw':
      if (meta?.songId) return `https://www.kuwo.cn/play_detail/${meta.songId}`
      break
  }
  const searchText = encodeURIComponent(`${musicInfo.name} ${musicInfo.singer}`.trim())
  return `https://music.163.com/#/search/m/?s=${searchText}`
}
