# WebDAV 远程播放 · 并行实施任务书

> 配套文档:`doc/WebDAV播放可行性报告.md`(可行性论证)、`doc/OneDrive播放实现分析.md`(架构范本)
> 编排策略:**T0 定契约 → 批次 A(T1~T4)四路并行建新文件 → T5 单路收尾接共享文件**
> 制定日期:2026-05-23

---

## 0. 总览

```
[P0 冒烟验证] ──通过──▶ [T0 契约冻结] ──▶ ┌─ T1 客户端+配置 ─┐
     │(不通过则停)                        ├─ T2 扫描+转换  ─┤  批次 A 并行
     ▼                                     ├─ T3 播放适配   ─┤
  先排障再投入                              └─ T4 UI 页面    ─┘
                                                  │
                                                  ▼
                                          [T5 集成接线 · 串行收尾]
```

| 阶段 | 并行度 | 触碰文件性质 | 冲突风险 |
|------|--------|-------------|----------|
| P0 冒烟 | 1 人 | 临时验证代码(不入库) | 无 |
| T0 契约 | 1 人 | 仅本文档 + `types/webdavPlay.d.ts` | 无 |
| 批次 A | 4 路并行 | **全新文件,互不重叠** | 无 |
| T5 收尾 | 1 路串行 | **已有共享文件** | 必须串行 |

---

## 1. P0 · 前置冒烟验证(必做,最高优先级)

**目的**:用最小代价验证「带 `Authorization` 头的 track 能否被 TrackPlayer 流式播放」。这是整个功能唯一的技术悬念,通过即无风险,不通过则先解决再投入并行,避免浪费 4 路 agent。

**做法**:在任意可触发播放处临时构造一个 track 直接喂播放器:

```js
import { Buffer } from '@craftzdog/react-native-buffer'
const token = Buffer.from(`${user}:${pass}`).toString('base64')
await TrackPlayer.add([{
  id: 'smoke_test',
  url: 'http://<你的WebDAV>/music/test.mp3',   // 路径含中文则先 encodeURI
  title: 'smoke', artist: 'test',
  headers: { Authorization: `Basic ${token}` },
}])
await TrackPlayer.play()
```

**验收**:
- [ ] 能正常出声播放
- [ ] 能拖动进度条 seek(验证服务器 Range 206 支持)
- [ ] http 明文地址可直连(已知 `network_security_config.xml` 放行,确认即可)

> 不通过的常见原因:服务器不支持 Range、自签 HTTPS 证书被拒、路径编码错误。先解决再继续。

---

## 2. T0 · 接口契约(并行任务的唯一事实来源)

> ⚠️ 批次 A 的所有 agent 必须严格按本节签名/编码开发。**契约一旦冻结不得擅自更改**;如需调整,先改本节并通知所有相关任务。

### 2.1 配置与存储约定(关键)

| 数据 | 存放位置 | 键 | 同步性 | 理由 |
|------|---------|-----|--------|------|
| 连接配置(url/username/password) | **setting** | `webdavPlay.url` / `.username` / `.password` | **同步可读** | `playList.ts:getTrackHeaders` 是**同步函数**,运行时必须同步拿到凭证生成头;放异步 storage 会拿不到 |
| 扫描数据(已选目录/歌曲/扫描时间) | storage | `@webdav_play_config` | 异步 | 数据量大,与 OneDrive `@onedrive_config` 对称 |

> 🔴 **红线**:凭证只存 `setting`,**绝不写入 `musicInfo.meta`**。歌曲对象会随临时列表/歌单导出或同步,凭证入 meta 会泄露。`getTrackHeaders` 运行时从 `settingState.setting` 现取现生成。

### 2.2 类型定义 `src/types/webdavPlay.d.ts`(T0 建立)

```ts
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
```

设置项类型补充到 `src/types/app_setting.d.ts`:`'webdavPlay.url' | 'webdavPlay.username' | 'webdavPlay.password': string`。
默认值补充到 `src/config/defaultSetting.ts`:三者默认 `''`。

### 2.3 各模块对外导出签名(冻结)

```ts
// ── core/webdavPlay/client.ts (T1) ──
export const resetWebDAVPlayClient: () => void
export const testWebDAVPlayConnection: () => Promise<boolean>
export const getWebDAVBaseUrl: () => string                                   // 同步,去尾部斜杠
export const getWebDAVPlayCredentials: () => { username: string; password: string }  // 同步,从 settingState 读
export const buildWebDAVFileUrl: (filePath: string) => string                // 同步,见 2.4 编码约定
export const getWebDAVPlayConfig: () => Promise<LX.WebDAVPlay.Config>
export const saveWebDAVPlayConfig: (config: LX.WebDAVPlay.Config) => Promise<void>
// 内部:getClient(): WebDAVClient | null  —— 独立单例,不复用 utils/webdav.ts

// ── core/webdavPlay/drive.ts (T2) ──
export const listWebDAVFolders: (folder?: LX.WebDAVPlay.DriveFolder | null) => Promise<LX.WebDAVPlay.DriveFolder[]>
export const saveWebDAVSelectedFolder: (folder: LX.WebDAVPlay.DriveFolder | null) => Promise<LX.WebDAVPlay.Config>
export const scanWebDAVSongs: (
  folder: LX.WebDAVPlay.DriveFolder | null,
  onProgress?: (count: number, folderPath: string) => void
) => Promise<LX.WebDAVPlay.Config>

// ── core/webdavPlay/music.ts (T3) ──
export const getMusicUrl: (args: { musicInfo: LX.WebDAVPlay.MusicInfo; isRefresh: boolean }) => Promise<string>
export const getPicUrl:   (args: { musicInfo: LX.WebDAVPlay.MusicInfo; isRefresh: boolean; listId?: string | null }) => Promise<string>
export const getLyricInfo:(args: { musicInfo: LX.WebDAVPlay.MusicInfo; isRefresh: boolean }) => Promise<LX.Player.LyricInfo>

// ── core/webdavPlay/utils.ts (T3) ──
export const isWebDAVMusicInfo: (musicInfo?: LX.Music.MusicInfo | LX.Download.ListItem | null) => boolean
```

### 2.4 编码与命名约定(冻结)

- **URL 拼接**(`buildWebDAVFileUrl`,归属 T1,T3 调用):
  `getWebDAVBaseUrl()` + filePath 按 `/` 分段、每段 `encodeURIComponent` 后再 `join('/')`。**禁止**整体 `encodeURI`(会漏编码 `#` `?` 等)。
- **歌曲 id**:`webdav_${filePath}`(与 OneDrive `onedrive_${itemId}` 对称)。
- **歌名/歌手解析** `parseFileName`:以文件名首个 `-` 切分,左歌名右歌手(与 OneDrive 完全一致)。
- **音频扩展名白名单**(各任务各自定义同一份):`mp3 flac wav m4a aac ogg oga opus wma ape`。
- **`source` 字段**:统一 `'local'`(复用 local 源路由),靠 `meta.webdav` 区分。
- **导航**:id = `nav_webdav`;图标见 T5 第 3 项(需确认/新增 `svg:webdav`)。

---

## 3. 批次 A · 四路并行(T0 冻结后同时启动)

> 所有任务**只新建自己负责的文件**,严禁触碰任何已有共享文件(共享改动全部留到 T5)。

### T1 · 客户端 + 配置
- **文件(新建)**:`src/core/webdavPlay/client.ts`
- **参照**:`oneDrive/auth.ts`(配置读写部分)、`utils/webdav.ts`(createClient 用法)
- **要点**:
  - 用 `webdav` 库 `createClient(url, { username, password })` 建**独立单例**,凭证取自 `settingState.setting['webdavPlay.*']`;`resetWebDAVPlayClient` 清空单例(配置变更时调用)。
  - `getWebDAVBaseUrl`/`getWebDAVPlayCredentials` 同步从 settingState 读。
  - `buildWebDAVFileUrl` 按 2.4 编码约定实现。
  - `testWebDAVPlayConnection` = `getDirectoryContents('/')` 探活。
  - `@webdav_play_config` 读写(`getData/saveData`,经 `@/plugins/storage`)。
- **验收**:
  - [ ] 导出签名与 2.3 完全一致
  - [ ] 凭证仅从 setting 读,不落 storage、不落 meta
  - [ ] `buildWebDAVFileUrl('/音乐/a b#.mp3')` 输出各段正确编码

### T2 · 扫描 + 转换
- **文件(新建)**:`src/core/webdavPlay/drive.ts`
- **参照**:`oneDrive/drive.ts`(`scanFolder`/`toMusicInfo`/`listOneDriveFolders`)
- **要点**:
  - 目录浏览/递归扫描用库 `getDirectoryContents(path, { deep: true })`(或逐层递归 + `onProgress`)。
  - 过滤 `type==='file'` 且扩展名在白名单内;`toMusicInfo` 产出 `meta.webdav=true`、`filePath`(原始未编码)、`fileName`、`ext`、`size`、`lastModifiedTime`。
  - 扫描结果按 `lastModifiedTime` 倒序;写入 `saveWebDAVPlayConfig`(调用 T1)。
  - `listWebDAVFolders` 只返回 `directory` 类型并按名排序。
- **轻依赖**:调用 T1 的 `getClient`/`getWebDAVPlayConfig`/`saveWebDAVPlayConfig`(按 2.3 签名,无需等 T1 完成即可编码)。
- **验收**:
  - [ ] `scanWebDAVSongs` 返回的 `MusicInfo` 结构符合 2.2
  - [ ] `filePath` 保存原始路径(供 `buildWebDAVFileUrl` 编码)
  - [ ] 递归扫描有进度回调

### T3 · 播放适配 + 判断
- **文件(新建)**:`src/core/webdavPlay/music.ts`、`src/core/webdavPlay/utils.ts`
- **参照**:`oneDrive/music.ts`、`oneDrive/utils.ts`
- **要点**:
  - `getMusicUrl` = `buildWebDAVFileUrl(musicInfo.meta.filePath)`(同步拼接,**无需** OneDrive 那样实时刷新)。
  - `getPicUrl` 返回 `meta.picUrl ?? ''`。
  - `getLyricInfo` **直接复刻** `oneDrive/music.ts` 的在线源匹配逻辑(getOnlineOtherSourceLyricByLocal / getOtherSource)。
  - `isWebDAVMusicInfo`:`source==='local' && !!meta.webdav`(注意兼容 `'progress' in musicInfo` 的下载项,参照 OneDrive utils)。
- **轻依赖**:调用 T1 的 `buildWebDAVFileUrl`。
- **验收**:
  - [ ] 导出签名与 2.3 一致
  - [ ] `isWebDAVMusicInfo` 对 OneDrive 歌曲返回 false(靠 `meta.webdav` 区分,勿误判)

### T4 · UI 页面
- **文件(新建)**:`src/screens/Home/Views/WebDAVPlay/index.tsx`
- **参照**:`screens/Home/Views/OneDrive/index.tsx`(去掉 OAuth/设备码部分)
- **要点**:
  - **配置页**:URL / 用户名 / 密码 输入(写入 `webdavPlay.*` setting,用 `updateSetting`)+「测试连接」(调 `testWebDAVPlayConnection`)+ 目录浏览(`listWebDAVFolders`)+「选择当前目录」「扫描」。
  - **列表页**:`scanWebDAVSongs` 进度展示、搜索过滤、点击播放 = `overwriteListMusics(LIST_IDS.TEMP, songs)` → `playList(LIST_IDS.TEMP, index)`(与 OneDrive `handlePlay` 一致)。
  - 比 OneDrive 简单:无设备码轮询、无 token 过期展示。
- **轻依赖**:调用 T1/T2/T3 的导出函数(按 2.3 签名)。
- **验收**:
  - [ ] 配置 → 测试连接 → 浏览目录 → 扫描 → 列表展示 全流程 UI 可走通(播放依赖 T5)
  - [ ] 密码输入框写入 `webdavPlay.password`

---

## 4. T5 · 集成接线(批次 A 完成后,单 agent 串行)

> 改动**已有共享文件**,务必单路串行,严禁与批次 A 重叠。

1. **`src/plugins/player/playList.ts`(核心)**:`getTrackHeaders` 增加 WebDAV 分支——识别 `info.source==='local' && info.meta?.webdav`,用 `@craftzdog/react-native-buffer` 的 `Buffer` 同步生成 `Authorization: Basic base64(user:pass)`,凭证取自 `getWebDAVPlayCredentials()`。**凭证不入 meta**。
2. **`src/core/music/index.ts`**:`getMusicUrl` / `getPicPath` / `getLyricInfo` 三函数的 `source==='local'` 分支内,各加 `if ('webdav' in musicInfo.meta)` 路由到 `webdavPlay/music.ts`(置于 OneDrive 判断旁)。
3. **`src/config/constant.ts` + `defaultSetting.ts`**:注册 `{ id: 'nav_webdav', icon: ? }` 导航项 + `nav_webdav: true` 默认显隐。⚠️ **图标待确认**:若无 `svg:webdav` 资源,先回退到现有图标(如 `album`)或新增 svg,勿阻塞。
4. **`src/core/sync/syncHelpers.ts`**:`SENSITIVE_SETTING_KEYS` 加入 `'webdavPlay.password'`(防止凭证随设置同步上传)。
5. **`src/event/appEvent.ts`(可选)**:`jumpListPosition` 增加 WebDAV 歌曲定位(参照 OneDrive `jumpOneDrivePosition`,UI 侧 T4 需配合监听)。
6. **联调**:跑通最小闭环。

---

## 5. 协调与冲突管理

### 冲突红线
- 🔴 批次 A 任一 agent **严禁**修改 `playList.ts` / `core/music/index.ts` / `constant.ts` / `defaultSetting.ts` / `syncHelpers.ts` / `appEvent.ts` —— 所有共享改动**只在 T5 发生**。
- 🔴 凭证**只存 setting,不入 meta**(见 2.1)。
- 🔴 契约(第 2 节)冻结后不得单方更改。

### 并行安全性说明
T2/T3/T4 对 T1 是「轻依赖」:基于 2.3 冻结签名即可编码,各自负责的新文件互不重叠,无写冲突。`buildWebDAVFileUrl` 归 T1 提供,T2/T3 调用,避免重复实现导致编码不一致。

### 最小人力版(agent 不足时)
- 合并 **T1+T2**(同属 core 数据层)、**T3+T4** 两组并行;T5 收尾。
- 再不足:T0 → 顺序做 T1→T2→T3→T4 → T5(全串行,零冲突)。

---

## 6. 总验收清单

- [ ] P0 冒烟通过(带头拉流 + seek)
- [ ] T0 契约文档 + `webdavPlay.d.ts` + 设置项默认值就位
- [ ] T1~T4 各自验收项全绿,导出签名与 2.3 一致
- [ ] T5 六项接线完成
- [ ] **端到端**:配置服务器 → 测试连接 → 浏览/选目录 → 扫描出歌曲 → 点击 → 带 `Authorization` 头流式播放 → 可 seek、可后台、通知栏正常
- [ ] 凭证未出现在 `@webdav_play_config` / 歌曲 meta / 同步上传数据中
- [ ] OneDrive 既有功能无回归(源路由未被误伤)
