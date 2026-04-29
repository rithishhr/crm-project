import { useEffect, useRef, useState } from 'react'
import * as faceapi from '@vladmandic/face-api'
import { Camera, RefreshCw } from 'lucide-react'

interface Props {
  onFaceDetected: (descriptor: Float32Array) => void;
  onCancel: () => void;
}

export default function FaceAuth({ onFaceDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [status, setStatus] = useState('Loading AI Models...')

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        setModelsLoaded(true)
        setStatus('Starting camera...')
        startVideo()
      } catch (err) {
        console.error('Error loading face-api models', err)
        setStatus('Error loading models.')
      }
    }
    loadModels()

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStatus('Position your face in the camera')
        }
      })
      .catch((err) => {
        console.error(err)
        setStatus('Camera access denied or unavailable.')
      })
  }

  const handleVideoOnPlay = () => {
    setIsDetecting(true)
    const interval = setInterval(async () => {
      if (videoRef.current && modelsLoaded) {
        const detection = await faceapi.detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor()
        
        if (detection) {
          clearInterval(interval)
          setStatus('Face detected! Verifying...')
          setIsDetecting(false)
          
          // Stop camera
          if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream
            stream.getTracks().forEach(track => track.stop())
          }
          
          // Send descriptor back
          onFaceDetected(detection.descriptor)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-64 h-64 bg-gray-900 rounded-full overflow-hidden border-4 border-teal-500 shadow-xl flex items-center justify-center">
        {!modelsLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 bg-black bg-opacity-50">
            <RefreshCw className="w-8 h-8 animate-spin mb-2" />
          </div>
        )}
        <video 
          ref={videoRef}
          autoPlay
          muted
          onPlay={handleVideoOnPlay}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 border-4 border-dashed border-teal-400 rounded-full opacity-50 animate-pulse"></div>
      </div>
      <p className="text-sm font-medium text-gray-400">{status}</p>
      
      <button 
        onClick={onCancel}
        className="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Cancel Face Login
      </button>
    </div>
  )
}
