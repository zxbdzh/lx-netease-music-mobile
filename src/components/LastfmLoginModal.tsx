import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Modal, { type ModalType } from '@/components/common/Modal'
import WebView, { type WebViewNavigation } from 'react-native-webview'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { toast } from '@/utils/tools'
import { getToken, getSession, getAuthUrl, LASTFM_API_KEY, LASTFM_API_SECRET } from '@/services/lastfm/api'
import { updateSetting } from '@/core/common'

export interface LastfmLoginModalType {
  show: () => void
}

const Header = ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={[styles.header, { height: 50 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
      <TouchableOpacity onPress={onClose} style={styles.backButton}>
        <Icon name="chevron-left" size={24} color={theme['c-font']} />
      </TouchableOpacity>
      <Text size={18}>Last.fm 授权</Text>
      <View style={styles.backButton} />
    </View>
  )
}

export default forwardRef<LastfmLoginModalType, {}>((props, ref) => {
  const modalRef = useRef<ModalType>(null)
  const webViewRef = useRef<WebView>(null)
  const tokenRef = useRef<string>('')
  const stageRef = useRef<'init' | 'wait_auth' | 'done'>('init')
  const isGettingSessionRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useImperativeHandle(ref, () => ({
    show() {
      stageRef.current = 'init'
      tokenRef.current = ''
      isGettingSessionRef.current = false
      modalRef.current?.setVisible(true)
    },
  }))

  const handleClose = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    modalRef.current?.setVisible(false)
  }, [])

  const clearPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startPolling = () => {
    clearPolling()
    // 轮询检测授权成功页面
    intervalRef.current = setInterval(() => {
      const checkJs = `
        (function() {
          var text = document.body ? document.body.innerText : '';
          if (text.indexOf('Application authenticated') !== -1) {
            window.ReactNativeWebView.postMessage('AUTH_SUCCESS');
          } else if (text.indexOf('authorized') !== -1 && text.indexOf('auth') !== -1) {
            window.ReactNativeWebView.postMessage('AUTH_SUCCESS');
          }
        })();
        true;
      `
      webViewRef.current?.injectJavaScript(checkJs)
    }, 1000)
  }

  const handleNavigationStateChange = useCallback(async (navState: WebViewNavigation) => {
    const url = navState.url

    // 阶段一：检测登录成功，跳转授权页
    if (stageRef.current === 'init') {
      const isLoggedIn =
        (url.includes('last.fm/home') ||
          url.includes('last.fm/user/') ||
          url === 'https://www.last.fm/' ||
          url === 'https://last.fm/') &&
        !url.includes('/login') &&
        !url.includes('/join')

      if (isLoggedIn) {
        try {
          const tokenRes = await getToken(LASTFM_API_KEY, LASTFM_API_SECRET)
          if (tokenRes.error || !tokenRes.data?.token) {
            toast(`获取 Token 失败: ${tokenRes.message || '未知错误'}`)
            return
          }
          tokenRef.current = tokenRes.data.token
          const authUrl = getAuthUrl(LASTFM_API_KEY, tokenRes.data.token)
          stageRef.current = 'wait_auth'
          webViewRef.current?.injectJavaScript(`window.location.href = '${authUrl}';`)
        } catch (error: any) {
          toast(`授权失败: ${error.message}`)
        }
      }
      return
    }

    // 阶段二：检测到授权页面，开始轮询
    if (stageRef.current === 'wait_auth') {
      const isAuthPage = url.includes('/api/auth/') || url.includes('api/auth')
      if (isAuthPage) {
        startPolling()
      } else {
        clearPolling()
      }
    }
  }, [])

  const handleMessage = useCallback(async (event: any) => {
    const data: string = event.nativeEvent.data
    if (data !== 'AUTH_SUCCESS' || isGettingSessionRef.current) return

    const token = tokenRef.current
    if (!token) return

    clearPolling()
    isGettingSessionRef.current = true

    try {
      const sessionRes = await getSession(token, LASTFM_API_KEY, LASTFM_API_SECRET)
      if (sessionRes.error || !sessionRes.data?.session?.key) {
        toast(`授权失败: ${sessionRes.message || '请重试'}`)
        isGettingSessionRef.current = false
        return
      }
      const username = sessionRes.data.session.name || sessionRes.data.session.username || ''
      updateSetting({
        'common.lastfm_session_key': sessionRes.data.session.key,
        'common.lastfm_username': username,
      })
      stageRef.current = 'done'
      toast('Last.fm 授权成功！')
      handleClose()
    } catch (error: any) {
      toast(`授权失败: ${error.message}`)
      isGettingSessionRef.current = false
    }
  }, [handleClose])

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={styles.container}>
        <Header onClose={handleClose} />
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://www.last.fm/login' }}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
        />
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
    width: 40,
  },
})
