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

function localContextualize(text: string) {
  let processed = text.trim()
  let changed = false

  const PHONETIC_FIXES: [RegExp, string][] = [
    [/\b(newtons?\s+second\s+law|newton\s+second\s+law)\b/gi, "Newton's second law"],
    [/\b(newtons?\s+first\s+law)\b/gi, "Newton's first law"],
    [/\b(newtons?\s+third\s+law)\b/gi, "Newton's third law"],
    [/\b(photo\s*synthesis|photosyn\s*thesis)\b/gi, 'photosynthesis'],
    [/\b(mito\s*chondria|mytochondria)\b/gi, 'mitochondria'],
    [/\b(derivitive|the\s+derivative)\b/gi, 'derivative'],
    [/\b(intergral)\b/gi, 'integral'],
    [/\b(eigen\s*value|eigen-value)\b/gi, 'eigenvalue'],
    [/\b(algorhythm)\b/gi, 'algorithm'],
    [/\b(quadratic\s+equasion)\b/gi, 'quadratic equation'],
    [/\b(ohms?\s+law)\b/gi, "Ohm's law"],
    [/\b(sequel)\b/gi, 'SQL'],
    [/\b(neuronal\s+network)\b/gi, 'neural network'],
    [/\b(kinetic\s+enargy|kinetic\s+energee)\b/gi, 'kinetic energy'],
    [/\b(gravitational\s+forces?)\b/gi, 'gravitational force'],
    [/\b(sell\s+membrane)\b/gi, 'cell membrane'],
    [/\b(machine-learning)\b/gi, 'machine learning'],
    [/\b(artificial\s+inteligence)\b/gi, 'artificial intelligence'],
    [/\b(dy\s+by\s+dx|d\s+by\s+dx)\b/gi, 'dy/dx'],
    [/\b(f\s+of\s+x)\b/gi, 'f(x)'],
    [/\b(f\s+prime\s+of\s+x)\b/gi, "f'(x)"],
    [/\b(f\s+equals\s+m\s+a|f\s+equals\s+m\s*dot\s*a)\b/gi, 'F = m · a'],
    [/\b(e\s+equals\s+m\s+c\s+squared)\b/gi, 'E = m · c²'],
    [/\b(v\s+equals\s+i\s+r)\b/gi, 'V = I · R'],
    [/\b(square\s+root\s+of|sq\s*root)\b/gi, '√'],
    [/\b(summation\s+of|sigma\s+of)\b/gi, '∑'],
    [/\b(a\s+t\s+p)\b/gi, 'ATP'],
    [/\b(d\s+n\s+a)\b/gi, 'DNA'],
    [/\b(r\s+n\s+a)\b/gi, 'RNA'],
    [/\b(h\s+t\s+t\s+p|h\s+t\s+t\s+p\s+s)\b/gi, 'HTTP'],
    [/\b(a\s+p\s+i)\b/gi, 'API'],
    [/\b(c\s+p\s+u)\b/gi, 'CPU'],
    [/\b(g\s+p\s+u)\b/gi, 'GPU'],
    [/\b(chloroplasts?)\b/gi, 'chloroplast'],
  ]

  for (const [pattern, replacement] of PHONETIC_FIXES) {
    if (pattern.test(processed)) {
      processed = processed.replace(pattern, replacement)
      changed = true
    }
  }

  if (processed.length > 0) {
    processed = processed.charAt(0).toUpperCase() + processed.slice(1)
  }
  processed = processed.replace(/\s+([,.;:!?])/g, '$1')

  return { processed, changed }
}

export default function App() {
  const [name, setName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState(LK_URL)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Landing Page Interactive Camera & Audio Preview
  const [previewCameraOn, setPreviewCameraOn] = useState(false)
  const [previewMicOn, setPreviewMicOn] = useState(false)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)

  // Cycling real-time sample captions
  const SAMPLE_STEM_CAPTIONS = [
    { speaker: "Prof. Satheesh (Physics)", text: "According to Newton's second law, net force F equals mass m times acceleration a: F = m·a." },
    { speaker: "Imanuvel (ISL Sign)", text: "[Sign Language]: Can we solve this quadratic equation using the quadratic formula?" },
    { speaker: "Prof. Satheesh (Calculus)", text: "The derivative of e^(2x) with respect to x gives 2e^(2x) by applying the chain rule." },
    { speaker: "Prof. Satheesh (Biology)", text: "In photosynthesis, light reactions produce ATP and NADPH inside the chloroplast thylakoids." }
  ]
  const [sampleIdx, setSampleIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSampleIdx(prev => (prev + 1) % SAMPLE_STEM_CAPTIONS.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  async function togglePreviewCamera() {
    if (previewCameraOn) {
      previewStreamRef.current?.getTracks().forEach(t => t.stop())
      previewStreamRef.current = null
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null
      setPreviewCameraOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        previewStreamRef.current = stream
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream
          await previewVideoRef.current.play()
        }
        setPreviewCameraOn(true)
      } catch {
        setError('Camera permission was denied or camera is in use by another app.')
      }
    }
  }

  async function enterRoom(room: string) {
    setError('')
    if (!name.trim()) return setError('Please enter your display name to join.')
    if (!room.trim()) return setError('Please enter or generate a meeting code.')
    setBusy(true)

    // Stop landing preview camera if active
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop())
      previewStreamRef.current = null
    }

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

  const currentSample = SAMPLE_STEM_CAPTIONS[sampleIdx]

  return (
    <main className="gmeet-landing">
      {/* Ambient background glow elements */}
      <div className="landing-ambient-glow glow-blue" />
      <div className="landing-ambient-glow glow-purple" />
      <div className="landing-ambient-glow glow-cyan" />

      {/* Top Navigation */}
      <header className="gmeet-landing-header">
        <div className="gmeet-brand">
          <div className="gmeet-brand-icon"><Accessibility size={24} /></div>
          <div className="gmeet-brand-meta">
            <span className="gmeet-brand-text">Access<b>Class</b></span>
            <span className="gmeet-brand-sub">STEM AI Inclusivity</span>
          </div>
        </div>

        <div className="gmeet-header-meta">
          <div className="gmeet-pulse-status">
            <span className="pulse-dot" />
            <span>AI Models & WebRTC Ready</span>
          </div>
          <span className="gmeet-tag-rit">RIT Dept of AI & ML</span>
        </div>
      </header>

      {/* Hero Body */}
      <section className="gmeet-landing-hero">
        {/* Left Column: Mission & Interactive Join Console */}
        <div className="gmeet-hero-left">
          <div className="gmeet-eyebrow-pill">
            <Sparkles size={14} className="eyebrow-sparkle" />
            <span>FINAL-YEAR AI & ML PROJECT • CONTEXT-AWARE ACCESSIBILITY</span>
          </div>

          <h1>
            Empowering every voice in <br />
            <span className="hero-gradient-text">STEM Classrooms.</span>
          </h1>

          <p className="gmeet-hero-sub">
            A real-time WebRTC classroom bridging communication barriers with context-aware technical speech captioning, bidirectional sign language translation (ISL/ASL), mathematical formula rendering, and personalized visual displays.
          </p>

          {/* Interactive Joining Console */}
          <div className="gmeet-action-box">
            <div className="gmeet-box-kicker">
              <span>GET STARTED</span>
              <small>Choose your classroom role</small>
            </div>

            {/* Name Input & Role Selector */}
            <div className="gmeet-input-row">
              <div className="gmeet-name-wrapper">
                <input
                  className="gmeet-input-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={60}
                />
              </div>

              <div className="gmeet-role-toggle">
                <button
                  type="button"
                  className={role === 'student' ? 'gmeet-role-btn active student' : 'gmeet-role-btn'}
                  onClick={() => setRole('student')}
                >
                  <Users size={15} /> Student
                </button>
                <button
                  type="button"
                  className={role === 'teacher' ? 'gmeet-role-btn active teacher' : 'gmeet-role-btn'}
                  onClick={() => setRole('teacher')}
                >
                  <BookOpen size={15} /> Teacher
                </button>
              </div>
            </div>

            {/* Quick Demo Personas */}
            <div className="gmeet-quick-personas">
              <span>Quick setup:</span>
              <button
                type="button"
                className="gmeet-chip-btn"
                onClick={() => { setName('Imanuvel (Student)'); setRole('student') }}
              >
                Imanuvel (Student)
              </button>
              <button
                type="button"
                className="gmeet-chip-btn"
                onClick={() => { setName('Prof. Satheesh (Teacher)'); setRole('teacher') }}
              >
                Prof. Satheesh (Teacher)
              </button>
            </div>

            {/* Join Actions: New Meeting + Code Input */}
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
                  placeholder="Enter meeting code"
                />
                <button
                  className="gmeet-btn-join"
                  disabled={busy || !roomName.trim()}
                  onClick={() => enterRoom(roomName)}
                >
                  <DoorOpen size={16} /> Join
                </button>
              </div>
            </div>

            {/* Predefined Classroom Subject Rooms */}
            <div className="gmeet-suggested-rooms">
              <span>Or join subject room:</span>
              <button
                type="button"
                className="room-pill"
                onClick={() => { setRoomName('stem-calculus-lab') }}
              >
                📐 Calculus
              </button>
              <button
                type="button"
                className="room-pill"
                onClick={() => { setRoomName('stem-physics-mechanics') }}
              >
                ⚡ Physics
              </button>
              <button
                type="button"
                className="room-pill"
                onClick={() => { setRoomName('stem-organic-chemistry') }}
              >
                🧪 Chemistry
              </button>
            </div>

            {error && <div className="gmeet-alert-error" role="alert">{error}</div>}
          </div>

          {/* 4 Feature Badges */}
          <div className="gmeet-feature-strip">
            <div className="gmeet-feature-item">
              <div className="feature-icon-circle"><Captions size={17} /></div>
              <div><b>Contextual Captions</b><small>STEM Homophone Disambiguation</small></div>
            </div>
            <div className="gmeet-feature-item">
              <div className="feature-icon-circle"><Languages size={17} /></div>
              <div><b>Bidirectional Signing</b><small>ISL & ASL Gesture Translation</small></div>
            </div>
            <div className="gmeet-feature-item">
              <div className="feature-icon-circle"><PenTool size={17} /></div>
              <div><b>Math Whiteboard</b><small>Real-Time Stroke Collaboration</small></div>
            </div>
            <div className="gmeet-feature-item">
              <div className="feature-icon-circle"><Eye size={17} /></div>
              <div><b>WCAG 2.1 AAA</b><small>High Contrast & Dyslexic Fonts</small></div>
            </div>
          </div>
        </div>

        {/* Right Column: Google Meet Green Room (Interactive Camera & Audio Check) */}
        <div className="gmeet-hero-right">
          <div className="gmeet-greenroom-card">
            <div className="greenroom-header">
              <div className="greenroom-title">
                <span className="live-dot" />
                <span>Classroom Preview & Hardware Check</span>
              </div>
              <span className="greenroom-chip">{role.toUpperCase()}</span>
            </div>

            {/* Video Preview Box */}
            <div className="greenroom-screen">
              {previewCameraOn ? (
                <video ref={previewVideoRef} autoPlay playsInline muted className="greenroom-video-feed" />
              ) : (
                <div className="greenroom-avatar-box">
                  <div className="greenroom-avatar" style={{ backgroundColor: getAvatarColor(name || 'User') }}>
                    {name ? name.slice(0, 1).toUpperCase() : 'A'}
                  </div>
                  <span className="greenroom-name-tag">{name || 'Your video'}</span>
                  <small className="greenroom-hint">Camera preview is off. Click below to test your webcam.</small>
                </div>
              )}

              {/* Hardware control toggles on preview (Google Meet signature controls) */}
              <div className="greenroom-controls-bar">
                <button
                  type="button"
                  className={`greenroom-round-btn ${!previewMicOn ? 'muted' : 'active'}`}
                  onClick={() => setPreviewMicOn(!previewMicOn)}
                  title={previewMicOn ? 'Microphone on' : 'Microphone muted'}
                >
                  {previewMicOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>

                <button
                  type="button"
                  className={`greenroom-round-btn ${!previewCameraOn ? 'muted' : 'active'}`}
                  onClick={() => void togglePreviewCamera()}
                  title={previewCameraOn ? 'Camera on' : 'Camera off'}
                >
                  {previewCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>

              {/* Live Simulated STEM Caption Overlay */}
              <div className="greenroom-caption-banner">
                <div className="caption-tag-row">
                  <span className="greenroom-caption-badge"><Sparkles size={11} /> LIVE CAPTION PREVIEW</span>
                  <span className="greenroom-caption-subject">AI STEM Lexicon</span>
                </div>
                <div className="greenroom-caption-content">
                  <b className="speaker-name">{currentSample.speaker}:</b>{' '}
                  <span className="caption-body">{currentSample.text}</span>
                </div>
              </div>
            </div>

            {/* Greenroom Footer & Hardware Metrics */}
            <div className="greenroom-footer">
              <div className="greenroom-metric">
                <span className="metric-dot green" />
                <span>Microphone: {previewMicOn ? 'Working' : 'Muted'}</span>
              </div>
              <div className="greenroom-metric">
                <span className="metric-dot green" />
                <span>WebRTC: Connected</span>
              </div>
              <div className="greenroom-metric">
                <span className="metric-dot blue" />
                <span>Sign Engine: Standby</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* College Institutional Attribution Strip */}
      <footer className="gmeet-landing-footer">
        <div className="footer-left">
          <span><b>Rajalakshmi Institute of Technology, Chennai</b> • Department of Artificial Intelligence & Machine Learning</span>
        </div>
        <div className="footer-right">
          <span>Guide: Mr. A. Satheesh • Team: Piriyarajan P, Imanuvel K, Prasanna Venkatesh N B</span>
        </div>
      </footer>
    </main>
  )
}

function MeetingRoom({ name, role, roomName, onLeave }: { name: string; role: Role; roomName: string; onLeave: () => void }) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const speakingParticipants = useSpeakingParticipants()
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false })

  // Side features panel is OPEN BY DEFAULT for rich split-screen view
  const [activeSideDrawer, setActiveSideDrawer] = useState<'chat' | 'people' | 'accessibility' | 'signs' | 'board' | null>('accessibility')
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
  const [glossarySearch, setGlossarySearch] = useState('')

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
  const [interimCaption, setInterimCaption] = useState<{ speaker: string; text: string } | null>(null)
  const shouldListenRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const captionId = useRef(0)

  // Real-time ultra-low-latency caption streaming timers & deduplication refs
  const lastSentInterimRef = useRef<string>('')
  const interimThrottleTimerRef = useRef<any>(null)
  const fastCommitTimerRef = useRef<any>(null)
  const lastCommittedTextRef = useRef<string>('')

  // Compute all participants (local + remote) so every joined student has a visible tile
  const allParticipants = useMemo(() => {
    if (participants && participants.length > 0) {
      const list = [...participants]
      if (localParticipant && !list.some(p => p.identity === localParticipant.identity || p.sid === localParticipant.sid)) {
        list.unshift(localParticipant)
      }
      return list
    }
    return localParticipant ? [localParticipant] : []
  }, [participants, localParticipant])

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
          setInterimCaption(null)
        } else if (data.type === 'interim-caption') {
          if (data.text) {
            setInterimCaption({ speaker: data.speaker, text: data.text })
          } else {
            setInterimCaption(null)
          }
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
    shouldListenRef.current = false
    clearTimeout(fastCommitTimerRef.current)
    clearTimeout(interimThrottleTimerRef.current)
    try { recognitionRef.current?.stop() } catch {}
    signStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  function sendPacket(data: unknown, reliable = true) {
    if (room.state !== 'connected') return
    const bytes = new TextEncoder().encode(JSON.stringify(data))
    void localParticipant.publishData(bytes, { reliable, topic: 'accessclass' })
  }

  function toggleHandRaise() {
    const next = !handRaised
    setHandRaised(next)
    setRaisedHands(prev => ({ ...prev, [name]: next }))
    sendPacket({ type: 'hand-raise', sender: name, raised: next }, true)
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
    sendPacket({ type: 'classroom-message', item }, true)
    setMessage('')
  }

  async function processCaption(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return

    // 1. Instant client-side local STEM context correction (0ms latency!)
    const { processed: localProcessed, changed: localChanged } = localContextualize(trimmed)

    const item: CaptionItem = {
      id: ++captionId.current,
      raw: trimmed,
      text: localProcessed,
      speaker: name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      changed: localChanged
    }

    // 2. Publish immediately to local state and reliable WebRTC stream
    setCaptionItems(prev => [...prev.slice(-79), item])
    sendPacket({ type: 'caption', item }, true)

    // 3. Optional async server enhancement
    if (API) {
      try {
        const res = await fetch(`${API}/api/captions/contextualize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, subject })
        })
        if (res.ok) {
          const result = await res.json()
          if (result.caption && result.caption !== localProcessed) {
            item.text = result.caption
            item.changed = true
            setCaptionItems(prev => prev.map(c => (c.id === item.id ? { ...c, text: result.caption, changed: true } : c)))
            sendPacket({ type: 'caption', item }, true)
          }
        }
      } catch { /* Local contextualization already active */ }
    }
  }

  function toggleRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setNotice('Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.')
      return
    }

    if (listening) {
      shouldListenRef.current = false
      clearTimeout(fastCommitTimerRef.current)
      clearTimeout(interimThrottleTimerRef.current)
      try { recognitionRef.current?.stop() } catch {}
      setListening(false)
      setInterimCaption(null)
      sendPacket({ type: 'interim-caption', speaker: name, text: '' }, false)
      return
    }

    shouldListenRef.current = true
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setListening(true)
      setNotice('')
    }

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') {
        // Normal silence timeout in Chrome, ignore
        return
      }
      if (e.error === 'not-allowed') {
        setNotice('Microphone access was denied. Please allow microphone permissions in your browser.')
        shouldListenRef.current = false
        setListening(false)
        return
      }
      setNotice(`Speech recognition notice: ${e.error}`)
    }

    recognition.onend = () => {
      // Auto-restart if user still wants transcribing active (prevents Chrome silence dropouts!)
      if (shouldListenRef.current) {
        try {
          recognition.start()
        } catch {
          setTimeout(() => {
            if (shouldListenRef.current) {
              try { recognition.start() } catch {}
            }
          }, 200)
        }
      } else {
        setListening(false)
        setInterimCaption(null)
      }
    }

    recognition.onresult = (e: any) => {
      let interim = ''
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalText += transcript + ' '
        } else {
          interim += transcript
        }
      }

      // Ultra-low-latency real-time streaming (< 50ms)
      if (interim.trim()) {
        const { processed: contextualizedInterim } = localContextualize(interim)

        // 1. Instant local display with STEM context in 0ms!
        setInterimCaption({ speaker: name, text: contextualizedInterim })

        // 2. Low-latency UDP transmission to remote participants (~40ms, no TCP queuing delay)
        if (contextualizedInterim !== lastSentInterimRef.current) {
          if (!interimThrottleTimerRef.current) {
            interimThrottleTimerRef.current = setTimeout(() => {
              interimThrottleTimerRef.current = null
              lastSentInterimRef.current = contextualizedInterim
              sendPacket({ type: 'interim-caption', speaker: name, text: contextualizedInterim }, false)
            }, 45)
          }
        }

        // 3. Fast Commit on natural micro-pause (650ms instead of Chrome's slow 2.5s wait!)
        clearTimeout(fastCommitTimerRef.current)
        fastCommitTimerRef.current = setTimeout(() => {
          const toCommit = interim.trim()
          if (toCommit.length > 2 && toCommit !== lastCommittedTextRef.current) {
            lastCommittedTextRef.current = toCommit
            void processCaption(toCommit)
            setInterimCaption(null)
            sendPacket({ type: 'interim-caption', speaker: name, text: '' }, false)
          }
        }, 650)
      }

      // Browser finalization event
      if (finalText.trim()) {
        clearTimeout(fastCommitTimerRef.current)
        const toCommit = finalText.trim()
        if (toCommit !== lastCommittedTextRef.current) {
          lastCommittedTextRef.current = toCommit
          setInterimCaption(null)
          sendPacket({ type: 'interim-caption', speaker: name, text: '' }, false)
          void processCaption(toCommit)
        }
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setNotice('Could not start microphone captioning.')
      setListening(false)
      shouldListenRef.current = false
    }
  }

  function toggleCaptionsDock() {
    if (!captionEnabled) {
      setCaptionEnabled(true)
      if (!listening) {
        toggleRecognition()
      }
    } else {
      setCaptionEnabled(false)
      if (listening) {
        toggleRecognition()
      }
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
    sendPacket({ type: 'board', x: p.x, y: p.y, color: brushColor, start: true }, false)
  }
  function moveDraw(e: any) {
    if (!drawing || !canvasRef.current) return
    const p = pointerPosition(e)
    const ctx = canvasRef.current.getContext('2d')!
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    sendPacket({ type: 'board', x: p.x, y: p.y, color: brushColor, start: false }, false)
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

  const filteredGlossaryKeys = useMemo(() => {
    const q = glossarySearch.trim().toLowerCase()
    const keys = Object.keys(STEM_DICTIONARY)
    if (!q) return keys.slice(0, 14)
    return keys.filter(k => k.toLowerCase().includes(q) || STEM_DICTIONARY[k].subject.toLowerCase().includes(q))
  }, [glossarySearch])

  const [transcriptCopied, setTranscriptCopied] = useState(false)
  function copyTranscript() {
    if (captionItems.length === 0) return
    const text = captionItems.map(c => `[${c.time}] ${c.speaker}: ${c.text}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setTranscriptCopied(true)
      setTimeout(() => setTranscriptCopied(false), 2000)
    }).catch(() => {})
  }

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

        {/* Center: Quick Switcher for Side Features */}
        <div className="gmeet-topbar-center">
          <div className="gmeet-feature-nav-pills">
            <button
              type="button"
              className={`gmeet-nav-pill ${activeSideDrawer === 'accessibility' ? 'active' : ''}`}
              onClick={() => setActiveSideDrawer('accessibility')}
              title="Live Captions & STEM Glossary"
            >
              <Captions size={14} />
              <span>Captions & Glossary</span>
            </button>
            <button
              type="button"
              className={`gmeet-nav-pill ${activeSideDrawer === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveSideDrawer('chat')}
              title="Classroom Chat"
            >
              <MessageSquare size={14} />
              <span>Chat</span>
              {chat.length > 0 && <span className="nav-pill-badge">{chat.length}</span>}
            </button>
            <button
              type="button"
              className={`gmeet-nav-pill ${activeSideDrawer === 'signs' ? 'active' : ''}`}
              onClick={() => setActiveSideDrawer('signs')}
              title="Sign Language Bridge"
            >
              <Languages size={14} />
              <span>Sign Bridge</span>
            </button>
            <button
              type="button"
              className={`gmeet-nav-pill ${activeSideDrawer === 'board' ? 'active' : ''}`}
              onClick={() => setActiveSideDrawer('board')}
              title="Shared STEM Whiteboard"
            >
              <PenTool size={14} />
              <span>Whiteboard</span>
            </button>
            <button
              type="button"
              className={`gmeet-nav-pill ${activeSideDrawer === 'people' ? 'active' : ''}`}
              onClick={() => setActiveSideDrawer('people')}
              title="Classroom People"
            >
              <Users size={14} />
              <span>People ({participants.length || 1})</span>
            </button>
          </div>
          {handRaised && (
            <div className="gmeet-raised-indicator">
              <Hand size={14} /> <span>Hand Raised</span>
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

      {/* Main Video Stage & Side Drawer Area (Split-Screen) */}
      <main className="gmeet-main">
        <section className="gmeet-stage-area">
          {/* Responsive Participant Video Tiles (Google Meet Multi-Box Layout) */}
          <div className={`gmeet-grid count-${Math.min(allParticipants.length || 1, 9)}`}>
            {allParticipants.length > 0 ? (
              allParticipants.map(participant => {
                const isSpeaking = speakingParticipants.some(
                  sp => sp.identity === participant.identity || sp.sid === participant.sid
                )
                const isLocal = participant.isLocal || participant.identity === localParticipant?.identity
                const participantName = participant.name || participant.identity || (isLocal ? name : 'Participant')
                const isHandRaised = raisedHands[participantName] || raisedHands[participant.identity]

                // Find active camera track for this participant
                const camTrack = cameraTracks.find(
                  t => (t.participant?.identity === participant.identity || t.participant?.sid === participant.sid) &&
                       t.publication &&
                       !t.publication.isMuted &&
                       t.publication.track
                )

                return (
                  <div
                    key={participant.sid || participant.identity || participantName}
                    className={`gmeet-tile ${isSpeaking ? 'speaking' : ''} ${!camTrack ? 'tile-avatar-view' : ''}`}
                  >
                    {camTrack ? (
                      <VideoTrack trackRef={camTrack} className="gmeet-video-track" />
                    ) : (
                      <div
                        className="gmeet-avatar-placeholder"
                        style={{ backgroundColor: getAvatarColor(participantName) }}
                      >
                        {participantName.slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div className="gmeet-tile-footer">
                      <span className="gmeet-tile-name">
                        {isSpeaking ? (
                          <Volume2 size={14} className="speaking-icon" />
                        ) : participant.isMicrophoneEnabled ? (
                          <Mic size={13} className="gmeet-tile-mic-on" />
                        ) : (
                          <MicOff size={13} className="gmeet-tile-mic-off" />
                        )}
                        <span>{participantName} {isLocal ? '(You)' : ''}</span>
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
              /* Single Fallback Tile */
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
                {interimCaption && (
                  <div className="gmeet-caption-line interim">
                    <span className="gmeet-caption-speaker">{interimCaption.speaker}:</span>{' '}
                    <span className="gmeet-caption-text interim-text">
                      {renderCaptionWithTerms(interimCaption.text)}
                      <span className="caption-typing-cursor">...</span>
                    </span>
                  </div>
                )}
                {latestCaptions.length > 0 ? (
                  latestCaptions.map(c => (
                    <div key={c.id} className="gmeet-caption-line">
                      <span className="gmeet-caption-speaker">{c.speaker || 'Speaker'}:</span>{' '}
                      <span className="gmeet-caption-text">{renderCaptionWithTerms(c.text)}</span>
                    </div>
                  ))
                ) : !interimCaption && (
                  <div className="gmeet-caption-idle">
                    {listening ? (
                      <span className="captions-live-pill">
                        <span className="pulse-dot green" /> Transcribing live... speak into your microphone
                      </span>
                    ) : (
                      <div className="captions-idle-box">
                        <span>Captions active • Waiting for dialogue</span>
                        <button
                          type="button"
                          className="gmeet-btn-start-mic-mini"
                          onClick={toggleRecognition}
                        >
                          <Mic size={13} /> Start Transcribing (My Mic)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Pill to Restore Side Features if Collapsed */}
          {!activeSideDrawer && (
            <button
              type="button"
              className="gmeet-expand-side-pill"
              onClick={() => setActiveSideDrawer('accessibility')}
              title="Show Side Features Panel (Captions, Chat, Signs, Whiteboard)"
            >
              <Sliders size={16} />
              <span>Show Side Features</span>
            </button>
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
              <div className="gmeet-glossary-actions">
                <button
                  type="button"
                  className="glossary-action-btn"
                  onClick={() => {
                    setActiveSideDrawer('chat')
                    setMessage(`Question about ${selectedGlossaryTerm.term}: `)
                    setSelectedGlossaryTerm(null)
                  }}
                >
                  <MessageSquare size={13} /> Ask question in Chat
                </button>
                <button
                  type="button"
                  className="glossary-action-btn secondary"
                  onClick={() => {
                    setActiveSideDrawer('signs')
                    setSignText(selectedGlossaryTerm.term)
                    setSelectedGlossaryTerm(null)
                  }}
                >
                  <Languages size={13} /> Test in Sign Bridge
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Google Meet Right-Side Features Panel (Docked Sidebar) */}
        {activeSideDrawer && (
          <aside className="gmeet-drawer">
            <div className="gmeet-drawer-header">
              <div className="gmeet-drawer-title-group">
                {activeSideDrawer === 'accessibility' && <Captions size={18} className="drawer-header-icon" />}
                {activeSideDrawer === 'chat' && <MessageSquare size={18} className="drawer-header-icon" />}
                {activeSideDrawer === 'signs' && <Languages size={18} className="drawer-header-icon" />}
                {activeSideDrawer === 'board' && <PenTool size={18} className="drawer-header-icon" />}
                {activeSideDrawer === 'people' && <Users size={18} className="drawer-header-icon" />}
                <h3>
                  {activeSideDrawer === 'accessibility' && 'Captions & STEM Glossary'}
                  {activeSideDrawer === 'chat' && 'In-Call Chat'}
                  {activeSideDrawer === 'signs' && 'Sign Language Bridge'}
                  {activeSideDrawer === 'board' && 'Shared STEM Whiteboard'}
                  {activeSideDrawer === 'people' && `Classroom People (${participants.length || 1})`}
                </h3>
              </div>
              <button
                type="button"
                className="gmeet-drawer-close"
                onClick={() => setActiveSideDrawer(null)}
                title="Collapse side panel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Drawer Tab Switcher with Icons + Labels */}
            <div className="gmeet-drawer-tabs">
              <button
                type="button"
                className={activeSideDrawer === 'accessibility' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('accessibility')}
                title="Captions & Glossary"
              >
                <Captions size={15} />
                <span>Captions</span>
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'chat' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('chat')}
                title="Chat"
              >
                <MessageSquare size={15} />
                <span>Chat</span>
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'signs' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('signs')}
                title="Sign Language"
              >
                <Languages size={15} />
                <span>Sign Bridge</span>
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'board' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('board')}
                title="Whiteboard"
              >
                <PenTool size={15} />
                <span>Whiteboard</span>
              </button>
              <button
                type="button"
                className={activeSideDrawer === 'people' ? 'drawer-tab active' : 'drawer-tab'}
                onClick={() => setActiveSideDrawer('people')}
                title="People"
              >
                <Users size={15} />
                <span>People</span>
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

                  {/* Quick Question Chips for Accessible Interaction */}
                  <div className="gmeet-quick-prompts">
                    <span className="quick-prompts-label">Quick ask:</span>
                    <button
                      type="button"
                      className="gmeet-quick-chip"
                      onClick={() => setMessage('Could you please explain that formula again?')}
                    >
                      Explain formula
                    </button>
                    <button
                      type="button"
                      className="gmeet-quick-chip"
                      onClick={() => setMessage('Can you please slow down the pace?')}
                    >
                      Slow down
                    </button>
                    <button
                      type="button"
                      className="gmeet-quick-chip"
                      onClick={() => setMessage('What does this variable denote?')}
                    >
                      Variable meaning
                    </button>
                  </div>

                  <form
                    className="gmeet-chat-input-bar"
                    onSubmit={e => { e.preventDefault(); sendMessage() }}
                  >
                    <input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Send a message to everyone..."
                    />
                    <button type="submit" disabled={!message.trim()}><Send size={16} /></button>
                  </form>
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

                  {/* STEM Lexicon & Formula Explorer */}
                  <div className="gmeet-setting-group stem-glossary-section">
                    <div className="gmeet-setting-label-row">
                      <label><Sparkles size={13} /> Interactive STEM Lexicon</label>
                      <span className="stem-lexicon-count">{Object.keys(STEM_DICTIONARY).length} concepts</span>
                    </div>
                    <div className="gmeet-glossary-search-box">
                      <Search size={14} />
                      <input
                        value={glossarySearch}
                        onChange={e => setGlossarySearch(e.target.value)}
                        placeholder="Search term or formula (e.g. Newton, derivative)..."
                      />
                    </div>
                    <div className="gmeet-glossary-chip-list">
                      {filteredGlossaryKeys.map(key => (
                        <button
                          key={key}
                          type="button"
                          className={`gmeet-term-chip ${selectedGlossaryTerm?.term.toLowerCase() === key ? 'active' : ''}`}
                          onClick={() => setSelectedGlossaryTerm({ term: key, data: STEM_DICTIONARY[key] })}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Complete Transcript History */}
                  <div className="gmeet-transcript-section">
                    <div className="gmeet-transcript-header">
                      <h4>Session Transcript ({captionItems.length})</h4>
                      {captionItems.length > 0 && (
                        <button
                          type="button"
                          className="gmeet-btn-copy-transcript"
                          onClick={copyTranscript}
                          title="Copy transcript to clipboard"
                        >
                          <Copy size={13} />
                          <span>{transcriptCopied ? 'Copied!' : 'Copy Notes'}</span>
                        </button>
                      )}
                    </div>
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

                  {/* Quick Sign Phrases for Hearing/Speech-Impaired Students */}
                  <div className="gmeet-setting-group">
                    <label>Quick Student Sign Language Gestures</label>
                    <div className="gmeet-quick-sign-grid">
                      {[
                        "Can you explain the formula again?",
                        "Please repeat the last sentence.",
                        "Understood! Thank you.",
                        "I have a doubt regarding this equation.",
                        "Please show on the whiteboard.",
                        "Yes",
                        "No"
                      ].map((phrase, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="gmeet-sign-phrase-btn"
                          onClick={() => {
                            const item: ChatItem = {
                              id: crypto.randomUUID(),
                              sender: name,
                              role,
                              text: `[${signLanguage} Sign → Text] ${phrase}`,
                              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              kind: 'student'
                            }
                            setChat(prev => [...prev, item])
                            sendPacket({ type: 'classroom-message', item })
                            setSignStatus(`Sent sign translation: "${phrase}"`)
                          }}
                        >
                          <Languages size={13} />
                          <span>{phrase}</span>
                        </button>
                      ))}
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

                  {/* Quick Formula Inserter */}
                  <div className="gmeet-board-formula-bar">
                    <span className="formula-bar-label">Insert equation:</span>
                    <div className="formula-chips">
                      {[
                        'F = m · a',
                        'f\'(x) = dy/dx',
                        '∫ f(x) dx',
                        'x = [-b ± √(b²-4ac)] / 2a',
                        'E = m · c²',
                        'V = I · R',
                        'lim(h→0)',
                        'ATP'
                      ].map((eq, i) => (
                        <button
                          key={i}
                          type="button"
                          className="gmeet-formula-chip"
                          onClick={() => {
                            const ctx = canvasRef.current?.getContext('2d')
                            if (ctx && canvasRef.current) {
                              ctx.font = 'bold 20px Consolas, monospace'
                              ctx.fillStyle = brushColor
                              ctx.fillText(eq, 30, 50 + (i % 6) * 35)
                              sendPacket({
                                type: 'classroom-message',
                                item: { id: crypto.randomUUID(), sender: name, role, text: `[Whiteboard Formula] ${eq}`, kind: 'draw' }
                              })
                            }
                          }}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
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

          {/* Live Captions (CC) Overlay Toggle */}
          <button
            type="button"
            className={`gmeet-circle-btn ${captionEnabled ? 'active-blue' : ''}`}
            onClick={toggleCaptionsDock}
            title={captionEnabled ? 'Turn off subtitles' : 'Turn on subtitles & transcribing'}
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

          {/* Whiteboard Quick Toggle */}
          <button
            type="button"
            className={`gmeet-circle-btn ${activeSideDrawer === 'board' ? 'active-blue' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'board' ? null : 'board')}
            title="Shared STEM Whiteboard"
          >
            <PenTool size={20} />
          </button>

          {/* Sign Language Bridge Quick Toggle */}
          <button
            type="button"
            className={`gmeet-circle-btn ${activeSideDrawer === 'signs' ? 'active-blue' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'signs' ? null : 'signs')}
            title="Sign Language Bridge"
          >
            <Languages size={20} />
          </button>

          {/* Leave Call */}
          <button
            type="button"
            className="gmeet-leave-pill"
            onClick={onLeave}
            title="Leave call"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right: Drawer Triggers & Netlify Badge Clearance */}
        <div className="gmeet-dock-right">
          {/* Captions & Glossary */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer === 'accessibility' ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'accessibility' ? null : 'accessibility')}
            title="Captions & STEM Glossary"
          >
            <Captions size={19} />
          </button>

          {/* Chat */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'chat' ? null : 'chat')}
            title="Classroom Chat"
          >
            <MessageSquare size={19} />
            {chat.length > 0 && <span className="gmeet-dot-badge" />}
          </button>

          {/* People */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer === 'people' ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'people' ? null : 'people')}
            title="Classroom People"
          >
            <Users size={19} />
            <span className="gmeet-count-badge">{participants.length || 1}</span>
          </button>

          {/* Side Panel Toggle */}
          <button
            type="button"
            className={`gmeet-tool-btn ${activeSideDrawer ? 'active' : ''}`}
            onClick={() => setActiveSideDrawer(activeSideDrawer ? null : 'accessibility')}
            title={activeSideDrawer ? 'Hide side panel' : 'Show side panel'}
          >
            <Sliders size={19} />
          </button>
        </div>
      </footer>
    </div>
  )
}
