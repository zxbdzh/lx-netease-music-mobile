import { useEffect, useState } from 'react'
import state from './state'

export const useSongMemory = () => {
  const [localState, updateState] = useState({ ...state })

  useEffect(() => {
    const handleUpdate = () => updateState({ ...state })
    global.state_event.on('songMemoryStateChanged', handleUpdate)
    return () => {
      global.state_event.off('songMemoryStateChanged', handleUpdate)
    }
  }, [])

  return localState
}
