import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LiveKitRoom, RoomAudioRenderer, useLocalParticipant,
  useRoomContext, useTracks, useParticipants, VideoTrack,
  useSpeakingParticipants
} from '@livekit/components-react'
import { Track, RoomEvent } from 'livekit-client'
import {
  Accessibility, BookOpen, Captions, Check, ChevronDown, Copy, DoorOpen,
  Hand, MessageSquare, Mic, MicOff, MonitorUp, PenTool, Send, Settings2, Sparkles,
  Users, Video, VideoOff, PhoneOff, X, Type, Eye, HelpCircle, Languages, Camera,
  ScanFace, Info, Volume2, Maximize2, Search, Sliders
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL ?? (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : ''
)
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || ''

type Role = 'teacher' | 'student'
type ChatItem = { id: string; sender: string; role: string; text: string; time?: string; kind: 'chat' | 'student' | 'draw' }
type CaptionItem = { id: number; raw: string; text: string; time: string; speaker?: string; changed: boolean }

const STEM_DICTIONARY: Record<string, { definition: string; formula?: string; subject: string }> = {
  "newton's second law": { definition: "The net force on an object is equal to the mass of the object multiplied by its acceleration.", formula: "F = m · a", subject: "Physics" },
  "photosynthesis": { definition: "Process by which green plants and certain organisms use sunlight to synthesize nutrients from carbon dioxide and water.", formula: "6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂", subject: "Biology" },
  "mitochondria": { definition: "Organelles in eukaryotic cells generating most of the chemical energy needed to power biochemical reactions (ATP).", formula: "ATP synthesis", subject: "Biology" },
  "derivative": { definition: "Measures the instantaneous rate of change of a function with respect to one of its variables.", formula: "f'(x) = lim(h→0) [f(x+h) - f(x)] / h", subject: "Mathematics" },
  "integral": { definition: "Assigns numbers to functions in a way that describes displacement, area, volume, and other concepts arising by combining infinitesimal data.", formula: "∫ f(x) dx", subject: "Mathematics" },
  "eigenvalue": { definition: "A scalar associated with a linear system of equations (Ax = λx) that scales eigenvectors during transformation.", formula: "A v = λ v", subject: "Mathematics" },
  "algorithm": { definition: "A finite sequence of rigorous, unambiguous instructions, typically used to solve a class of specific problems or perform a computation.", subject: "Computer Science" },
  "quadratic equation": { definition: "A second-order polynomial equation in a single variable x with a non-zero leading coefficient.", formula: "x = [-b ± √(b² - 4ac)] / (2a)", subject: "Mathematics" },
  "ohm's law": { definition: "The current through a conductor between two points is directly proportional to the voltage across the two points.", formula: "V = I · R", subject: "Physics" },
  "sql": { definition: "Structured Query Language: a domain-specific language used in programming and designed for managing data in relational databases.", subject: "Computer Science" },
  "neural network": { definition: "A computational model inspired by the structure of biological neural networks, consisting of interconnected nodes (neurons).", formula: "y = σ(W · x + b)", subject: "AI & ML" },
  "kinetic energy": { definition: "The energy an object possesses due to its motion, defined as the work needed to accelerate a body of a given mass from rest.", formula: "KE = ½ m v²", subject: "Physics" },
  "gravitational force": { definition: "Attractive force existing between any two masses, directly proportional to the product of their masses.", formula: "F = G (m₁ m₂) / r²", subject: "Physics" },
  "cell membrane": { definition: "Biological membrane that separates and protects the interior of all cells from the outside environment.", subject: "Biology" },
  "machine learning": { definition: "A branch of artificial intelligence focused on building applications that learn from data and improve accuracy over time.", subject: "AI & ML" },
  "artificial intelligence": { definition: "The simulation of human intelligence processes by machines, especially computer systems.", subject: "AI & ML" },
}

function randomRoom() {
  return 'stem-' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6)
}

function getAvatarColor(name: string) {
  const colors = ['#1a73e8', '#9c27b0', '#00897b', '#e65100', '#3949ab', '#d81b60', '#5e35b1', '#039be5']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function App() {
  const [name, setName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState(LK_URL)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function enterRoom(room: string) {
    setError('')
    if (!name.trim()) return setError('Please enter your display name to join.')
    if (!room.trim()) return setError('Please enter or generate a meeting code.')
    setBusy(true)
    try {
      const response = await fetch(`${API}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, identity: name.trim(), role })
      })
      let data: any = {}
      try {
        data = await response.json()
      } catch {
        const text = await response.text().catch(() => '')
        data = { message: text }
      }
      if (!response.ok) {
        const errorMsg = data.detail || data.errorMessage || data.message || data.error || (typeof data === 'string' ? data : null) || `Server error (${response.status})`
        throw new Error(errorMsg)
      }
      const targetServerUrl = data.serverUrl || LK_URL
      if (!targetServerUrl) {
        throw new Error('LiveKit server URL was not provided. Please set LIVEKIT_URL.')
      }
      setToken(data.token)
      setServerUrl(targetServerUrl)
      setRoomName(data.room)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to connect to the meeting.'
      setError(
        msg === 'Failed to fetch'
          ? 'Could not connect to the backend API. Please verify server status or Netlify configuration.'
          : msg
      )
    } finally {
      setBusy(false)
    }
  }

  if (token) {
    return (
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={serverUrl}
        connect
        onDisconnected={() => setToken('')}
        data-lk-theme="default"
        className="gmeet-root"
      >
        <RoomAudioRenderer />
        <MeetingRoom name={name} role={role} roomName={roomName} onLeave={() => setToken('')} />
      </LiveKitRoom>
    )
  }

  return (
    <main className="gmeet-landing">
      <header className="gmeet-landing-header">
        <div className="gmeet-brand">
          <div className="gmeet-brand-icon"><Accessibility size={24} /></div>
          <span className="gmeet-brand-text">Access<b>Class</b></span>
          <span className="gmeet-tag">STEM Classroom</span>
        </div>
        <div className="gmeet-header-meta">
          <span className="gmeet-badge-secure"><Sparkles size={14} /> AI-Powered Accessibility</span>
        </div>
      </header>

      <section className="gmeet-landing-hero">
        <div className="gmeet-hero-left">
          <h1>Inclusive video meetings for STEM classrooms.</h1>
          <p className="gmeet-hero-sub">
            Real-time context-aware speech captioning, bidirectional sign language translation, mathematical formula rendering, and personalized visual displays designed for speech & hearing-impaired learners.
          </p>

          <div className="gmeet-action-box">
            <div className="gmeet-input-row">
              <input
                className="gmeet-input-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={60}
              />
              <div className="gmeet-role-toggle">
                <button
                  type="button"
                  className={role === 'student' ? 'gmeet-role-btn active' : 'gmeet-role-btn'}
                  onClick={() => setRole('student')}
                >
                  <Users size={15} /> Student
                </button>
                <button
                  type="button"
                  className={role === 'teacher' ? 'gmeet-role-btn active' : 'gmeet-role-btn'}
                  onClick={() => setRole('teacher')}
                >
                  <BookOpen size={15} /> Teacher
                </button>
              </div>
            </div>

            <div className="gmeet-join-actions">
              <button
                className="gmeet-btn-new-meeting"
                disabled={busy}
                onClick={() => { const r = randomRoom(); setRoomName(r); void enterRoom(r) }}
              >
                <Video size={18} />
                <span>{busy ? 'Connecting…' : 'New meeting'}</span>
              </button>

              <div className="gmeet-code-join">
                <input
                  className="gmeet-input-code"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="Enter a code or link"
                />
                <button
                  className="gmeet-btn-join"
                  disabled={busy || !roomName.trim()}
                  onClick={() => enterRoom(roomName)}
                >
                  Join
                </button>
              </div>
            </div>

            {error && <div className="gmeet-alert-error" role="alert">{error}</div>}
          </div>

          <div className="gmeet-feature-strip">
            <div className="gmeet-feature-item"><Captions size={18} /><span>Contextual Captions</span></div>
            <div className="gmeet-feature-item"><Languages size={18} /><span>Sign Language Bridge</span></div>
            <div className="gmeet-feature-item"><PenTool size={18} /><span>Shared Math Canvas</span></div>
            <div className="gmeet-feature-item"><Eye size={18} /><span>High-Contrast & Dyslexia UI</span></div>
          </div>
        </div>

        <div className="gmeet-hero-right">
          <div className="gmeet-preview-card">
            <div className="gmeet-preview-screen">
              <div className="gmeet-preview-video">
                <div className="gmeet-preview-avatar">
                  {name ? name.slice(0, 1).toUpperCase() : 'A'}
                </div>
                <div className="gmeet-preview-tag">{name || 'Your video'}</div>
              </div>
              <div className="gmeet-preview-caption-sample">
                <span className="caption-speaker">Teacher:</span> In this equation, <b>photosynthesis</b> converts light energy into chemical bonds.
              </div>
            </div>
            <div className="gmeet-preview-footer">
              <span>Ready to teach and learn with accessibility</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function MeetingRoom({ name, role, roomName, onLeave }: { name: string; role: Role; roomName: string; onLeave: () => void }) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const speakingParticipants = useSpeakingParticipants()
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false })

  const [activeSideDrawer, setActiveSideDrawer] = useState<'chat' | 'people' | 'accessibility' | 'signs' | 'board' | null>(null)
  const [chat, setChat] = useState<ChatItem[]>([])
  const [message, setMessage] = useState('')
  const [captionItems, setCaptionItems] = useState<CaptionItem[]>([])
  const [captionEnabled, setCaptionEnabled] = useState(true)
  const [listening, setListening] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({})

  // Accessibility / Personalization Settings
  const [fontSize, setFontSize] = useState(18)
  const [highContrast, setHighContrast] = useState(false)
  const [dyslexicFont, setDyslexicFont] = useState(false)
  const [subject, setSubject] = useState('general')
  const [readingMode, setReadingMode] = useState<'verbatim' | 'stem-focus'>('stem-focus')

  // Sign Language State
  const [signLanguage, setSignLanguage] = useState<'ISL' | 'ASL'>('ISL')
  const [signDirection, setSignDirection] = useState<'student-to-teacher' | 'teacher-to-student'>('student-to-teacher')
  const [signText, setSignText] = useState('')
  const [signStatus, setSignStatus] = useState('Sign camera standby.')
  const signVideoRef = useRef<HTMLVideoElement>(null)
  const signStreamRef = useRef<MediaStream | null>(null)

  // Interactive STEM Glossary Tooltip Card
  const [selectedGlossaryTerm, setSelectedGlossaryTerm] = useState<{ term: string; data: typeof STEM_DICTIONARY[string] } | null>(null)

  // Whiteboard Canvas
  const [drawing, setDrawing] = useState(false)
  const [brushColor, setBrushColor] = useState('#8ab4f8')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Live Clock
  const [currentTime, setCurrentTime] = useState('')
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const recognitionRef = useRef<any>(null)
  const captionId = useRef(0)

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // WebRTC LiveKit Data Packets
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        if (data.type === 'classroom-message') {
          setChat(prev => [...prev.slice(-99), { ...data.item, id: data.item.id || crypto.randomUUID() }])
        } else if (data.type === 'caption') {
          setCaptionItems(prev => [...prev.slice(-79), data.item])
        } else if (data.type === 'hand-raise') {
          setRaisedHands(prev => ({ ...prev, [data.sender]: data.raised }))
        } else if (data.type === 'board') {
          drawRemote(data.x, data.y, data.color, data.start)
        }
      } catch { /* Ignore malformed packets */ }
    }
    room.on(RoomEvent.DataReceived, handleData)
    return () => { room.off(RoomEvent.DataReceived, handleData) }
  }, [room])

  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch {}
    signStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  function sendPacket(data: unknown) {
    if (room.state !== 'connected') return
    const bytes = new TextEncoder().encode(JSON.stringify(data))
    void localParticipant.publishData(bytes, { reliable: true, topic: 'accessclass' })
  }

  function toggleHandRaise() {
    const next = !handRaised
    setHandRaised(next)
    setRaisedHands(prev => ({ ...prev, [name]: next }))
    sendPacket({ type: 'hand-raise', sender: name, raised: next })
  }

  function sendMessage(kind: ChatItem['kind'] = 'chat') {
    const text = message.trim()
    if (!text) return
    const item: ChatItem = {
      id: crypto.randomUUID(),
      sender: name,
      role,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      kind
    }
    setChat(prev => [...prev, item])
    sendPacket({ type: 'classroom-message', item })
    setMessage('')
  }

  async function processCaption(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    let processed = trimmed
    let changed = false
    try {
      const res = await fetch(`${API}/api/captions/contextualize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, subject })
      })
      if (res.ok) {
        const result = await res.json()
        processed = result.caption || trimmed
        changed = processed !== trimmed
      }
    } catch { /* fallback to raw */ }

    const item: CaptionItem = {
      id: ++captionId.current,
      raw: trimmed,
      text: processed,
      speaker: name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      changed
    }
    setCaptionItems(prev => [...prev.slice(-79), item])
    sendPacket({ type: 'caption', item })
  }

  function toggleRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setNotice('Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.')
      return
    }
    if (listening) {
      try { recognitionRef.current?.stop() } catch {}
      setListening(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onstart = () => { setListening(true); setNotice('') }
    recognition.onerror = (e: any) => {
      setNotice(`Speech recognition error: ${e.error}.`)
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognition.onresult = (e: any) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
      }
      if (finalText.trim()) void processCaption(finalText)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setNotice('Could not start microphone captioning.')
      setListening(false)
    }
  }

  // Camera sign bridge
  async function startSignCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSignStatus('Camera access requires HTTPS or localhost.')
      return
    }
    try {
      signStreamRef.current?.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      signStreamRef.current = stream
      if (signVideoRef.current) {
        signVideoRef.current.srcObject = stream
        await signVideoRef.current.play()
      }
      setSignStatus('Camera active. MediaPipe pipeline ready for gesture recognition.')
    } catch {
      setSignStatus('Camera permission denied or camera in use by another app.')
    }
  }

  function stopSignCamera() {
    signStreamRef.current?.getTracks().forEach(t => t.stop())
    signStreamRef.current = null
    if (signVideoRef.current) signVideoRef.current.srcObject = null
    setSignStatus('Sign camera stopped.')
  }

  function sendRecognizedSign() {
    const text = signText.trim()
    if (!text) return
    const item: ChatItem = {
      id: crypto.randomUUID(),
      sender: name,
      role,
      text: `[${signLanguage} Sign → Text] ${text}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      kind: 'student'
    }
    setChat(prev => [...prev, item])
    sendPacket({ type: 'classroom-message', item })
    setSignText('')
    setSignStatus(`Sent sign translation: "${text}"`)
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(roomName)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setNotice(`Meeting code: ${roomName}`)
    }
  }

  // Drawing Whiteboard functions
  function pointerPosition(e: any) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)
    }
  }
  function startDraw(e: any) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const p = pointerPosition(e)
    ctx.strokeStyle = brushColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    setDrawing(true)
    sendPacket({ type: 'board', x: p.x, y: p.y, color: brushColor, start: true })
  }
  function moveDraw(e: any) {
    if (!drawing || !canvasRef.current) return
    const p = pointerPosition(e)
    const ctx = canvasRef.current.getContext('2d')!
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    sendPacket({ type: 'board', x: p.x, y: p.y, color: brushColor, start: false })
  }
  function drawRemote(x: number, y: number, color: string, start: boolean) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = color || '#8ab4f8'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    if (start) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }
  function clearBoard() {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    sendPacket({
      type: 'classroom-message',
      item: { id: crypto.randomUUID(), sender: 'System', role: 'system', text: 'The shared board was cleared.', kind: 'draw' }
    })
  }

  // Interactive STEM Term Highlighting
  function renderCaptionWithTerms(text: string) {
    const lower = text.toLowerCase()
    const matches: { term: string; start: number; end: number; data: typeof STEM_DICTIONARY[string] }[] = []

    for (const [key, val] of Object.entries(STEM_DICTIONARY)) {
      let idx = lower.indexOf(key)
      while (idx !== -1) {
        matches.push({ term: key, start: idx, end: idx + key.length, data: val })
        idx = lower.indexOf(key, idx + key.length)
      }
    }

    if (matches.length === 0) return <span>{text}</span>

    matches.sort((a, b) => a.start - b.start)
    const elements: (string | JSX.Element)[] = []
    let lastIndex = 0

    matches.forEach((m, i) => {
      if (m.start >= lastIndex) {
        if (m.start > lastIndex) {
          elements.push(text.slice(lastIndex, m.start))
        }
        const matchedWord = text.slice(m.start, m.end)
        elements.push(
          <button
            key={`term-${i}`}
            type="button"
            className="gmeet-stem-term-pill"
            title={`Click for ${m.data.subject} formula & definition`}
            onClick={() => setSelectedGlossaryTerm({ term: matchedWord, data: m.data })}
          >
            {matchedWord}
          </button>
        )
        lastIndex = m.end
      }
    })
    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex))
    }
    return <>{elements}</>
  }

  const latestCaptions = captionItems.slice(-2)

  return (
    <div className={`gmeet-room ${highContrast ? 'contrast-mode' : ''} ${dyslexicFont ? 'dyslexic-mode' : ''}`}>
      {/* Top Floating App Bar */}
      <header className="gmeet-topbar">
        <div className="gmeet-topbar-left">
          <div className="gmeet-topbar-brand">
            <Accessibility size={20} className="gmeet-accent-icon" />
            <span>AccessClass</span>
          </div>
          <span className="gmeet-topbar-divider">•</span>
          <span className="gmeet-topbar-subject">{subject.toUpperCase()} CLASSROOM</span>
        </div>

        <div className="gmeet-topbar-center">
          {handRaised && (
            <div className="gmeet-raised-indicator">
              <Hand size={15} /> <span>Your hand is raised</span>
            </div>
          )}
        </div>

        <div className="gmeet-topbar-right">
          <div className="gmeet-user-chip" title={`${name} (${role})`}>
            <span className="gmeet-avatar-mini" style={{ backgroundColor: getAvatarColor(name) }}>
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="gmeet-user-name">{name}</span>
            <span className="gmeet-role-pill">{role}</span>
          </div>
        </div>
      </header>

      {/* Main Video Stage & Side Drawer Area */}
      <main className="gmeet-main">
        <section className="gmeet-stage-area">
          {/* Responsive Participant Video Tiles */}
          <div className={`gmeet-grid count-${Math.min(cameraTracks.length || 1, 4)}`}>
            {cameraTracks.length > 0 ? (
              cameraTracks.map(track => {
                const participant = track.participant
                const isSpeaking = speakingParticipants.includes(participant)
                const isLocal = participant.isLocal
                const isHandRaised = raisedHands[participant.name || participant.identity]
                return (
                  <div key={track.publication.trackSid} className={`gmeet-tile ${isSpeaking ? 'speaking' : ''}`}>
                    <VideoTrack trackRef={track} className="gmeet-video-track" />
                    <div className="gmeet-tile-footer">
                      <span className="gmeet-tile-name">
                        {isSpeaking ? <Volume2 size={14} className="speaking-icon" /> : null}
                        {participant.name || participant.identity} {isLocal ? '(You)' : ''}
                      </span>
                      {isHandRaised && (
                        <span className="gmeet-hand-badge" title="Hand raised">
                          <Hand size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              /* Single Fallback Tile when no other tracks exist (e.g. initial connection) */
              <div className="gmeet-tile single-user">
                <div className="gmeet-avatar-placeholder" style={{ backgroundColor: getAvatarColor(name) }}>
                  {name.slice(0, 1).toUpperCase()}
                </div>
                <div className="gmeet-tile-footer">
                  <span className="gmeet-tile-name">{name} (You)</span>
                  {handRaised && (
                    <span className="gmeet-hand-badge" title="Hand raised">
                      <Hand size={14} />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floating Google Meet Subtitles Overlay */}
          {captionEnabled && (
            <div className="gmeet-captions-overlay">
              <div className="gmeet-captions-inner" style={{ fontSize: `${fontSize}px` }}>
                {latestCaptions.length > 0 ? (
                  latestCaptions.map(c => (
                    <div key={c.id} className="gmeet-caption-line">
                      <span className="gmeet-caption-speaker">{c.speaker || 'Speaker'}:</span>{' '}
                      <span className="gmeet-caption-text">{renderCaptionWithTerms(c.text)}</span>
                    </div>
                  ))
                ) : (
                  <div className="gmeet-caption-idle">
                    {listening ? 'Listening for speech… captions will appear here.' : 'Captions on • Turn on speech recognition to transcribe.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interactive STEM Glossary Popover Card */}
          {selectedGlossaryTerm && (
            <div className="gmeet-glossary-card">
              <div className="gmeet-glossary-header">
                <div className="gmeet-glossary-title">
                  <Sparkles size={16} />
                  <span>{selectedGlossaryTerm.term}</span>
                  <small>{selectedGlossaryTerm.data.subject}</small>
                </div>
                <button
                  type="button"
                  className="gmeet-icon-close"
                  onClick={() => setSelectedGlossaryTerm(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <p className="gmeet-glossary-body">{selectedGlossaryTerm.data.definition}</p>
              {selectedGlossaryTerm.data.formula && (
                <div className="gmeet-glossary-formula">
                  <span>Formula / Expression:</span>
                  <code>{selectedGlossaryTerm.data.formula}</code>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Google Meet Right-Side Drawer */}
        {activeSideDrawer && (
          <aside className="gmeet-drawer">
            <div className="gmeet-drawer-header">
              <h3>
                {activeSideDrawer === 'chat' && 'In-call messages'}
                {activeSideDrawer === 'people' && `People (${participants.length || 1})`}
                {activeSideDrawer === 'accessibility' && 'Caption & Accessibility Settings'}
                {activeSideDrawer === 'signs' && 'Sign Language Bridge'}
                {activeSideDrawer === 'board' && 'Shared Math & Science Board'}
              </h3>
              <button
                type="button"
                className="gmeet-drawer-close"
                onClick={() => setActiveSideDrawer(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Drawer Tab Switcher */}
            <div className="gmeet-drawer-tabs">
              <button
                type="button"
                className={activeSideDrawer === 'chat' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('chat')}
                title="Chat"
              >
                <MessageSquare size={16} />
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'people' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('people')}
                title="People"
              >
                <Users size={16} />
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'accessibility' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('accessibility')}
                title="Accessibility & Transcript"
              >
                <Captions size={16} />
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'signs' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('signs')}
                title="Sign Language"
              >
                <Languages size={16} />
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'board' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('board')}
                title="Whiteboard"
              >
                <PenTool size={16} />
              </button>
            </div>

            <div className="gmeet-drawer-content">
              {/* CHAT DRAWER */}
              {activeSideDrawer === 'chat' && (
                <div className="gmeet-chat-view">
                  <div className="gmeet-chat-history">
                    {chat.length === 0 ? (
                      <div className="gmeet-empty-chat">
                        <MessageSquare size={36} />
                        <p>Messages can only be seen by people in the call and are deleted when the call ends.</p>
                      </div>
                    ) : (
                      chat.map(item => (
                        <div key={item.id} className={`gmeet-chat-bubble ${item.sender === name ? 'own' : ''}`}>
                          <div className="gmeet-chat-meta">
                            <b>{item.sender}</b>
                            <span>{item.time || ''}</span>
                            <span className="gmeet-chat-role">{item.role}</span>
                          </div>
                          <div className="gmeet-chat-text">{item.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    className="gmeet-chat-input-bar"
                    onSubmit={e => { e.preventDefault(); sendMessage() }}
                  >
                    <input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Send a message to everyone"
                    />
                    <button type="submit" disabled={!message.trim()}><Send size={16} /></button>
                  </form>
                  <button
                    type="button"
                    className="gmeet-btn-quick-question"
                    onClick={() => { setMessage('I have a question about this equation/concept: ') }}
                  >
                    <Hand size={14} /> Quick Question Prompt
                  </button>
                </div>
              )}

              {/* PEOPLE DRAWER */}
              {activeSideDrawer === 'people' && (
                <div className="gmeet-people-view">
                  <div className="gmeet-people-list">
                    <div className="gmeet-person-row">
                      <div className="gmeet-person-info">
                        <span className="gmeet-avatar-mini" style={{ backgroundColor: getAvatarColor(name) }}>
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <b>{name} (You)</b>
                          <small>{role}</small>
                        </div>
                      </div>
                      <div className="gmeet-person-icons">
                        {handRaised && <Hand size={15} className="gmeet-yellow-icon" />}
                        {localParticipant.isMicrophoneEnabled ? <Mic size={15} /> : <MicOff size={15} className="gmeet-red-icon" />}
                        {localParticipant.isCameraEnabled ? <Video size={15} /> : <VideoOff size={15} className="gmeet-red-icon" />}
                      </div>
                    </div>

                    {participants.filter(p => !p.isLocal).map(p => (
                      <div key={p.sid} className="gmeet-person-row">
                        <div className="gmeet-person-info">
                          <span className="gmeet-avatar-mini" style={{ backgroundColor: getAvatarColor(p.name || p.identity) }}>
                            {(p.name || p.identity).slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <b>{p.name || p.identity}</b>
                            <small>Participant</small>
                          </div>
                        </div>
                        <div className="gmeet-person-icons">
                          {raisedHands[p.name || p.identity] && <Hand size={15} className="gmeet-yellow-icon" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACCESSIBILITY & CAPTIONS DRAWER */}
              {activeSideDrawer === 'accessibility' && (
                <div className="gmeet-accessibility-view">
                  <div className="gmeet-setting-group">
                    <label>Live Captioning Engine</label>
                    <button
                      type="button"
                      className={listening ? 'gmeet-btn-toggle active' : 'gmeet-btn-toggle'}
                      onClick={toggleRecognition}
                    >
                      <Mic size={16} />
                      <span>{listening ? 'Stop speech recognition' : 'Start microphone speech recognition'}</span>
                    </button>
                    {notice && <p className="gmeet-hint-text alert">{notice}</p>}
                  </div>

                  <div className="gmeet-setting-group">
                    <div className="gmeet-setting-label-row">
                      <span><Type size={16} /> Caption Font Size</span>
                      <b>{fontSize}px</b>
                    </div>
                    <input
                      type="range"
                      min="14"
                      max="32"
                      value={fontSize}
                      onChange={e => setFontSize(Number(e.target.value))}
                      className="gmeet-slider"
                    />
                    <div className="gmeet-slider-ticks"><span>Standard (14px)</span><span>Large (32px)</span></div>
                  </div>

                  <div className="gmeet-setting-group">
                    <label>Visual Accessibility Themes</label>
                    <div className="gmeet-theme-row">
                      <button
                        type="button"
                        className={!highContrast ? 'gmeet-theme-chip active' : 'gmeet-theme-chip'}
                        onClick={() => setHighContrast(false)}
                      >
                        Default Dark
                      </button>
                      <button
                        type="button"
                        className={highContrast ? 'gmeet-theme-chip active' : 'gmeet-theme-chip'}
                        onClick={() => setHighContrast(true)}
                      >
                        High-Contrast Yellow
                      </button>
                    </div>
                  </div>

                  <div className="gmeet-setting-group">
                    <label>Reading & Typography</label>
                    <button
                      type="button"
                      className={dyslexicFont ? 'gmeet-checkbox-btn checked' : 'gmeet-checkbox-btn'}
                      onClick={() => setDyslexicFont(!dyslexicFont)}
                    >
                      <Check size={14} className="checkbox-tick" />
                      <span>Enable Dyslexia-Friendly Font (OpenDyslexic)</span>
                    </button>
                  </div>

                  <div className="gmeet-setting-group">
                    <label>STEM Subject Lexicon</label>
                    <select
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="gmeet-select"
                    >
                      <option value="general">General Science</option>
                      <option value="maths">Mathematics & Calculus</option>
                      <option value="physics">Physics & Mechanics</option>
                      <option value="chemistry">Chemistry & Organic</option>
                      <option value="biology">Biology & Life Sciences</option>
                      <option value="computer_science">Computer Science & Algorithms</option>
                    </select>
                  </div>

                  {/* Complete Transcript History */}
                  <div className="gmeet-transcript-section">
                    <h4>Session Transcript ({captionItems.length})</h4>
                    <div className="gmeet-transcript-feed">
                      {captionItems.length === 0 ? (
                        <p className="gmeet-empty-note">Live captions will be recorded here for review.</p>
                      ) : (
                        captionItems.map(c => (
                          <div key={c.id} className="gmeet-transcript-row">
                            <span className="transcript-time">{c.time}</span>
                            <span className="transcript-speaker">{c.speaker}:</span>
                            <span className="transcript-body">{c.text}</span>
                            {c.changed && <span className="transcript-tag">STEM Context Applied</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SIGN LANGUAGE DRAWER */}
              {activeSideDrawer === 'signs' && (
                <div className="gmeet-signs-view">
                  <div className="gmeet-setting-group">
                    <label>Sign Language Standard</label>
                    <div className="gmeet-pill-selector">
                      <button
                        type="button"
                        className={signLanguage === 'ISL' ? 'active' : ''}
                        onClick={() => setSignLanguage('ISL')}
                      >
                        Indian Sign Language (ISL)
                      </button>
                      <button
                        type="button"
                        className={signLanguage === 'ASL' ? 'active' : ''}
                        onClick={() => setSignLanguage('ASL')}
                      >
                        American Sign Language (ASL)
                      </button>
                    </div>
                  </div>

                  <div className="gmeet-setting-group">
                    <label>Recognition Direction</label>
                    <div className="gmeet-pill-selector">
                      <button
                        type="button"
                        className={signDirection === 'student-to-teacher' ? 'active' : ''}
                        onClick={() => setSignDirection('student-to-teacher')}
                      >
                        Student → Teacher
                      </button>
                      <button
                        type="button"
                        className={signDirection === 'teacher-to-student' ? 'active' : ''}
                        onClick={() => setSignDirection('teacher-to-student')}
                      >
                        Teacher → Student
                      </button>
                    </div>
                  </div>

                  <div className="gmeet-sign-camera-box">
                    <video ref={signVideoRef} autoPlay playsInline muted />
                    {!signStreamRef.current && (
                      <div className="gmeet-camera-off-overlay">
                        <Camera size={32} />
                        <span>Camera preview inactive</span>
                      </div>
                    )}
                  </div>

                  <div className="gmeet-camera-buttons">
                    <button
                      type="button"
                      className="gmeet-btn-action"
                      onClick={() => void startSignCamera()}
                    >
                      <Camera size={15} /> Start camera
                    </button>
                    <button
                      type="button"
                      className="gmeet-btn-action secondary"
                      onClick={stopSignCamera}
                    >
                      <X size={15} /> Stop
                    </button>
                  </div>

                  <div className="gmeet-model-notice">
                    <ScanFace size={16} />
                    <div>
                      <b>MediaPipe & Gesture Pipeline</b>
                      <small>Tracks 21 hand landmarks; sends live gloss results to meeting captions.</small>
                    </div>
                  </div>

                  <div className="gmeet-setting-group">
                    <label>Manual Verified Sign / Gloss Input</label>
                    <textarea
                      rows={2}
                      value={signText}
                      onChange={e => setSignText(e.target.value)}
                      placeholder="e.g. Question about Newton's Second Law"
                      className="gmeet-textarea"
                    />
                    <button
                      type="button"
                      className="gmeet-btn-primary-small"
                      onClick={sendRecognizedSign}
                    >
                      <Send size={14} /> Send Sign as Caption
                    </button>
                  </div>
                  <p className="gmeet-hint-text">{signStatus}</p>
                </div>
              )}

              {/* WHITEBOARD DRAWER */}
              {activeSideDrawer === 'board' && (
                <div className="gmeet-board-view">
                  <div className="gmeet-board-toolbar">
                    <div className="gmeet-color-picker">
                      {['#8ab4f8', '#ea4335', '#fbbc04', '#34a853', '#ffffff'].map(c => (
                        <button
                          key={c}
                          type="button"
                          className={brushColor === c ? 'color-dot active' : 'color-dot'}
                          style={{ backgroundColor: c }}
                          onClick={() => setBrushColor(c)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="gmeet-btn-clear"
                      onClick={clearBoard}
                    >
                      Clear canvas
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={440}
                    className="gmeet-canvas"
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={() => setDrawing(false)}
                    onPointerLeave={() => setDrawing(false)}
                  />
                  <p className="gmeet-hint-text">Equations and diagrams drawn here are streamed in real-time to all participants.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* Signature Google Meet Bottom Floating Dock */}
      <footer className="gmeet-dock">
        {/* Left: Time & Room Information */}
        <div className="gmeet-dock-left">
          <span className="gmeet-dock-time">{currentTime}</span>
          <span className="gmeet-dock-divider">|</span>
          <span className="gmeet-dock-room-code" title="Meeting Code">{roomName}</span>
          <button
            type="button"
            className="gmeet-dock-copy-btn"
            onClick={copyInvite}
            title="Copy meeting info"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* Center: Google Meet Circular Control Icons */}
        <div className="gmeet-dock-center">
          {/* Mic */}
          <button
            type="button"
            className={`gmeet-circle-btn ${!localParticipant.isMicrophoneEnabled ? 'muted' : ''}`}
            onClick={() => void localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
            title={localParticipant.isMicrophoneEnabled ? 'Turn off microphone' : 'Turn on microphone'}
          >
            {localParticipant.isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Camera */}
          <button
            type="button"
            className={`gmeet-circle-btn ${!localParticipant.isCameraEnabled ? 'muted' : ''}`}
            onClick={() => void localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
            title={localParticipant.isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {localParticipant.isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Live Captions (CC) */}
          <button
            type="button"
            className={`gmeet-circle-btn ${captionEnabled ? 'active-blue' : ''}`}
            onClick={() => setCaptionEnabled(!captionEnabled)}
            title={captionEnabled ? 'Turn off captions' : 'Turn on captions'}
          >
            <Captions size={20} />
          </button>

          {/* Raise Hand */}
          <button
            type="button"
            className={`gmeet-circle-btn ${handRaised ? 'active-yellow' : ''}`}
            onClick={toggleHandRaise}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand size={20} />
          </button>

          {/* Whiteboard Canvas */}
          <button
            type="button"
            className={`gmeet-circle-btn ${activeSideDrawer === 'board' ? 'active-blue' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'board' ? null : 'board')}
            title="Whiteboard"
          >
            <PenTool size={20} />
          </button>

          {/* Sign Language Bridge */}
          <button
            type="button"
            className={`gmeet-circle-btn ${activeSideDrawer === 'signs' ? 'active-blue' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'signs' ? null : 'signs')}
            title="Sign Language Bridge"
          >
            <Languages size={20} />
          </button>

          {/* End Call Button */}
          <button
            type="button"
            className="gmeet-leave-pill"
            onClick={onLeave}
            title="Leave call"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right: Drawer Triggers & Tools */}
        <div className="gmeet-dock-right">
          {/* People */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer === 'people' ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'people' ? null : 'people')}
            title="People"
          >
            <Users size={19} />
            <span className="gmeet-count-badge">{participants.length || 1}</span>
          </button>

          {/* Chat */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'chat' ? null : 'chat')}
            title="Chat with everyone"
          >
            <MessageSquare size={19} />
            {chat.length > 0 && <span className="gmeet-dot-badge" />}
          </button>

          {/* Accessibility Settings */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer === 'accessibility' ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'accessibility' ? null : 'accessibility')}
            title="Accessibility and Captions"
          >
            <Settings2 size={19} />
          </button>
        </div>
      </footer>
    </div>
  )
}
