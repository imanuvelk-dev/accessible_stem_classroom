import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LiveKitRoom, RoomAudioRenderer, VideoConference, useLocalParticipant,
  useRoomContext, useTracks
} from '@livekit/components-react'
import { Track, RoomEvent, DataPacket_Kind } from 'livekit-client'
import {
  Accessibility, BookOpen, Captions, Check, ChevronDown, Copy, DoorOpen,
  Hand, MessageCircle, Mic, MonitorUp, PenLine, Send, Settings2, Sparkles,
  Users, Video, X, Type, Eye, CircleHelp, Languages, Camera, ScanFace
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || ''

type Role = 'teacher' | 'student'
type ChatItem = { id: string; sender: string; role: string; text: string; kind: 'chat' | 'student' | 'draw' }
type CaptionItem = { id: number; raw: string; text: string; time: string; changed: boolean }

function randomRoom() {
  return 'stem-' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6)
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
    if (!name.trim()) return setError('Enter your display name first.')
    if (!room.trim()) return setError('Enter a meeting code or create a room.')
    if (!LK_URL) return setError('Set VITE_LIVEKIT_URL in frontend/.env and restart npm run dev.')
    setBusy(true)
    try {
      const response = await fetch(`${API}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, identity: name.trim(), role })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not create meeting token.')
      setToken(data.token)
      setServerUrl(data.serverUrl || LK_URL)
      setRoomName(data.room)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect to the backend.')
    } finally {
      setBusy(false)
    }
  }

  if (token) {
    return <LiveKitRoom
      video audio token={token} serverUrl={serverUrl}
      connect onDisconnected={() => setToken('')}
      data-lk-theme="default"
      className="livekit-shell"
    >
      <RoomAudioRenderer />
      <MeetingRoom name={name} role={role} roomName={roomName} onLeave={() => setToken('')} />
    </LiveKitRoom>
  }

  return <main className="landing">
    <nav className="topbar">
      <div className="brand"><span className="brand-mark"><Accessibility size={22}/></span><span>Access<span className="brand-accent">Class</span></span></div>
      <div className="top-pill"><span className="status-dot"/> Accessible learning workspace</div>
    </nav>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={15}/> AI-POWERED STEM CLASSROOM</div>
        <h1>Every learner.<br/><span>Every concept.</span><br/>Every voice.</h1>
        <p className="hero-desc">A more inclusive online classroom with live captions, STEM-aware text, and accessible ways for students and teachers to communicate.</p>
        <div className="feature-pills"><span><Captions size={15}/> Live captions</span><span><BookOpen size={15}/> STEM context</span><span><Hand size={15}/> Two-way access</span></div>
      </div>
      <div className="join-card">
        <div className="card-head"><div><div className="card-kicker">YOUR CLASSROOM</div><h2>Join a session</h2></div><div className="card-icon"><Video size={23}/></div></div>
        <label>Display name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Imanuvel" maxLength={80}/>
        <label>Your role</label>
        <div className="role-select">
          <button className={role === 'student' ? 'role-option active' : 'role-option'} onClick={() => setRole('student')}><Users size={16}/> Student</button>
          <button className={role === 'teacher' ? 'role-option active' : 'role-option'} onClick={() => setRole('teacher')}><BookOpen size={16}/> Teacher</button>
        </div>
        <label>Meeting code</label>
        <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Enter room code"/>
        <button className="btn-primary" disabled={busy} onClick={() => enterRoom(roomName)}>{busy ? 'Connecting…' : 'Join meeting'} <DoorOpen size={17}/></button>
        <div className="or-line"><span/>or<span/></div>
        <button className="btn-secondary" disabled={busy} onClick={() => { const r = randomRoom(); setRoomName(r); void enterRoom(r) }}> <Video size={17}/> Create a new meeting</button>
        {error && <div className="error-message" role="alert">{error}</div>}
        <p className="privacy-note"><span className="status-dot"/> Your classroom is ready when you are</p>
      </div>
    </section>
    <section className="value-row">
      <div><Captions/><b>Readable live captions</b><span>Follow each explanation in text.</span></div>
      <div><BookOpen/><b>STEM-aware language</b><span>Keep key technical terms clear.</span></div>
      <div><PenLine/><b>More ways to respond</b><span>Type or draw a question.</span></div>
    </section>
    <footer>ACCESSCLASS <span>•</span> FINAL-YEAR PROJECT PROTOTYPE</footer>
  </main>
}

function MeetingRoom({ name, role, roomName, onLeave }: { name: string; role: Role; roomName: string; onLeave: () => void }) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const [activeTab, setActiveTab] = useState<'captions' | 'chat' | 'board' | 'signs'>('captions')
  const [chat, setChat] = useState<ChatItem[]>([])
  const [message, setMessage] = useState('')
  const [captionItems, setCaptionItems] = useState<CaptionItem[]>([])
  const [captionEnabled, setCaptionEnabled] = useState(true)
  const [listening, setListening] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [highContrast, setHighContrast] = useState(false)
  const [subject, setSubject] = useState('general')
  const [signLanguage, setSignLanguage] = useState('ISL')
  const [signDirection, setSignDirection] = useState<'student-to-teacher' | 'teacher-to-student'>('student-to-teacher')
  const [signText, setSignText] = useState('')
  const [signStatus, setSignStatus] = useState('Sign recognition model is not configured yet.')
  const [signModelReady, setSignModelReady] = useState(false)
  const signVideoRef = useRef<HTMLVideoElement>(null)
  const signStreamRef = useRef<MediaStream | null>(null)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [boardColor, setBoardColor] = useState('#f5f7ff')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recognitionRef = useRef<any>(null)
  const captionId = useRef(0)
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false })

  useEffect(() => {
    const handleData = (payload: Uint8Array, participant?: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        if (data.type === 'classroom-message') {
          setChat(prev => [...prev.slice(-99), { ...data.item, id: data.item.id || crypto.randomUUID() }])
        } else if (data.type === 'caption') {
          setCaptionItems(prev => [...prev.slice(-79), data.item])
        } else if (data.type === 'board') {
          // Board snapshots are intentionally sent as strokes, not arbitrary HTML.
          drawRemote(data.x, data.y, data.color, data.start)
        }
      } catch { /* Ignore malformed data packets. */ }
    }
    room.on(RoomEvent.DataReceived, handleData)
    return () => { room.off(RoomEvent.DataReceived, handleData) }
  }, [room])

  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch { /* no-op */ }
    signStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  function sendPacket(data: unknown) {
    if (room.state !== 'connected') return
    const bytes = new TextEncoder().encode(JSON.stringify(data))
    void localParticipant.publishData(bytes, { reliable: true, topic: 'accessclass' })
  }

  function sendMessage(kind: ChatItem['kind'] = 'chat') {
    const text = message.trim()
    if (!text) return
    const item: ChatItem = { id: crypto.randomUUID(), sender: name, role, text, kind }
    setChat(prev => [...prev, item])
    sendPacket({ type: 'classroom-message', item })
    setMessage('')
    setActiveTab('chat')
  }

  async function processCaption(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    let processed = trimmed
    let changed = false
    try {
      const res = await fetch(`${API}/api/captions/contextualize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, subject })
      })
      if (res.ok) {
        const result = await res.json()
        processed = result.caption || trimmed
        changed = processed !== trimmed
      }
    } catch { /* Use raw transcript if backend is temporarily unavailable. */ }
    const item: CaptionItem = { id: ++captionId.current, raw: trimmed, text: processed, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), changed }
    setCaptionItems(prev => [...prev.slice(-79), item])
    sendPacket({ type: 'caption', item })
  }

  function toggleRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setNotice('Live speech recognition is not supported by this browser. Try the latest Chrome or Edge.')
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
    recognition.onerror = (event: any) => { setNotice(`Speech recognition: ${event.error}. Check microphone permission and try again.`); setListening(false) }
    recognition.onend = () => setListening(false)
    recognition.onresult = (event: any) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' '
      }
      if (finalText.trim()) void processCaption(finalText)
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { setNotice('Could not start speech recognition. Try again.'); setListening(false) }
  }


  async function startSignCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSignStatus('Camera access is unavailable. Open this site on localhost or HTTPS and allow camera permission.')
      return
    }
    try {
      signStreamRef.current?.getTracks().forEach(track => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      signStreamRef.current = stream
      if (signVideoRef.current) {
        signVideoRef.current.srcObject = stream
        await signVideoRef.current.play()
      }
      setSignStatus('Camera ready. A trained sign-recognition model is still required before gestures can be translated automatically.')
    } catch (err) {
      setSignStatus('Could not access the camera. Check browser permission and close other apps using the camera.')
    }
  }

  function stopSignCamera() {
    signStreamRef.current?.getTracks().forEach(track => track.stop())
    signStreamRef.current = null
    if (signVideoRef.current) signVideoRef.current.srcObject = null
    setSignStatus('Sign camera stopped.')
  }

  function sendRecognizedSign() {
    const text = signText.trim()
    if (!text) {
      setSignStatus('Enter a verified sign-recognition result or a text gloss to test the teacher/student delivery path.')
      return
    }
    const item: ChatItem = {
      id: crypto.randomUUID(),
      sender: name,
      role,
      text: `[${signLanguage} sign → text] ${text}`,
      kind: 'student'
    }
    setChat(prev => [...prev, item])
    sendPacket({ type: 'classroom-message', item })
    setSignStatus(`Text sent to connected participants: "${text}". This tests delivery only, not automatic sign recognition.`)
    setSignText('')
    setActiveTab('chat')
  }

  async function copyInvite() {
    const invite = `${window.location.origin} — meeting code: ${roomName}`
    try { await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { setNotice(`Share meeting code: ${roomName}`) }
  }

  function drawRemote(x: number, y: number, color: string, start: boolean) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = color || '#6558e8'
    ctx.lineWidth = 3
    if (start) { ctx.beginPath(); ctx.moveTo(x, y) } else { ctx.lineTo(x, y); ctx.stroke() }
  }

  function clearBoard() {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    sendPacket({ type: 'classroom-message', item: { id: crypto.randomUUID(), sender: 'System', role: 'system', text: 'The shared board was cleared.', kind: 'draw' } })
  }

  const [drawing, setDrawing] = useState(false)
  function pointerPosition(e: any) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width), y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height) }
  }
  function startDraw(e: any) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const p = pointerPosition(e)
    ctx.strokeStyle = '#6558e8'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y)
    setDrawing(true); sendPacket({ type: 'board', x: p.x, y: p.y, color: '#6558e8', start: true })
  }
  function moveDraw(e: any) {
    if (!drawing || !canvasRef.current) return
    const p = pointerPosition(e)
    const ctx = canvasRef.current.getContext('2d')!
    ctx.lineTo(p.x, p.y); ctx.stroke()
    sendPacket({ type: 'board', x: p.x, y: p.y, color: '#6558e8', start: false })
  }

  const cameraCount = useMemo(() => tracks.length, [tracks.length])

  return <div className={highContrast ? "meeting-app high-contrast" : "meeting-app"}>
    <header className="meeting-header">
      <div className="brand"><span className="brand-mark"><Accessibility size={20}/></span><span>Access<span className="brand-accent">Class</span></span></div>
      <div className="meeting-meta"><span className="live-badge"><span className="status-dot"/> LIVE CLASS</span><span className="room-code">{roomName}</span><button className="icon-btn compact" title="Copy meeting code" onClick={copyInvite}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>
      <div className="user-chip"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span>{name}</span><span className="role-label">{role}</span></div>
    </header>
    <main className="meeting-layout">
      <section className="stage-column">
        <div className="stage-topline"><div><span className="green-dot"/> Secure classroom session</div><div className="stage-stats"><Users size={14}/> {cameraCount} camera track{cameraCount === 1 ? '' : 's'}</div></div>
        <div className="video-stage">
          <VideoConference />
        </div>
        <div className="call-controls">
          <div className="control-group"><button className="control-btn" onClick={() => void localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}><Mic size={18}/><span>{localParticipant.isMicrophoneEnabled ? 'Mute' : 'Unmute'}</span></button><button className="control-btn" onClick={() => void localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}><Video size={18}/><span>{localParticipant.isCameraEnabled ? 'Stop video' : 'Start video'}</span></button><button className="control-btn" onClick={() => setActiveTab('board')}><MonitorUp size={18}/><span>Whiteboard</span></button></div>
          <button className="leave-btn" onClick={onLeave}><PhoneIcon/> Leave</button>
        </div>
        <div className="caption-preview">
          <div className="caption-preview-head"><span><Captions size={16}/> LIVE CAPTIONS</span><div className={listening ? 'listening-pill active' : 'listening-pill'}><span/> {listening ? 'Listening' : 'Mic captions off'}</div></div>
          {captionEnabled && <div className="caption-preview-text" style={{ fontSize: `${Math.max(14, fontSize - 1)}px` }}>
            {captionItems.length ? captionItems.slice(-2).map(c => <p key={c.id}>{c.text}</p>) : <p className="caption-placeholder">Captions from the presenter will appear here. Start captioning to transcribe speech from this browser's microphone.</p>}
          </div>}
        </div>
      </section>
      <aside className="side-panel">
        <div className="side-tabs">
          <button className={activeTab === 'captions' ? 'side-tab active' : 'side-tab'} onClick={() => setActiveTab('captions')}><Captions size={16}/> Captions</button>
          <button className={activeTab === 'chat' ? 'side-tab active' : 'side-tab'} onClick={() => setActiveTab('chat')}><MessageCircle size={16}/> Chat</button>
          <button className={activeTab === 'board' ? 'side-tab active' : 'side-tab'} onClick={() => setActiveTab('board')}><PenLine size={16}/> Board</button>
          <button className={activeTab === 'signs' ? 'side-tab active' : 'side-tab'} onClick={() => setActiveTab('signs')}><Hand size={16}/> Signs</button>
        </div>
        {activeTab === 'captions' && <div className="panel-content">
          <div className="panel-title-row"><div><h3>Caption settings</h3><p>Make classroom text work for you.</p></div><Settings2 size={19}/></div>
          <div className="setting-card">
            <div className="setting-line"><span><Type size={16}/> Text size</span><b>{fontSize}px</b></div>
            <input aria-label="Caption font size" className="range" type="range" min="14" max="28" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}/>
            <div className="range-labels"><span>Small</span><span>Large</span></div>
          </div>
          <button className={highContrast ? 'setting-toggle selected' : 'setting-toggle'} onClick={() => setHighContrast(v => !v)}><span><Eye size={17}/> High contrast captions</span><span className="toggle-track"><i/></span></button>
          <button className={captionEnabled ? 'setting-toggle selected' : 'setting-toggle'} onClick={() => setCaptionEnabled(v => !v)}><span><Captions size={17}/> Show caption preview</span><span className="toggle-track"><i/></span></button>
          <div className="setting-card">
            <label>STEM subject context</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="general">General</option><option value="maths">Mathematics</option><option value="physics">Physics</option><option value="chemistry">Chemistry</option><option value="biology">Biology</option><option value="computer_science">Computer science</option>
            </select>
          </div>
          <div className="caption-actions">
            <button className={listening ? 'btn-primary listening' : 'btn-primary'} onClick={toggleRecognition}><Mic size={16}/>{listening ? 'Stop captioning' : 'Start live captioning'}</button>
            <p><CircleHelp size={14}/> Uses browser speech recognition. Captions may vary by browser and microphone.</p>
          </div>
          {notice && <div className="notice" role="status">{notice}</div>}
          <div className="transcript-list">
            <div className="transcript-heading"><h4>Transcript</h4><span>{captionItems.length} lines</span></div>
            {captionItems.length === 0 ? <div className="empty-state"><Captions size={24}/><p>Your live transcript will appear here.</p></div> : captionItems.slice().reverse().map(c => <div className="transcript-item" key={c.id}><time>{c.time}</time><p>{c.text}</p>{c.changed && <span className="context-tag">STEM context applied</span>}</div>)}
          </div>
        </div>}
        {activeTab === 'chat' && <div className="panel-content chat-panel">
          <div className="panel-title-row"><div><h3>Classroom messages</h3><p>Ask, answer, and participate.</p></div><MessageCircle size={19}/></div>
          <div className="chat-list">
            {chat.length === 0 ? <div className="empty-state"><MessageCircle size={24}/><p>No messages yet. Start the discussion.</p></div> : chat.map(item => <div className={`chat-message ${item.sender === name ? 'own' : ''}`} key={item.id}><div className="chat-avatar">{item.sender.slice(0,1).toUpperCase()}</div><div className="chat-bubble"><div className="chat-byline"><b>{item.sender}</b><span>{item.role}</span></div><p>{item.text}</p></div></div>)}
          </div>
          <form className="message-form" onSubmit={e => { e.preventDefault(); sendMessage() }}><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Send a message…" aria-label="Message" maxLength={1000}/><button aria-label="Send message"><Send size={17}/></button></form>
          <button className="student-question" onClick={() => { setMessage('I have a question about this concept: '); setActiveTab('chat') }}><Hand size={16}/> I have a question</button>
        </div>}
        {activeTab === 'signs' && <div className="panel-content signs-panel">
          <div className="panel-title-row"><div><h3>Sign language bridge</h3><p>Camera input and two-way message delivery.</p></div><Languages size={19}/></div>
          <div className="sign-direction">
            <button className={signDirection === 'student-to-teacher' ? 'direction-option active' : 'direction-option'} onClick={() => { setSignDirection('student-to-teacher'); setSignStatus('Student-to-teacher direction selected.') }}>Student → Teacher</button>
            <button className={signDirection === 'teacher-to-student' ? 'direction-option active' : 'direction-option'} onClick={() => { setSignDirection('teacher-to-student'); setSignStatus('Teacher-to-student direction selected.') }}>Teacher → Student</button>
          </div>
          <label className="sign-label">Sign language</label>
          <select value={signLanguage} onChange={e => setSignLanguage(e.target.value)} className="sign-select">
            <option value="ISL">Indian Sign Language (ISL)</option>
            <option value="ASL">American Sign Language (ASL)</option>
          </select>
          <div className="sign-camera-box">
            <video ref={signVideoRef} autoPlay playsInline muted aria-label="Local sign-language camera preview"/>
            {!signStreamRef.current && <div className="sign-camera-placeholder"><Camera size={28}/><span>Camera preview</span><small>Allow camera access to begin</small></div>}
          </div>
          <div className="sign-camera-actions">
            <button className="btn-secondary" onClick={() => void startSignCamera()}><Camera size={15}/> Start camera</button>
            <button className="btn-secondary" onClick={stopSignCamera}><X size={15}/> Stop</button>
          </div>
          <div className="sign-model-status"><span className="warning-dot"/><span><b>Recognition model not connected</b><small>MediaPipe tracks landmarks; a trained ISL/ASL model is needed to classify signs.</small></span></div>
          <label className="sign-label">Verified sign result / text gloss (demo)</label>
          <textarea className="sign-textarea" value={signText} onChange={e => setSignText(e.target.value)} placeholder="Type a recognized sign result, e.g. I have a question about photosynthesis." rows={3}/>
          <button className="btn-primary" onClick={sendRecognizedSign}><Send size={15}/> Send as caption/message</button>
          <p className="sign-status" role="status">{signStatus}</p>
          <div className="sign-note"><ScanFace size={15}/><span>Current implementation supports camera preview and tests message delivery. It does not yet infer signs from video. Direction selection is a UI mode; automatic teacher-to-student signing will require a signing avatar/video output or a separately defined translation pipeline.</span></div>
        </div>}
        {activeTab === 'board' && <div className="panel-content board-panel">
          <div className="panel-title-row"><div><h3>Shared whiteboard</h3><p>Draw a diagram or equation.</p></div><PenLine size={19}/></div>
          <div className="board-tools"><span><span className="purple-dot"/> Pen</span><button onClick={clearBoard}><X size={14}/> Clear board</button></div>
          <canvas ref={canvasRef} width={700} height={500} className="drawing-canvas" onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={() => setDrawing(false)} onPointerLeave={() => setDrawing(false)} aria-label="Shared drawing canvas"/>
          <p className="board-hint">Use your mouse, touchpad, or touchscreen to draw. Strokes are shared with participants currently connected.</p>
          <form className="message-form" onSubmit={e => { e.preventDefault(); sendMessage('draw') }}><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your diagram…" aria-label="Describe diagram"/><button aria-label="Send drawing description"><Send size={17}/></button></form>
        </div>}
      </aside>
    </main>
    <footer className="meeting-footer"><span>AccessClass <i>•</i> Accessible STEM learning</span><span><span className="green-dot"/> Connection managed by LiveKit</span></footer>
  </div>
}

function PhoneIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.68 2.8a2 2 0 0 1-.45 2.11L8.07 9.93a16 16 0 0 0 6 6l1.3-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.68A2 2 0 0 1 22 16.92z"/></svg>
}
