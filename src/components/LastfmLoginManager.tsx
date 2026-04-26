import { useEffect, useRef, useState } from 'react'
import LastfmLoginModal, { type LastfmLoginModalType } from './LastfmLoginModal'

export default () => {
  const [visible, setVisible] = useState(false)
  const modalRef = useRef<LastfmLoginModalType>(null)

  useEffect(() => {
    const handleShow = () => {
      setVisible(true)
      requestAnimationFrame(() => {
        modalRef.current?.show()
      })
    }
    global.app_event.on('showLastfmLogin', handleShow)
    return () => {
      global.app_event.off('showLastfmLogin', handleShow)
    }
  }, [])

  return visible ? <LastfmLoginModal ref={modalRef} /> : null
}
