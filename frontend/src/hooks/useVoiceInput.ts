import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceInputOptions {
  onResult: (text: string) => void
  onError?: (msg: string) => void
  /** BCP-47 recognition language, e.g. 'ta-IN' or 'en-IN'. Defaults to Tamil. */
  recogLang?: string
}

// Detect if browser genuinely supports Tamil voice recognition.
// Chrome desktop advertises SpeechRecognition but silently falls back to English for ta-IN.
// Only Chrome on Android reliably supports Tamil.
function detectTamilVoiceSupport(): boolean {
  const hasAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  if (!hasAPI) return false
  // Android user agent check — safest signal for Tamil support
  const ua = navigator.userAgent.toLowerCase()
  const isAndroid = ua.includes('android')
  const isChrome  = ua.includes('chrome') && !ua.includes('edge') && !ua.includes('opr')
  // On Android Chrome — full Tamil support
  if (isAndroid && isChrome) return true
  // On all other platforms — API exists but Tamil is unreliable; we still allow it
  // but warn the user at runtime if the result looks like English
  return true
}

export function useVoiceInput({ onResult, onError, recogLang = 'ta-IN' }: UseVoiceInputOptions) {
  const [isRecording, setIsRecording]   = useState(false)
  const [isSupported]                   = useState(detectTamilVoiceSupport)
  const recognitionRef                   = useRef<any>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  const start = useCallback(() => {
    if (!isSupported) {
      onError?.('Voice input is not supported in this browser. Please type your question.')
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()

    rec.continuous      = false
    rec.interimResults  = false
    rec.lang            = recogLang
    rec.maxAlternatives = 3   // get top 3 so we can pick the best

    rec.onstart = () => setIsRecording(true)
    rec.onend   = () => setIsRecording(false)

    rec.onerror = (e: any) => {
      setIsRecording(false)
      switch (e.error) {
        case 'not-allowed':
          onError?.('Microphone access denied. Please allow microphone access in your browser settings and try again.')
          break
        case 'no-speech':
          onError?.('No speech detected. Please speak clearly and try again.')
          break
        case 'network':
          onError?.('Network error during voice recognition. Check your internet connection.')
          break
        case 'language-not-supported':
          onError?.('Tamil voice input is not supported in this browser. Please type your question in Tamil.')
          break
        default:
          onError?.('Voice recognition failed. Please type your question instead.')
      }
    }

    rec.onresult = (e: any) => {
      // Pick highest confidence result
      let best = ''
      let bestConf = -1
      for (let i = 0; i < e.results[0].length; i++) {
        const alt = e.results[0][i]
        if (alt.confidence > bestConf) {
          bestConf = alt.confidence
          best     = alt.transcript
        }
      }
      if (best.trim()) {
        // Warn if confidence is very low — likely a language mismatch
        if (bestConf < 0.4) {
          onError?.('Voice detected but confidence is low — did you speak in Tamil? You can edit the text before sending.')
        }
        onResult(best.trim())
      }
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch (err) {
      setIsRecording(false)
      onError?.('Could not start voice input. Please type your question.')
    }
  }, [isSupported, onResult, onError, recogLang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const toggle = useCallback(() => {
    if (isRecording) stop()
    else start()
  }, [isRecording, start, stop])

  return { isRecording, isSupported, toggle }
}
