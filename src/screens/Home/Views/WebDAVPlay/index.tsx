import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { LIST_IDS, LIST_ITEM_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { getPicPath } from '@/core/music'
import { usePlayMusicInfo } from '@/store/player/hook'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import {
  getWebDAVPlayConfig,
  resetWebDAVPlayClient,
  saveWebDAVPlayConfig,
  testWebDAVPlayConnection,
} from '@/core/webdavPlay/client'
import {
  listWebDAVFolders,
  saveWebDAVSelectedFolder,
  scanWebDAVSongs,
} from '@/core/webdavPlay/drive'

type ActiveTab = 'config' | 'list'
const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)

const formatTime = (time?: number) => {
  if (!time) return ''
  return new Date(time).toLocaleString()
}

const formatBriefTime = (time?: number) => {
  if (!time) return ''
  const date = new Date(time)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatSize = (size?: number) => {
  if (!size) return ''
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const getFolderName = (folder?: LX.WebDAVPlay.DriveFolder | null) => folder?.path || 'WebDAV 根目录'

const SongItem = memo(
  ({
    item,
    isPlaying,
    onPress,
    onPicResolved,
  }: {
    item: LX.WebDAVPlay.MusicInfo
    isPlaying: boolean
    onPress: (musicInfo: LX.WebDAVPlay.MusicInfo) => void
    onPicResolved: () => void
  }) => {
    const theme = useTheme()
    const [picUrl, setPicUrl] = useState(item.meta.picUrl)
    const subText = item.singer || item.meta.filePath
    const sizeText = formatSize(item.meta.size)
    const timeText = formatBriefTime(item.meta.lastModifiedTime)
    const detailText = [sizeText, timeText].filter(Boolean).join(' · ')

    // WebDAV 无缩略图,可见时从在线源懒加载封面并缓存回 meta
    useEffect(() => {
      if (item.meta.picUrl) {
        setPicUrl(item.meta.picUrl)
        return
      }
      let cancelled = false
      void getPicPath({ musicInfo: item, listId: null })
        .then((url) => {
          if (cancelled || !url) return
          item.meta.picUrl = url
          setPicUrl(url)
          onPicResolved()
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }, [item, onPicResolved])

    return (
      <View
        style={{
          ...styles.songItem,
          backgroundColor: isPlaying ? theme['c-primary-background-hover'] : 'transparent',
        }}
      >
        <TouchableOpacity style={styles.songItemLeft} onPress={() => onPress(item)}>
          <View style={styles.sn}>
            <Image url={picUrl} style={styles.albumArt} />
          </View>
          <View style={styles.itemInfo}>
            <Text color={isPlaying ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1}>
              {item.name || item.meta.fileName}
            </Text>
            <View style={styles.listItemSingle}>
              <Text
                style={styles.listItemSingleText}
                size={11}
                color={isPlaying ? theme['c-primary-alpha-200'] : theme['c-500']}
                numberOfLines={1}
              >
                {subText}
              </Text>
            </View>
            {detailText ? (
              <Text size={10} color={isPlaying ? theme['c-primary-alpha-200'] : theme['c-500']} numberOfLines={1}>
                {detailText}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>
    )
  }
)

export default memo(() => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()
  const [activeTab, setActiveTab] = useState<ActiveTab>('config')
  const [url, setUrl] = useState(() => settingState.setting['webdavPlay.url'] ?? '')
  const [username, setUsername] = useState(() => settingState.setting['webdavPlay.username'] ?? '')
  const [password, setPassword] = useState(() => settingState.setting['webdavPlay.password'] ?? '')
  const [connected, setConnected] = useState(() => !!(settingState.setting['webdavPlay.url'] ?? '').trim())
  const [statusText, setStatusText] = useState('')
  const [loading, setLoading] = useState(false)
  const [folderStack, setFolderStack] = useState<LX.WebDAVPlay.DriveFolder[]>([])
  const [folders, setFolders] = useState<LX.WebDAVPlay.DriveFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<LX.WebDAVPlay.DriveFolder | null>(null)
  const [songs, setSongs] = useState<LX.WebDAVPlay.MusicInfo[]>([])
  const [scannedAt, setScannedAt] = useState<number | undefined>()
  const [folderLoading, setFolderLoading] = useState(false)
  const [scanText, setScanText] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const listRef = useRef<FlatList<LX.WebDAVPlay.MusicInfo>>(null)
  const searchInputRef = useRef<TextInput>(null)

  const currentFolder = folderStack.at(-1) ?? null

  const filteredSongs = useMemo(() => {
    const text = searchText.trim().toLowerCase()
    if (!text) return songs
    return songs.filter((item) => {
      return [
        item.name,
        item.singer,
        item.meta.fileName,
        item.meta.filePath,
      ].some(value => (value ?? '').toLowerCase().includes(text))
    })
  }, [searchText, songs])

  const loadConfig = useCallback(() => {
    void getWebDAVPlayConfig().then((config) => {
      setSelectedFolder(config.selectedFolder ?? null)
      setSongs(config.songs ?? [])
      setScannedAt(config.scannedAt)
    })
  }, [])

  const loadFolders = useCallback((folder: LX.WebDAVPlay.DriveFolder | null) => {
    setFolderLoading(true)
    void listWebDAVFolders(folder)
      .then(setFolders)
      .catch((err: any) => {
        const message = err.message ?? String(err)
        toast(message, 'long')
      })
      .finally(() => {
        setFolderLoading(false)
      })
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!connected) {
      setFolders([])
      return
    }
    loadFolders(currentFolder)
  }, [connected, currentFolder, loadFolders])

  const handleChangeUrl = useCallback((text: string) => {
    setUrl(text)
    updateSetting({ 'webdavPlay.url': text.trim() })
    resetWebDAVPlayClient()
    setConnected(false)
    setFolderStack([])
  }, [])

  const handleChangeUsername = useCallback((text: string) => {
    setUsername(text)
    updateSetting({ 'webdavPlay.username': text })
    resetWebDAVPlayClient()
    setConnected(false)
  }, [])

  const handleChangePassword = useCallback((text: string) => {
    setPassword(text)
    updateSetting({ 'webdavPlay.password': text })
    resetWebDAVPlayClient()
    setConnected(false)
  }, [])

  const handleTestConnection = useCallback(() => {
    Keyboard.dismiss()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      toast('请先填写服务器地址')
      return
    }
    updateSetting({
      'webdavPlay.url': trimmedUrl,
      'webdavPlay.username': username,
      'webdavPlay.password': password,
    })
    resetWebDAVPlayClient()
    setLoading(true)
    setStatusText('正在测试连接...')
    void testWebDAVPlayConnection()
      .then((ok) => {
        if (ok) {
          setConnected(true)
          setFolderStack([])
          setStatusText('连接成功，可在下方浏览目录。')
          toast('WebDAV 连接成功')
        } else {
          setConnected(false)
          setStatusText('连接失败，请检查地址与账号密码。')
          toast('WebDAV 连接失败', 'long')
        }
      })
      .catch((err: any) => {
        const message = err.message ?? String(err)
        setConnected(false)
        setStatusText(message)
        toast(message, 'long')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [url, username, password])

  const handleSelectCurrentFolder = useCallback(() => {
    setLoading(true)
    void saveWebDAVSelectedFolder(currentFolder)
      .then((config) => {
        setSelectedFolder(config.selectedFolder ?? null)
        toast(`已选择：${getFolderName(config.selectedFolder)}`)
      })
      .catch((err: any) => {
        toast(err.message ?? String(err), 'long')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [currentFolder])

  const handleScan = useCallback(() => {
    if (!connected) {
      toast('请先测试连接')
      setActiveTab('config')
      return
    }
    const runScan = () => {
      setLoading(true)
      setScanText('开始扫描...')
      void scanWebDAVSongs(selectedFolder, (count, path) => {
        setScanText(`已找到 ${count} 首，正在扫描：${path}`)
      })
        .then((config) => {
          setSongs(config.songs)
          setScannedAt(config.scannedAt)
          setScanText('')
          setActiveTab('list')
          toast(`扫描完成：${config.songs.length} 首`)
        })
        .catch((err: any) => {
          const message = err.message ?? String(err)
          setScanText(message)
          toast(message, 'long')
        })
        .finally(() => {
          setLoading(false)
        })
    }
    if (!selectedFolder) {
      void confirmDialog({
        title: '扫描 WebDAV 根目录',
        message:
          '根目录扫描会递归读取所有子目录。文件很多时会产生大量请求，可能较慢。建议优先选择音乐目录。确定继续扫描根目录？',
        confirmButtonText: '继续扫描',
      }).then((confirmed) => {
        if (confirmed) runScan()
      })
      return
    }
    runScan()
  }, [connected, selectedFolder])

  const handlePlay = useCallback(
    (musicInfo: LX.WebDAVPlay.MusicInfo) => {
      const index = songs.findIndex(item => item.id === musicInfo.id)
      if (index < 0) return
      void overwriteListMusics(LIST_IDS.TEMP, songs).then(() => {
        void playList(LIST_IDS.TEMP, index)
      })
    },
    [songs]
  )

  // 懒加载封面会就地写入 song.meta.picUrl,防抖持久化到配置,避免每次进入列表都重新匹配
  const songsRef = useRef(songs)
  songsRef.current = songs
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePicResolved = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      void getWebDAVPlayConfig().then((config) => {
        config.songs = songsRef.current
        void saveWebDAVPlayConfig(config)
      })
    }, 3000)
  }, [])
  useEffect(
    () => () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    },
    []
  )

  const renderSong: ListRenderItem<LX.WebDAVPlay.MusicInfo> = useCallback(
    ({ item }) => (
      <SongItem
        item={item}
        isPlaying={playMusicInfo.musicInfo?.id === item.id}
        onPress={handlePlay}
        onPicResolved={handlePicResolved}
      />
    ),
    [handlePlay, handlePicResolved, playMusicInfo.musicInfo?.id]
  )

  const headerText = useMemo(() => {
    if (searchText.trim()) return `${filteredSongs.length}/${songs.length} 首`
    return `${songs.length} 首${scannedAt ? ` · ${formatTime(scannedAt)}` : ''}`
  }, [filteredSongs.length, scannedAt, searchText, songs.length])

  const handleToggleSearch = useCallback(() => {
    setSearchVisible((visible) => {
      const nextVisible = !visible
      if (nextVisible) {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus()
        })
      } else {
        setSearchText('')
        Keyboard.dismiss()
      }
      return nextVisible
    })
  }, [])

  const handleClearSearch = useCallback(() => {
    if (searchText) {
      setSearchText('')
      searchInputRef.current?.focus()
      return
    }
    setSearchVisible(false)
    Keyboard.dismiss()
  }, [searchText])

  const renderConfig = () => (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>连接状态</Text>
        <Text color={connected ? theme['c-primary-font'] : theme['c-font-label']}>
          {connected ? '已连接' : '未连接'}
        </Text>
        {statusText ? (
          <Text style={styles.meta} color={theme['c-font-label']}>
            {statusText}
          </Text>
        ) : null}
      </View>

      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>服务器地址</Text>
        <TextInput
          value={url}
          editable={!loading}
          placeholder="http://192.168.1.10:5005/dav"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={handleChangeUrl}
          placeholderTextColor={theme['c-font-label']}
          selectionColor={theme['c-primary-light-100-alpha-300']}
          style={{
            ...styles.input,
            borderColor: theme['c-border-background'],
            color: theme['c-font'],
          }}
        />
        <Text style={styles.label}>用户名</Text>
        <TextInput
          value={username}
          editable={!loading}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={handleChangeUsername}
          placeholderTextColor={theme['c-font-label']}
          selectionColor={theme['c-primary-light-100-alpha-300']}
          style={{
            ...styles.input,
            borderColor: theme['c-border-background'],
            color: theme['c-font'],
          }}
        />
        <Text style={styles.label}>密码</Text>
        <TextInput
          value={password}
          editable={!loading}
          placeholder="password"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          onChangeText={handleChangePassword}
          placeholderTextColor={theme['c-font-label']}
          selectionColor={theme['c-primary-light-100-alpha-300']}
          style={{
            ...styles.input,
            borderColor: theme['c-border-background'],
            color: theme['c-font'],
          }}
        />
        <Text style={styles.tip} color={theme['c-font-label']}>
          支持 http 明文与 https 地址，凭证仅保存在本机设置中。
        </Text>
        <View style={styles.buttonRow}>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={loading || !url.trim()}
            onPress={handleTestConnection}
          >
            <Text color={theme['c-button-font']}>测试连接</Text>
          </Button>
        </View>
      </View>

      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>目录</Text>
        <Text color={theme['c-font-label']} style={styles.meta}>
          当前：{getFolderName(currentFolder)}
        </Text>
        <Text color={theme['c-font-label']} style={styles.meta}>
          已选：{getFolderName(selectedFolder)}
        </Text>
        <View style={styles.buttonRow}>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={!connected || folderLoading || !folderStack.length}
            onPress={() => setFolderStack(prev => prev.slice(0, -1))}
          >
            <Text color={theme['c-button-font']}>返回上级</Text>
          </Button>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={!connected || loading}
            onPress={handleSelectCurrentFolder}
          >
            <Text color={theme['c-button-font']}>选择当前目录</Text>
          </Button>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={!connected || loading}
            onPress={handleScan}
          >
            <Text color={theme['c-button-font']}>扫描已选目录</Text>
          </Button>
        </View>

        {folderLoading ? (
          <Text style={styles.tip} color={theme['c-font-label']}>
            正在读取目录...
          </Text>
        ) : folders.length ? (
          folders.map(folder => (
            <TouchableOpacity
              key={folder.path}
              style={{ ...styles.folderItem, borderBottomColor: theme['c-border-background'] }}
              onPress={() => setFolderStack(prev => [...prev, folder])}
            >
              <Text numberOfLines={1}>{folder.name}</Text>
              <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
                {folder.path}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.tip} color={theme['c-font-label']}>
            {connected ? '当前目录没有子目录。' : '测试连接成功后可以浏览目录。'}
          </Text>
        )}
      </View>
    </ScrollView>
  )

  const renderList = () => (
    <View style={styles.listPage}>
      <View style={{ ...styles.listHeader, borderBottomColor: theme['c-border-background'] }}>
        <View style={styles.listHeaderText}>
          {searchVisible ? (
            <TextInput
              ref={searchInputRef}
              value={searchText}
              placeholder="搜索歌曲或歌手"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onChangeText={setSearchText}
              placeholderTextColor={theme['c-font-label']}
              selectionColor={theme['c-primary-light-100-alpha-300']}
              style={{
                ...styles.searchInput,
                color: theme['c-font'],
                borderColor: theme['c-border-background'],
              }}
            />
          ) : (
            <>
              <Text numberOfLines={1}>已选：{getFolderName(selectedFolder)}</Text>
              <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
                {scanText || headerText}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity style={styles.headerIconButton} onPress={handleToggleSearch}>
          <Icon name="search-2" size={16} color={searchVisible ? theme['c-primary-font'] : theme['c-font-label']} />
        </TouchableOpacity>
        {searchVisible ? (
          <TouchableOpacity style={styles.headerIconButton} onPress={handleClearSearch}>
            <Icon name="close" size={13} color={theme['c-font-label']} />
          </TouchableOpacity>
        ) : null}
        <Button
          style={{ ...styles.scanButton, backgroundColor: theme['c-button-background'] }}
          disabled={!connected || loading}
          onPress={handleScan}
        >
          <Text color={theme['c-button-font']}>扫描</Text>
        </Button>
      </View>
      <FlatList
        ref={listRef}
        data={filteredSongs}
        renderItem={renderSong}
        keyExtractor={item => item.id}
        getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index),
            animated: true,
          })
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text color={theme['c-font-label']}>{searchText.trim() ? '没有匹配的歌曲' : '还没有扫描到歌曲'}</Text>
          </View>
        }
      />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={{ ...styles.tabs, borderBottomColor: theme['c-border-background'] }}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('config')}
        >
          <Text
            style={{
              ...styles.tabText,
              borderBottomColor:
                activeTab === 'config' ? theme['c-primary-font-active'] : 'transparent',
            }}
            color={activeTab === 'config' ? theme['c-primary-font'] : theme['c-font']}
          >
            配置
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('list')}
        >
          <Text
            style={{
              ...styles.tabText,
              borderBottomColor:
                activeTab === 'list' ? theme['c-primary-font-active'] : 'transparent',
            }}
            color={activeTab === 'list' ? theme['c-primary-font'] : theme['c-font']}
          >
            列表
          </Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'config' ? renderConfig() : renderList()}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  tab: {
    paddingRight: 18,
  },
  tabText: {
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  label: {
    marginBottom: 6,
    marginTop: 6,
  },
  meta: {
    marginTop: 5,
  },
  tip: {
    marginTop: 6,
    lineHeight: 18,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    height: 38,
    paddingHorizontal: 6,
    paddingVertical: 0,
    marginTop: 6,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 10,
    marginBottom: 8,
  },
  folderItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
  },
  listPage: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listHeaderText: {
    flex: 1,
    paddingRight: 8,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    height: 34,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 13,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  songItem: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingRight: 2,
  },
  songItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 5,
    paddingRight: 5,
  },
  albumArt: {
    width: 52,
    height: 52,
    borderRadius: 4,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
  },
  listItemSingle: {
    paddingTop: 3,
    flexDirection: 'row',
  },
  listItemSingleText: {
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  empty: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
