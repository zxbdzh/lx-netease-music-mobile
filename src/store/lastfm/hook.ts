import { useEffect, useState } from 'react'
import state from './state'

export const useLastfm = () => {
  const [localState, updateState] = useState({ ...state })

  useEffect(() => {
    const handleUpdate = () => updateState({ ...state })
    global.state_event.on('lastfmConfigChanged', handleUpdate)
    return () => {
      global.state_event.off('lastfmConfigChanged', handleUpdate)
    }
  }, [])

  return localState
}
