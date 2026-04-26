import { useEffect, useState } from 'react'
import state from './state'

export const useShareMusicCard = () => {
  const [localState, updateState] = useState({ ...state })

  useEffect(() => {
    const handleUpdate = () => updateState({ ...state })
    global.state_event.on('shareMusicCardStateChanged', handleUpdate)
    return () => {
      global.state_event.off('shareMusicCardStateChanged', handleUpdate)
    }
  }, [])

  return localState
}
