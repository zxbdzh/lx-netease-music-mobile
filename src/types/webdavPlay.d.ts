declare namespace LX {
  namespace WebDAVPlay {
    interface DriveFolder {
      path: string   // 服务器绝对路径(原始未编码),作为唯一标识
      name: string
    }
    interface Config {
      selectedFolder?: DriveFolder | null
      songs: MusicInfo[]
      scannedAt?: number
    }
    interface MusicInfo extends LX.Music.MusicInfoLocal {
      meta: LX.Music.MusicInfoMeta_local & {
        webdav: true              // ← 源判别标记
        filePath: string          // 服务器绝对路径(原始未编码)
        fileName: string
        ext: string
        size?: number
        picUrl?: string           // WebDAV 无缩略图,通常为空,由在线源补
        lastModifiedTime: number
      }
    }
  }
}
