import { getSession, LASTFM_API_KEY, LASTFM_API_SECRET } from '@/services/lastfm/api'
import { updateSetting } from '@/core/common'
import { toast } from '@/utils/tools'

export const handleLastfmAction = async (action: string, params: any) => {
  if (action !== 'auth') {
    throw new Error('Unknown Last.fm action: ' + action)
  }

  const token = params.token
  if (!token) {
    toast('授权失败：未获取到 token')
    return
  }

  try {
    toast('正在获取 Session Key...')
    const result = await getSession(token, LASTFM_API_KEY, LASTFM_API_SECRET)

    if (result.error) {
      toast(`授权失败: ${result.message}`)
      return
    }

    const sessionKey = result.data?.session?.key
    if (!sessionKey) {
      toast('授权失败：未获取到 Session Key')
      return
    }

    updateSetting({ 'common.lastfm_session_key': sessionKey })
    toast('Last.fm 授权成功！')
  } catch (error: any) {
    toast(`授权失败: ${error.message}`)
  }
}
