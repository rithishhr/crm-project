import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, CheckCircle, Shield, X, AlertCircle, RefreshCw } from 'lucide-react'
import * as faceapi from '@vladmandic/face-api'
import type { User } from '../../types'

interface Props {
  user: User
  mode?: 'enroll' | 'authenticate'
  onSuccess: (descriptor?: Float32Array) => void | Promise<void>
  onClose: () => void
}

type VerificationState = 'loading' | 'scanning' | 'processing' | 'success' | 'error'

export default function FaceIDModal({ user, mode = 'authenticate', onSuccess, onClose }: Props) {
  const [state, setState] = useState<VerificationState>('loading')
  const [status, setStatus] = useState('Loading AI Models...')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const detectionIntervalRef = useRef<number | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  const stopCamera = () => {
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        setModelsLoaded(true)
        setState('scanning')
        setStatus('Position your face in the frame')
        startVideo()
      } catch (err) {
        console.error('Error loading face-api models', err)
        setState('error')
        setError('Failed to load biometric models.')
      }
    }
    loadModels()

    return () => {
      stopCamera()
    }
  }, [])

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch((err) => {
        console.error(err)
        setState('error')
        setError('Camera access denied or unavailable.')
      })
  }

  const handleVideoOnPlay = () => {
    detectionIntervalRef.current = window.setInterval(async () => {
      if (videoRef.current && modelsLoaded && state === 'scanning') {
        const detection = await faceapi.detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor()
        
        if (detection) {
          stopCamera()
          setState('processing')
          setStatus(mode === 'enroll' ? 'Analyzing features...' : 'Verifying identity...')
          setProgress(70)

          try {
            await Promise.resolve(onSuccess(detection.descriptor))
            setState('success')
            setStatus(mode === 'enroll' ? 'Enrollment successful' : 'Face verified')
            setProgress(100)
          } catch {
            setState('error')
            setError('Face unrecognized. Access denied.')
            setStatus('Verification failed')
            setProgress(0)

            // Restart camera for retry after a short pause
            setTimeout(() => {
              setError('')
              setState('scanning')
              setStatus('Position your face in the frame')
              startVideo()
            }, 1200)
          }
        }
      }
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md relative rounded-3xl p-8 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={() => {
            stopCamera()
            onClose()
          }}
          className="absolute top-6 right-6 z-10 transition-colors hover:rotate-90 duration-200"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center relative z-0">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              {mode === 'enroll' ? 'Biometric Enrollment' : 'Biometric Verification'}
            </span>
          </div>

          {/* Face scan area */}
          <div className="relative w-56 h-56 mx-auto mb-8">
            {/* Camera Preview */}
            <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-dashed border-gray-700">
               <video 
                ref={videoRef}
                autoPlay
                muted
                onPlay={handleVideoOnPlay}
                className={`w-full h-full object-cover transition-opacity duration-500 ${state === 'scanning' ? 'opacity-100' : 'opacity-40'}`}
              />
            </div>

            {/* Scanning Overlay */}
            <div className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--border)' }} />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${state === 'error' ? '#ef4444' : 'var(--accent)'}` }}
              animate={state === 'scanning' ? { opacity: [0.3, 1, 0.3], scale: [0.98, 1, 0.98] } : { opacity: 1 }}
              transition={{ duration: 2, repeat: state === 'scanning' ? Infinity : 0 }}
            />

            {/* Scan line */}
            {state === 'scanning' && (
              <motion.div
                className="absolute left-8 right-8 h-1 rounded-full z-10"
                style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
                animate={{ top: ['20%', '80%', '20%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* Success/Processing Icons */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <AnimatePresence mode="wait">
                {state === 'success' && (
                  <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                    <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center backdrop-blur-md border border-teal-500/30">
                      <CheckCircle className="w-12 h-12 text-teal-400" />
                    </div>
                  </motion.div>
                )}
                {state === 'loading' && (
                  <motion.div key="loading" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                    <RefreshCw className="w-12 h-12 text-teal-500/50" />
                  </motion.div>
                )}
                {state === 'error' && (
                   <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <AlertCircle className="w-12 h-12 text-red-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={state} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 h-12">
              {state === 'error' ? (
                <p className="text-red-400 font-medium">{error}</p>
              ) : (
                <>
                  <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{status}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {state === 'scanning' && 'Hold still and look directly at the camera'}
                    {state === 'processing' && (mode === 'enroll' ? 'Extracting unique facial features...' : 'Checking secure face match...')}
                    {state === 'success' && (mode === 'enroll' ? 'Biometric data encrypted and stored' : 'Access granted')}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Progress */}
          <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <motion.div className="h-full rounded-full transition-all duration-500" 
              style={{ 
                width: `${progress || (state === 'scanning' ? 30 : 0)}%`, 
                backgroundColor: state === 'error' ? '#ef4444' : 'var(--accent)' 
              }} 
            />
          </div>

          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40" style={{ color: 'var(--text-placeholder)' }}>
            End-to-End Encrypted · 128D Vectorization
          </p>
        </div>
      </motion.div>
    </div>
  )
}