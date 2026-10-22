import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, ClipboardCheck,
  Clock3, Download, FileBarChart2, GraduationCap, LayoutDashboard, LockKeyhole, LogOut,
  Languages, Menu, Moon, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sun,
  UserRound, Users, X, XCircle,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://estgtss-api.onrender.com/api'
const levels = ['Level 3', 'Level 4', 'Level 5']
const trades = ['SOD', 'ELET']
const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Students', icon: Users },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Permissions', icon: ShieldCheck },
  { label: 'Behaviour', icon: Activity },
  { label: 'Reports', icon: FileBarChart2 },
  { label: 'Student Life', icon: GraduationCap },
]
const translations = {
  en: { Overview: 'Overview', Students: 'Students', Attendance: 'Attendance', Permissions: 'Permissions', Behaviour: 'Behaviour', Reports: 'Reports', 'Student Life': 'Student Life', Settings: 'Settings', 'Welcome back': 'Welcome back', 'Sign in': 'Sign in', 'School life': 'School life' },
  rw: { Overview: 'Incamake', Students: 'Abanyeshuri', Attendance: 'Abitabiriye', Permissions: 'Impushya', Behaviour: 'Imyitwarire', Reports: 'Raporo', 'Student Life': 'Ubuzima bw’abanyeshuri', Settings: 'Igenamiterere', 'Welcome back': 'Murakaza neza', 'Sign in': 'Injira', 'School life': 'Ubuzima bw’ishuri' },
  fr: { Overview: 'Aperçu', Students: 'Étudiants', Attendance: 'Présence', Permissions: 'Autorisations', Behaviour: 'Comportement', Reports: 'Rapports', 'Student Life': 'Vie étudiante', Settings: 'Paramètres', 'Welcome back': 'Bon retour', 'Sign in': 'Se connecter', 'School life': 'Vie scolaire' },
}
const translate = (language, text) => translations[language]?.[text] || text
const todayDate = new Date()
const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()

async function request(path, { token, ...options } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Can't reach the ESTG TSS services at ${API_URL}. Check your internet connection. If you're online, ask the administrator to check the API and database. Student records are not available offline.`)
    }
    throw error
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}

function ClassFields({ values, onChange, classes }) {
  const classNames = classes
    .filter((item) => item.level === values.level && item.trade === values.trade)
    .map((item) => item.class_name)
  return (
    <div className="field-grid three">
      <label>Level
        <select required value={values.level || ''} onChange={(event) => onChange({ ...values, level: event.target.value, trade: '', className: '' })}>
          <option value="">Select level</option>{levels.map((level) => <option key={level}>{level}</option>)}
        </select>
      </label>
      <label>Trade
        <select required value={values.trade || ''} disabled={!values.level} onChange={(event) => onChange({ ...values, trade: event.target.value, className: '' })}>
          <option value="">Select trade</option>{trades.map((trade) => <option key={trade}>{trade}</option>)}
        </select>
      </label>
      <label>Class
        <select required value={values.className || ''} disabled={!values.trade} onChange={(event) => onChange({ ...values, className: event.target.value })}>
          <option value="">Select class</option>{classNames.map((className) => <option key={className}>{className}</option>)}
        </select>
      </label>
    </div>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('patron_token') || '')
  const [language, setLanguage] = useState(() => localStorage.getItem('estg_language') || 'en')
  const [theme, setTheme] = useState(() => localStorage.getItem('estg_theme') || 'day')
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('Overview')
  const [students, setStudents] = useState([])
  const [schoolClasses, setSchoolClasses] = useState([])
  const [attendance, setAttendance] = useState([])
  const [permissions, setPermissions] = useState([])
  const [behaviour, setBehaviour] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!token) return
    setBusy(true)
    try {
      const [me, studentData, classData, attendanceData, permissionData, behaviourData, summary] = await Promise.all([
        request('/auth/me', { token }),
        request('/students', { token }),
        request('/classes', { token }),
        request(`/attendance?date=${today}`, { token }),
        request('/permissions', { token }),
        request('/behaviour', { token }),
        request(`/dashboard?date=${today}`, { token }),
      ])
      setUser(me.user)
      setStudents(studentData.students)
      setSchoolClasses(classData.classes)
      setAttendance(attendanceData.records)
      setPermissions(permissionData.permissions)
      setBehaviour(behaviourData.records)
      setDashboard(summary)
      setError('')
    } catch (requestError) {
      if (requestError.message.toLowerCase().includes('token') ||
          requestError.message.toLowerCase().includes('session') ||
          requestError.message.toLowerCase().includes('authentication')) {
        localStorage.removeItem('patron_token')
        setToken('')
        setUser(null)
      } else setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }, [token])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timeout)
  }, [refresh])
  useEffect(() => {
    if (!notice && !error) return undefined
    const timeout = window.setTimeout(() => { setNotice(''); setError('') }, 4200)
    return () => window.clearTimeout(timeout)
  }, [notice, error])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? students.filter((student) =>
      `${student.full_name} ${student.student_number} ${student.level} ${student.trade} ${student.class_name}`.toLowerCase().includes(query),
    ) : students
  }, [search, students])

  async function mutate(path, method, body, success) {
    try {
      await request(path, { token, method, body: JSON.stringify(body) })
      await refresh()
      setNotice(success)
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    }
  }

  function logout() {
    localStorage.removeItem('patron_token')
    setToken('')
    setUser(null)
  }

  function updateLanguage(value) {
    localStorage.setItem('estg_language', value)
    setLanguage(value)
  }

  function toggleTheme() {
    const nextTheme = theme === 'day' ? 'night' : 'day'
    localStorage.setItem('estg_theme', nextTheme)
    setTheme(nextTheme)
  }

  if (!token) return <Login language={language} onLanguageChange={updateLanguage} onLogin={(newToken) => { localStorage.setItem('patron_token', newToken); setToken(newToken) }} />

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><GraduationCap size={23} /></span>
          <span><strong>ESTG TSS</strong><small>Patron workspace</small></span>
        </a>
        <div className="nav-label">{translate(language, 'School life').toUpperCase()}</div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setMenuOpen(false) }}>
              <Icon size={18} strokeWidth={1.8} /><span>{translate(language, label)}</span>
              {label === 'Permissions' && permissions.filter((item) => item.status === 'Pending').length > 0 &&
                <span className="nav-count">{permissions.filter((item) => item.status === 'Pending').length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-link ${page === 'Settings' ? 'active' : ''}`} onClick={() => { setPage('Settings'); setMenuOpen(false) }}><Settings size={18} /><span>{translate(language, 'Settings')}</span></button>
          <div className="sidebar-profile">
            <div className="avatar">{user?.name?.[0] || 'P'}</div>
            <div className="profile-copy"><strong>{user?.name || 'Patron'}</strong><small>{user?.role || 'Staff'}</small></div>
            <button className="icon-button logout-button" aria-label="Log out" onClick={logout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <main className="main-panel">
        {menuOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />}
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
          <div className="breadcrumb">ESTG TSS <ChevronRight size={15} /> <strong>{translate(language, page)}</strong></div>
          <div className="top-actions">
            <label className="language-picker" aria-label="Choose language"><Languages size={15} /><select value={language} onChange={(event) => updateLanguage(event.target.value)}><option value="en">English</option><option value="rw">Kinyarwanda</option><option value="fr">Français</option></select></label>
            <button className="icon-button" aria-label={theme === 'day' ? 'Switch to night mode' : 'Switch to day mode'} title={theme === 'day' ? 'Night mode' : 'Day mode'} onClick={toggleTheme}>{theme === 'day' ? <Moon size={17} /> : <Sun size={17} />}</button>
            <div className="global-search-wrap"><label className="global-search"><Search size={17} /><input placeholder="Search students..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>{search.trim() && <div className="global-results" role="listbox">{filteredStudents.slice(0, 6).map((student) => <button key={student.id} role="option" onClick={() => { setSelectedStudentId(student.id); setSearch('') }}><span className="avatar">{student.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{student.full_name}</strong><small>{student.student_number} · {student.level} · {student.trade} {student.class_name}</small></span></button>)}{!filteredStudents.length && <p>No matching students.</p>}</div>}</div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="top-user"><div className="avatar">{user?.name?.[0] || 'P'}</div><span>{user?.name || 'Patron'}<small>{user?.role || 'Staff'}</small></span><ChevronDown size={15} /></div>
          </div>
        </header>
        <div className="page-content">
          {error && <div className="toast error-toast" role="alert"><XCircle size={18} />{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
          {notice && <div className="toast success-toast" role="status"><Check size={18} />{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}
          {busy && <div className="loading-line" />}
          {page === 'Overview' && <Dashboard dashboard={dashboard} students={students} attendance={attendance} permissions={permissions} behaviour={behaviour} setPage={setPage} />}
          {page === 'Students' && <StudentsPage students={filteredStudents} classes={schoolClasses} onOpenProfile={setSelectedStudentId} readOnly={user?.role === 'Read-only Staff'} onCreate={(body) => mutate('/students', 'POST', body, 'Student registered successfully.')} onUpdate={(id, body) => mutate(`/students/${id}`, 'PATCH', body, 'Student details updated.')} />}
          {page === 'Attendance' && <AttendancePage token={token} students={students} classes={schoolClasses} permissions={permissions} readOnly={user?.role === 'Read-only Staff'} onSaved={refresh} notify={setNotice} reportError={setError} />}
          {page === 'Permissions' && <PermissionsPage token={token} students={students} classes={schoolClasses} permissions={permissions} onRefresh={refresh} notify={setNotice} reportError={setError} user={user} />}
          {page === 'Behaviour' && <BehaviourPage token={token} user={user} students={students} records={behaviour} onCreate={(body) => mutate('/behaviour', 'POST', body, 'Behaviour record saved.')} onRefresh={refresh} notify={setNotice} reportError={setError} readOnly={user?.role === 'Read-only Staff'} />}
          {page === 'Reports' && <ReportsPage token={token} students={students} classes={schoolClasses} attendance={attendance} permissions={permissions} behaviour={behaviour} />}
          {page === 'Settings' && <SettingsPage token={token} user={user} classes={schoolClasses} onCreateClass={(body) => mutate('/classes', 'POST', body, 'School class added.')} reportError={setError} notify={setNotice} />}
          {page === 'Student Life' && <StudentLifePage token={token} user={user} reportError={setError} notify={setNotice} />}
        </div>
      </main>
      {selectedStudentId && <StudentProfile token={token} studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />}
    </div>
  )
}

function StudentLifePage({ token, user, reportError, notify }) {
  const [posts, setPosts] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [media, setMedia] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const canPublish = user?.role === 'Administrator'
  useEffect(() => {
    let cancelled = false
    request('/school-life/posts', { token })
      .then((data) => { if (!cancelled) setPosts(data.posts) })
      .catch((error) => { if (!cancelled) reportError(error.message) })
    return () => { cancelled = true }
  }, [token, reportError])

  async function publish(event) {
    event.preventDefault()
    if (!media) {
      reportError('Choose an image or video to publish.')
      return
    }
    setPublishing(true)
    const formElement = event.currentTarget
    try {
      const mediaData = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('The selected media could not be read.'))
        reader.readAsDataURL(media)
      })
      const result = await request('/school-life/posts', {
        token,
        method: 'POST',
        body: JSON.stringify({ title, description, mediaData, mediaType: media.type }),
      })
      setPosts((current) => [result.post, ...current])
      setTitle('')
      setDescription('')
      setMedia(null)
      formElement.reset()
      notify('Your post is now visible to everyone using the site.')
    } catch (error) {
      reportError(error.message)
    } finally {
      setPublishing(false)
    }
  }

  const clubs = [
    { name: 'ICT & Innovation Club', focus: 'Technology, coding, and creative problem-solving', description: 'Students explore digital skills through practical projects, peer learning, and building useful ideas together.' },
    { name: 'Creative Arts & Culture Club', focus: 'Art, music, performance, and cultural exchange', description: 'A welcoming place to share creative talents, celebrate Rwandan culture, and collaborate on school performances and exhibitions.' },
  ]
  return <>
    <PageHeading eyebrow="ESTG COMMUNITY" title="Student Life" description="Discover clubs, celebrate student activities, and keep up with school news." />
    <section className="student-life-intro panel">
      <div><span className="eyebrow">A PLACE TO BELONG</span><h2>Learn beyond the classroom.</h2><p>Join a club, share your ideas, and take part in the experiences that make school life memorable.</p></div>
      <div className="club-grid">{clubs.map((club) => <article className="club-card" key={club.name}><div className="club-card-icon"><Users size={20} /></div><h3>{club.name}</h3><strong>{club.focus}</strong><p>{club.description}</p></article>)}</div>
    </section>
    {canPublish && <section className="panel student-life-publisher"><div className="panel-heading"><div><h2>Publish to the school community</h2><p>Posts are shared with everyone who visits Student Life; you can stay signed in while managing the site.</p></div><ShieldCheck size={19} /></div><form className="post-form" onSubmit={publish}><div className="field-grid two"><label>Post title<input required maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A short, clear title" /></label><label>Photo or video<input required type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(event) => { const selected = event.target.files?.[0]; if (selected && selected.size > 8 * 1024 * 1024) { reportError('Choose a media file smaller than 8 MB.'); event.target.value = ''; setMedia(null); return } setMedia(selected || null) }} /></label></div><label>What is happening?<textarea required maxLength="2000" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a short description for students and staff." /></label><button className="primary-button" disabled={publishing || !media}>{publishing ? 'Publishing…' : 'Publish for everyone'}<ArrowUpRight size={15} /></button></form></section>}
    <section className="community-posts"><div className="section-title"><div><h2>From our community</h2><p>Photos and videos published by ESTG administrators.</p></div></div>{posts.length ? <div className="post-grid">{posts.map((post) => <article className="panel community-post" key={post.id}>{post.media_type.startsWith('video/') ? <video controls preload="metadata" src={post.media_data} /> : <img src={post.media_data} alt={post.title} loading="lazy" />}<div className="community-post-copy"><small>{post.author_name} · {new Date(post.created_at).toLocaleDateString()}</small><h3>{post.title}</h3><p>{post.description}</p></div></article>)}</div> : <EmptyState message="School news and activities will appear here when shared." />}</section>
    <footer className="student-life-footer"><span>ESTG TSS · Growing together</span><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Open Instagram"><InstagramLogo /><span>Instagram</span></a></footer>
  </>
}

function InstagramLogo() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>
}

function Login({ onLogin, language, onLanguageChange }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [latestPosts, setLatestPosts] = useState([])
  const [postsError, setPostsError] = useState('')
  useEffect(() => {
    let cancelled = false
    request('/school-life/posts?limit=2')
      .then((data) => { if (!cancelled) setLatestPosts(data.posts) })
      .catch((feedError) => { if (!cancelled) setPostsError(feedError.message) })
    return () => { cancelled = true }
  }, [])
  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      onLogin(result.token)
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <main className="login-page">
      <div className="login-card">
        <label className="login-language-picker">Language<select value={language} onChange={(event) => onLanguageChange(event.target.value)}><option value="en">English</option><option value="rw">Kinyarwanda</option><option value="fr">Français</option></select></label>
        <div className="login-logo"><GraduationCap size={27} /></div>
        <p className="eyebrow">ESTG TSS · {translate(language, 'School life').toUpperCase()}</p>
        <h1>{translate(language, 'Welcome back')}</h1>
        <p className="login-subtitle">Sign in to manage your school community.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label>Email / username<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Email or username" /></label>
          <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
          <button className="primary-button full-button" disabled={loading}>{loading ? 'Signing in...' : translate(language, 'Sign in')}<ArrowUpRight size={17} /></button>
        </form>
        <p className="login-footnote">Sign in with the account provided by your school. Never share your password.</p>
      </div>
      <div className="login-decoration"><span>01 / ESTG STUDENT LIFE</span><strong>Every student<br />seen. Every day.</strong><p>A welcoming school community for learning, creativity, and shared experiences.</p><div className="login-club-preview"><span>ICT & Innovation Club</span><span>Creative Arts & Culture Club</span></div>{postsError && <p className="login-feed-error" role="status">School updates are temporarily unavailable. {postsError}</p>}{latestPosts.length > 0 && <div className="login-post-preview"><span>Latest from ESTG</span>{latestPosts.map((post) => <article key={post.id}>{post.media_type.startsWith('video/') ? <video muted playsInline preload="metadata" src={post.media_data} /> : <img src={post.media_data} alt="" loading="lazy" />}<strong>{post.title}</strong><small>{post.description}</small></article>)}</div>}<div className="decoration-line" /></div>
    </main>
  )
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow === 'THURSDAY, {DATE}' ? todayLabel : eyebrow}</p><h1>{title}</h1><p className="heading-description">{description}</p></div>{action}</div>
}

function Dashboard({ dashboard, students, attendance, permissions, setPage }) {
  const metrics = [
    { title: 'Registered students', value: dashboard?.totalStudents ?? students.length, meta: 'Active across all classes', icon: Users, tone: 'violet' },
    { title: 'Present today', value: dashboard?.present ?? attendance.filter((row) => row.status === 'Present').length, meta: `${dashboard?.attendanceRate ?? 0}% attendance rate`, icon: Check, tone: 'green' },
    { title: 'Absent today', value: dashboard?.absent ?? attendance.filter((row) => row.status === 'Absent').length, meta: 'Needs follow-up', icon: XCircle, tone: 'rose' },
    { title: 'Authorized away', value: dashboard?.away ?? permissions.filter((item) => item.status === 'Departed').length, meta: 'Approved leave in progress', icon: ArrowUpRight, tone: 'blue' },
    { title: 'Pending permissions', value: dashboard?.pending ?? permissions.filter((item) => item.status === 'Pending').length, meta: 'Awaiting an authorized decision', icon: Clock3, tone: 'violet' },
    { title: 'Students with incidents', value: dashboard?.disciplineStudents ?? 0, meta: 'Students with behaviour history', icon: Activity, tone: 'rose' },
  ]
  const chartData = dashboard?.weeklyAttendance || []
  const outstanding = permissions.filter((item) => ['Pending', 'Departed'].includes(item.status)).slice(0, 4)
  const leaderboard = [...students].map((student) => ({
    ...student,
    points: Number(student.points || 0),
  })).sort((a, b) => b.points - a.points).slice(0, 4)
  return (
    <>
      <PageHeading eyebrow="THURSDAY, {DATE}" title="Good morning" description="Here’s what’s happening across your school today." action={<button className="secondary-button" onClick={() => setPage('Reports')}><CalendarDays size={16} />Today’s overview</button>} />
      <div className="metric-grid">{metrics.map(({ title, value, meta, icon: Icon, tone }) => <article className="metric-card" key={title}><div className={`metric-icon ${tone}`}><Icon size={18} /></div><p>{title}</p><strong>{value}</strong><small>{meta}</small></article>)}</div>
      <div className="dashboard-grid">
        <section className="panel attendance-panel">
          <div className="panel-heading"><div><h2>Attendance overview</h2><p>Daily attendance over the last 7 days</p></div><button className="text-button" onClick={() => setPage('Attendance')}>Take attendance <ArrowUpRight size={15} /></button></div>
          <div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 14, right: 6, left: -22, bottom: 0 }}><defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5363db" stopOpacity={0.18} /><stop offset="95%" stopColor="#5363db" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eef0f5" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9299aa', fontSize: 11 }} dy={10} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#9299aa', fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => [`${value}%`, 'Attendance']} /><Area type="monotone" dataKey="rate" stroke="#5363db" strokeWidth={2.5} fill="url(#attendanceFill)" /></AreaChart></ResponsiveContainer> : <EmptyState message="Attendance trends will appear here after roll call." />}</div>
          <div className="chart-legend"><span><i className="legend-dot present-dot" />Present</span><span><i className="legend-dot absent-dot" />Absent</span><span><i className="legend-dot away-dot" />Authorized away</span></div>
        </section>
        <section className="panel permission-panel">
          <div className="panel-heading"><div><h2>Needs your attention</h2><p>Permission requests and active leave</p></div><button className="icon-button" aria-label="Open permissions" onClick={() => setPage('Permissions')}><ArrowUpRight size={17} /></button></div>
          {outstanding.length ? outstanding.map((item) => <div className="attention-row" key={item.id}><div className={`attention-icon ${item.status === 'Departed' ? 'away' : 'pending'}`}>{item.status === 'Departed' ? <ArrowUpRight size={16} /> : <Clock3 size={16} />}</div><div><strong>{item.full_name}</strong><small>{item.status === 'Departed' ? 'Currently away' : `Permission pending · ${item.class_name}`}</small></div><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span></div>) : <EmptyState message="You’re all caught up." />}
          <button className="panel-footer-button" onClick={() => setPage('Permissions')}>View all permissions <ChevronRight size={15} /></button>
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel class-panel"><div className="panel-heading"><div><h2>Class attendance</h2><p>Today across your classes</p></div><button className="text-button" onClick={() => setPage('Attendance')}>View all <ArrowUpRight size={15} /></button></div>
          {dashboard?.classes?.length ? dashboard.classes.slice(0, 4).map((item) => <div className="class-row" key={`${item.level}-${item.trade}-${item.class_name}`}><div className="class-badge">{item.level.replace('Level ', 'L')}</div><div className="class-info"><strong>{item.trade} · {item.class_name}</strong><small>{item.present} of {item.total} students present</small></div><div className="progress-track"><span style={{ width: `${item.total ? item.present / item.total * 100 : 0}%` }} /></div><strong className="class-rate">{item.total ? Math.round(item.present / item.total * 100) : 0}%</strong></div>) : <EmptyState message="Class summaries appear once attendance is recorded." />}
        </section>
        <section className="panel points-panel"><div className="panel-heading"><div><h2>Positive momentum</h2><p>Students earning recognition</p></div><button className="icon-button" aria-label="Open behaviour records" onClick={() => setPage('Behaviour')}><ArrowUpRight size={17} /></button></div>
          {leaderboard.length ? leaderboard.map((student, index) => <div className="leader-row" key={student.id}><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><div className="avatar student-avatar">{student.full_name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="leader-name"><strong>{student.full_name}</strong><small>{student.level} · {student.trade}</small></div><span className="points">{student.points}<small> pts</small></span></div>) : <EmptyState message="Positive behaviour records will appear here." />}
        </section>
      </div>
    </>
  )
}

function EmptyState({ message }) {
  return <div className="empty-state"><span><BookOpen size={18} /></span><p>{message}</p></div>
}

function StudentProfile({ token, studentId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('Personal Information')
  useEffect(() => {
    let cancelled = false
    request(`/students/${studentId}/profile`, { token })
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch((requestError) => { if (!cancelled) setError(requestError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [studentId, token])
  const attendanceSummary = profile?.attendance.reduce((summary, item) => {
    summary[item.status] = (summary[item.status] || 0) + 1
    return summary
  }, {}) || {}
  const tabs = ['Personal Information', 'Attendance', 'Permissions', 'Discipline', 'Behaviour Points', 'Reports']
  return <Modal title={profile?.student.full_name || 'Student profile'} onClose={onClose}>
    {loading ? <EmptyState message="Loading student profile..." /> : error ? <div className="profile-error" role="alert">{error}</div> : profile && <>
      <div className="profile-banner"><div className="avatar profile-avatar">{profile.student.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><h3>{profile.student.full_name}</h3><p>{profile.student.student_number} · {profile.student.level} · {profile.student.trade} · {profile.student.class_name}</p></div><span className={`status-pill ${profile.student.status.toLowerCase()}`}>{profile.student.status}</span></div>
      <div className="profile-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className="profile-content">
        {tab === 'Personal Information' && <div className="profile-details">{[['Student ID', profile.student.student_number], ['Gender', profile.student.gender || 'Not specified'], ['Student type', profile.student.student_type], ['Accommodation', profile.student.residence_type], ['Level', profile.student.level], ['Trade', profile.student.trade], ['Class', profile.student.class_name], ['Guardian contact', profile.student.guardian_contact || 'Not provided'], ['Registered', new Date(profile.student.registered_at).toLocaleDateString()]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}
        {tab === 'Attendance' && <><div className="profile-summary">{['Present', 'Absent', 'Late', 'Authorized Away', 'Not Marked'].map((status) => <div key={status}><StatusBadge status={status} /><strong>{attendanceSummary[status] || 0}</strong></div>)}</div><div className="profile-record-list">{profile.attendance.map((item, index) => <div key={`${item.date}-${index}`}><span>{String(item.date).slice(0, 10)}</span><StatusBadge status={item.status} /><small>{item.recorded_by} · {formatDateTime(item.updated_at)}</small></div>)}{!profile.attendance.length && <EmptyState message="No attendance saved for this student." />}</div></>}
        {tab === 'Permissions' && <div className="profile-record-list">{profile.permissions.map((item) => <div key={item.id}><span>{item.reason}<small>Destination: {item.destination || 'Not provided'} · Notes: {item.notes || 'None'}</small></span><StatusBadge status={item.status} /><small>Requested by {item.requested_by} · recorded {formatDateTime(item.created_at)} · scheduled departure {formatDateTime(item.departure_at)} · actual departure {formatDateTime(item.actual_departure_at)} · expected return {formatDateTime(item.expected_return_at)} · actual return {formatDateTime(item.actual_return_at)} · approved by {item.approved_by || '—'}{item.approved_at ? ` at ${formatDateTime(item.approved_at)}` : ''}</small></div>)}{!profile.permissions.length && <EmptyState message="No permission records for this student." />}</div>}
        {tab === 'Discipline' && <div className="profile-record-list">{profile.behaviour.filter((item) => item.kind === 'Incident').map((item) => <div key={item.id}><span>{item.category}<small>{item.description}</small></span><span className="negative-points">{item.points} points</span><small>{item.severity} · {item.recorded_by} · {formatDateTime(item.created_at)}</small></div>)}{!profile.behaviour.some((item) => item.kind === 'Incident') && <EmptyState message="No disciplinary incidents recorded." />}</div>}
        {tab === 'Behaviour Points' && <><div className="point-balance"><span>Current behaviour balance</span><strong>{profile.student.points} <small>points</small></strong></div><div className="profile-record-list">{profile.behaviour.map((item) => <div key={item.id}><span>{item.category}<small>{item.description}</small></span><strong className={item.points > 0 ? 'positive-points' : 'negative-points'}>{item.points > 0 ? '+' : ''}{item.points}</strong><small>{item.recorded_by} · {formatDateTime(item.created_at)}</small></div>)}{!profile.behaviour.length && <EmptyState message="No behaviour points recorded." />}</div></>}
        {tab === 'Reports' && <div className="profile-report-summary"><div><span>Attendance records</span><strong>{profile.attendance.length}</strong></div><div><span>Permissions</span><strong>{profile.permissions.length}</strong></div><div><span>Discipline incidents</span><strong>{profile.behaviour.filter((item) => item.kind === 'Incident').length}</strong></div><div><span>Behaviour points</span><strong>{profile.student.points}</strong></div></div>}
      </div>
    </>}
  </Modal>
}

function StudentsPage({ students, classes, readOnly, onOpenProfile, onCreate, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ level: '', trade: '', className: '' })
  const [form, setForm] = useState({ student_number: '', full_name: '', gender: '', student_type: 'Internal', residence_type: 'Boarding', level: '', trade: '', className: '', guardian_contact: '', status: 'Active' })
  const rows = students.filter((student) =>
    (!filters.level || student.level === filters.level) &&
    (!filters.trade || student.trade === filters.trade) &&
    (!filters.className || student.class_name === filters.className) &&
    (!query || `${student.full_name} ${student.student_number}`.toLowerCase().includes(query.toLowerCase())),
  )
  function openForm(student = null) {
    setEditing(student)
    setForm(student ? { ...student, student_type: student.student_type || 'Internal', residence_type: student.residence_type || 'Boarding', className: student.class_name } : { student_number: '', full_name: '', gender: '', student_type: 'Internal', residence_type: 'Boarding', level: '', trade: '', className: '', guardian_contact: '', status: 'Active' })
    setShowForm(true)
  }
  async function submit(event) {
    event.preventDefault()
    const saved = editing ? await onUpdate(editing.id, form) : await onCreate(form)
    if (saved) setShowForm(false)
  }
  return <>
    <PageHeading eyebrow="STUDENT DIRECTORY" title="Students" description={`${students.length} registered ${students.length === 1 ? 'student' : 'students'} · Manage student details and class placements.`} action={!readOnly && <button className="primary-button" onClick={() => openForm()}><Plus size={17} />Register student</button>} />
    <section className="panel table-panel">
      <div className="table-toolbar"><label className="table-search"><Search size={16} /><input placeholder="Search by name or student ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filter-group"><SlidersHorizontal size={15} />{['level', 'trade', 'className'].map((key) => <select key={key} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}><option value="">{key === 'className' ? 'All classes' : `All ${key === 'level' ? 'levels' : 'trades'}`}</option>{(key === 'level' ? levels : key === 'trade' ? trades : ['Class A', 'Class B']).map((value) => <option key={value}>{value}</option>)}</select>)}</div></div>
      <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>LEVEL / TRADE</th><th>CLASS</th><th>STUDENT TYPE</th><th>ACCOMMODATION</th><th>GENDER</th><th>STATUS</th><th /></tr></thead><tbody>
        {rows.map((student, index) => <tr key={student.id}><td><button className="student-cell student-profile-link" onClick={() => onOpenProfile(student.id)}><span className={`avatar avatar-color-${index % 4}`}>{student.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{student.full_name}</strong></button></td><td className="muted-cell">{student.student_number}</td><td><strong>{student.level}</strong><small className="sub-cell">{student.trade}</small></td><td>{student.class_name}</td><td>{student.student_type}</td><td>{student.residence_type}</td><td>{student.gender || '—'}</td><td><span className={`status-pill ${student.status?.toLowerCase()}`}>{student.status}</span></td><td>{!readOnly && <button className="row-action" onClick={() => openForm(student)}>Edit</button>}</td></tr>)}
      </tbody></table></div>
      {!rows.length && <EmptyState message="No students found. Register your first student to get started." />}
      <div className="table-bottom"><span>Showing {rows.length} of {students.length} students</span><div><button className="icon-button" aria-label="Previous page" disabled><ChevronLeft size={16} /></button><button className="page-number">1</button><button className="icon-button" aria-label="Next page" disabled><ChevronRight size={16} /></button></div></div>
    </section>
    {showForm && <Modal title={editing ? 'Update student' : 'Register student'} onClose={() => setShowForm(false)}><form onSubmit={submit} className="modal-form">
      <div className="field-grid two"><label>Student ID<input required value={form.student_number} onChange={(event) => setForm({ ...form, student_number: event.target.value })} placeholder="e.g. ST-2025-001" /></label><label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="Student's full name" /></label></div>
      <ClassFields values={form} onChange={setForm} classes={classes} />
      <div className="field-grid two"><label>Student type<select required value={form.student_type} onChange={(event) => setForm({ ...form, student_type: event.target.value })}><option>Internal</option><option>External</option></select></label><label>Accommodation<select required value={form.residence_type} onChange={(event) => setForm({ ...form, residence_type: event.target.value })}><option>Boarding</option><option>Day Scholar</option></select></label></div>
      <div className="field-grid two"><label>Gender<select value={form.gender || ''} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Other</option></select></label><label>Guardian contact<input value={form.guardian_contact || ''} onChange={(event) => setForm({ ...form, guardian_contact: event.target.value })} placeholder="Phone number (optional)" /></label></div>
      {editing && <label>Student status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Transferred</option><option>Inactive</option></select></label>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">{editing ? 'Save changes' : 'Register student'}</button></div>
    </form></Modal>}
  </>
}

function AttendancePage({ token, students, classes, permissions, readOnly, onSaved, notify, reportError }) {
  const [filters, setFilters] = useState({ date: today, level: '', trade: '', className: '' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState(0)
  const [correctionReason, setCorrectionReason] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)
  const attendanceKey = [filters.date, filters.level, filters.trade, filters.className].join('|')
  const allClassStudents = useMemo(() => students.filter((student) =>
    student.status === 'Active' && student.level === filters.level &&
    student.trade === filters.trade && student.class_name === filters.className,
  ), [students, filters.level, filters.trade, filters.className])
  const classStudents = useMemo(() => allClassStudents.filter((student) =>
    student.student_type === 'Internal' && student.residence_type === 'Boarding',
  ), [allClassStudents])
  useEffect(() => {
    if (!filters.level || !filters.trade || !filters.className) return undefined
    let cancelled = false
    const loadingTimer = window.setTimeout(() => setLoading(true), 0)
    request(`/attendance?date=${filters.date}&level=${encodeURIComponent(filters.level)}&trade=${encodeURIComponent(filters.trade)}&class=${encodeURIComponent(filters.className)}`, { token })
      .then((data) => {
        if (!cancelled) {
          const existing = new Map(data.records.map((row) => [String(row.student_id), row.status]))
          const savedSession = data.session || data.records[0] || null
          setSessionInfo(savedSession ? { ...savedSession, attendanceKey } : null)
          setRows(classStudents.map((student) => {
            const dayPermissions = permissions.filter((permission) =>
              String(permission.student_id) === String(student.id) &&
              (
                (['Departed', 'Returned'].includes(permission.status) &&
                  String(permission.actual_departure_at || '').slice(0, 10) === filters.date) ||
                (permission.status === 'Approved' &&
                  String(permission.departure_at).slice(0, 10) === filters.date &&
                  Date.parse(permission.departure_at) <= Date.now())
              ),
            )
            return { ...student, status: existing.get(String(student.id)) || (dayPermissions.length ? 'Authorized Away' : 'Not Marked') }
          }))
          setActive(0)
        }
      })
      .catch((error) => { if (!cancelled) reportError(error.message) })
      .finally(() => { window.clearTimeout(loadingTimer); if (!cancelled) setLoading(false) })
    return () => { cancelled = true; window.clearTimeout(loadingTimer) }
  }, [token, filters.date, filters.level, filters.trade, filters.className, attendanceKey, classStudents, permissions, reportError])
  const counts = ['Present', 'Absent', 'Late', 'Authorized Away', 'Not Marked'].map((status) => ({ status, count: rows.filter((row) => row.status === status).length }))
  function setStatus(id, status) { setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row)) }
  async function save() {
    setSaving(true)
    try {
      const saved = await request('/attendance', { token, method: 'POST', body: JSON.stringify({ date: filters.date, level: filters.level, trade: filters.trade, className: filters.className, reason: correctionReason, records: rows.map(({ id, status }) => ({ studentId: id, status })) }) })
      setSessionInfo({ date: filters.date, saved_at: saved.savedAt, saved_by: saved.savedBy, attendanceKey })
      notify('Attendance saved. Students not yet called remain Not Marked.')
      setCorrectionReason('')
      await onSaved()
    } catch (error) {
      reportError(error.message)
    } finally { setSaving(false) }
  }
  const current = rows[active]
  const currentSessionInfo = sessionInfo?.attendanceKey === attendanceKey ? sessionInfo : null
  const attendanceDateLabel = new Date(`${filters.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hasAttendanceMark = rows.some((row) => row.status !== 'Not Marked')
  const noAttendanceMessage = filters.date < today
    ? `No attendance was recorded for ${attendanceDateLabel}. Marking attendance now will create the register for that date.`
    : filters.date === today
      ? 'Attendance has not been saved for this class today. Uncalled students remain Not Marked.'
      : `Attendance has not been saved for ${attendanceDateLabel}.`
  return <>
    <PageHeading eyebrow="DAILY ROLL CALL" title="Attendance" description="Call names, mark each student, and save the class register." action={<button className="secondary-button" onClick={() => window.print()}><Download size={16} />Print register</button>} />
    <section className="panel attendance-filters">
      <label>Date<input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
      <ClassFields values={filters} onChange={(next) => setFilters({ ...next, date: filters.date })} classes={classes} />
      <div className="attendance-totals">{counts.map(({ status, count }) => <div key={status}><span className={`status-dot ${status.toLowerCase().replaceAll(' ', '-')}`} />{status}<strong>{count}</strong></div>)}</div>
    </section>
    {!filters.className ? <section className="panel attendance-empty"><div className="empty-icon"><ClipboardCheck size={24} /></div><h2>Choose a class to begin</h2><p>Select a level, trade, and class to load its active student register.</p></section>
      : <div className="attendance-layout"><section className="panel rollcall-panel">
        <div className={`attendance-save-status ${currentSessionInfo ? 'saved' : 'not-saved'}`} role="status"><strong>{currentSessionInfo ? `Attendance recorded for ${attendanceDateLabel}.` : noAttendanceMessage}</strong>{currentSessionInfo ? <span>Saved by {currentSessionInfo.saved_by} at {formatDateTime(currentSessionInfo.saved_at)}.</span> : !hasAttendanceMark && !readOnly && <span>Mark students Present, Absent, Late, or Authorized Away to start the register.</span>}</div>
        {loading ? <EmptyState message="Loading class register..." /> : <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>ATTENDANCE</th><th>MARK</th></tr></thead><tbody>{rows.map((student, index) => <tr key={student.id} className={active === index ? 'current-student' : ''}><td><button className="student-name-button" onClick={() => setActive(index)}><span className={`avatar avatar-color-${index % 4}`}>{student.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>{student.full_name}</button></td><td className="muted-cell">{student.student_number}</td><td><StatusBadge status={student.status} /></td><td><div className="attendance-buttons"><button disabled={readOnly} title="Mark present" aria-label={`Mark ${student.full_name} present`} className={student.status === 'Present' ? 'selected-present' : ''} onClick={() => { setStatus(student.id, 'Present'); setActive(index) }}><Check size={16} /></button><button disabled={readOnly} title="Mark absent" aria-label={`Mark ${student.full_name} absent`} className={student.status === 'Absent' ? 'selected-absent' : ''} onClick={() => { setStatus(student.id, 'Absent'); setActive(index) }}><X size={16} /></button><button disabled={readOnly} title="Mark late" aria-label={`Mark ${student.full_name} late`} className={student.status === 'Late' ? 'selected-late' : ''} onClick={() => { setStatus(student.id, 'Late'); setActive(index) }}><Clock3 size={15} /></button><button disabled={readOnly} title="Authorized away" aria-label={`Mark ${student.full_name} authorized away`} className={student.status === 'Authorized Away' ? 'selected-away' : ''} onClick={() => { setStatus(student.id, 'Authorized Away'); setActive(index) }}><ArrowUpRight size={15} /></button></div></td></tr>)}</tbody></table></div>}
        {!rows.length && !loading && <EmptyState message={allClassStudents.length ? 'No internal boarding students are registered in this class. External students and day scholars are excluded from attendance.' : 'No active students are registered in this class yet.'} />}
        <div className="rollcall-footer"><div className="rollcall-footer-note"><span>{rows.filter((row) => row.status === 'Not Marked').length} students not yet marked</span>{!readOnly && <input aria-label="Reason for attendance correction" placeholder="Correction reason (if changing saved marks)" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />}</div><div><button className="secondary-button" disabled={!rows.length || active >= rows.length - 1} onClick={() => setActive((index) => Math.min(index + 1, rows.length - 1))}>Next student <ChevronRight size={16} /></button>{!readOnly && <button className="primary-button" disabled={saving || loading || !hasAttendanceMark} onClick={save}>{saving ? 'Saving...' : 'Save attendance'}<Check size={16} /></button>}</div></div>
      </section>
      <aside className="panel rollcall-aside"><div className="callout-icon"><CircleUserRound size={22} /></div><p className="eyebrow">NAME CALL</p><h2>{current?.full_name || 'Ready for roll call'}</h2><p>{current ? `${current.student_number} · ${current.level} ${current.trade}` : 'Choose a student from the list to focus your call.'}</p><div className="callout-divider" /><div className="callout-meta"><span>Current mark</span><StatusBadge status={current?.status || 'Not Marked'} /></div><div className="callout-controls"><button className="secondary-button" disabled={active <= 0} onClick={() => setActive((index) => Math.max(index - 1, 0))}><ChevronLeft size={16} />Previous</button><button className="primary-button" disabled={!rows.length || active >= rows.length - 1} onClick={() => setActive((index) => Math.min(index + 1, rows.length - 1))}>Next student<ChevronRight size={16} /></button></div></aside></div>}
  </>
}

function StatusBadge({ status }) {
  const className = status?.toLowerCase().replaceAll(' ', '-') || 'not-marked'
  return <span className={`status-pill ${className}`}><i />{status || 'Not Marked'}</span>
}

function PermissionsPage({ token, students, classes, permissions, onRefresh, notify, reportError, user }) {
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [selectedPermissionId, setSelectedPermissionId] = useState(null)
  const [permissionDetails, setPermissionDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [form, setForm] = useState({ level: '', trade: '', className: '', studentId: '', departureAt: '', expectedReturnAt: '', reason: '', destination: '', notes: '' })
  const canApprove = user?.role === 'Administrator'
  const canWrite = user?.role !== 'Read-only Staff'
  const canRequest = user?.role === 'Patron'
  useEffect(() => {
    if (!selectedPermissionId) return undefined
    let cancelled = false
    request(`/permissions/${selectedPermissionId}`, { token })
      .then((data) => { if (!cancelled) setPermissionDetails(data) })
      .catch((error) => { if (!cancelled) setDetailsError(error.message) })
      .finally(() => { if (!cancelled) setDetailsLoading(false) })
    return () => { cancelled = true }
  }, [selectedPermissionId, token])
  async function updatePermission(id, action) {
    try {
      await request(`/permissions/${id}/${action}`, { token, method: 'POST' })
      await onRefresh()
      notify(action === 'approve' ? 'Permission approved.' : action === 'reject' ? 'Permission rejected.' : 'Permission status updated.')
    } catch (error) { reportError(error.message) }
  }
  async function submit(event) {
    event.preventDefault()
    try {
      await request('/permissions', { token, method: 'POST', body: JSON.stringify(form) })
      await onRefresh()
      notify('Permission request sent to the administrator for review.')
      setShowForm(false)
    } catch (error) { reportError(error.message) }
  }
  const list = permissions.filter((item) => statusFilter === 'All statuses' || item.status === statusFilter)
  return <>
    <PageHeading eyebrow="STUDENT MOVEMENT" title="Permissions" description="Patrons request student leave; an administrator reviews each request." action={canRequest && <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} />Request permission</button>} />
    <div className="permission-stats"><div className="panel"><span className="stat-label">Pending review</span><strong>{permissions.filter((item) => item.status === 'Pending').length}</strong><small>Sent to the administrator</small></div><div className="panel"><span className="stat-label">Currently away</span><strong>{permissions.filter((item) => item.status === 'Departed').length}</strong><small>Approved and not yet returned</small></div><div className="panel"><span className="stat-label">Overdue returns</span><strong>{permissions.filter((item) => item.overdue).length}</strong><small>Expected return time has passed</small></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h2>Permission register</h2><p>Permission records are retained in each student’s history.</p></div><select className="compact-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{['All statuses', 'Pending', 'Approved', 'Rejected', 'Departed', 'Returned', 'Expired'].map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>CLASS</th><th>REASON / DESTINATION</th><th>DEPARTURE</th><th>RETURN / DUE</th><th>APPROVED BY</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{list.map((item) => <tr key={item.id}><td><button className="permission-student-link" onClick={() => { setSelectedPermissionId(item.id); setPermissionDetails(null); setDetailsError(''); setDetailsLoading(true) }} aria-label={`View permission history for ${item.full_name}`}><strong>{item.full_name}</strong></button><small className="sub-cell">{item.student_number}</small></td><td>{item.level} · {item.trade}<small className="sub-cell">{item.class_name}</small></td><td>{item.reason}<small className="sub-cell">{item.destination || 'Destination not given'}</small></td><td>{formatDateTime(item.actual_departure_at || item.departure_at)}</td><td>{formatDateTime(item.actual_return_at || item.expected_return_at)}<small className="sub-cell">{item.actual_return_at ? 'Returned' : 'Expected'}</small></td><td>{item.approved_by || '—'}</td><td><StatusBadge status={item.overdue ? 'Overdue' : item.status} /></td><td><div className="inline-actions">{item.status === 'Pending' && canApprove && <><button className="mini-action approve" onClick={() => updatePermission(item.id, 'approve')}>Approve</button><button className="mini-action reject" onClick={() => updatePermission(item.id, 'reject')}>Reject</button></>}{canWrite && item.status === 'Approved' && <button className="mini-action approve" onClick={() => updatePermission(item.id, 'depart')}>Record departure</button>}{canWrite && item.status === 'Departed' && <button className="mini-action approve" onClick={() => updatePermission(item.id, 'return')}>Record return</button>}{item.status === 'Pending' && !canApprove && <span className="muted-cell">Awaiting approval</span>}</div></td></tr>)}</tbody></table></div>
      {!list.length && <EmptyState message="No permission records match this filter." />}
    </section>
    {selectedPermissionId && <PermissionDetails data={permissionDetails} loading={detailsLoading} error={detailsError} onClose={() => { setSelectedPermissionId(null); setPermissionDetails(null); setDetailsLoading(false) }} />}
    {showForm && <Modal title="Request student permission" onClose={() => setShowForm(false)}><form className="modal-form" onSubmit={submit}>
      <ClassFields values={form} onChange={setForm} classes={classes} />
      <label>Student<select required disabled={!form.className} value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}><option value="">Choose a student</option>{students.filter((student) => student.status === 'Active' && student.level === form.level && student.trade === form.trade && student.class_name === form.className).map((student) => <option value={student.id} key={student.id}>{student.full_name} · {student.student_number}</option>)}</select></label>
      <div className="field-grid two"><label>Departure date & time<input required type="datetime-local" value={form.departureAt} onChange={(event) => setForm({ ...form, departureAt: event.target.value })} /></label><label>Expected return<input required type="datetime-local" value={form.expectedReturnAt} onChange={(event) => setForm({ ...form, expectedReturnAt: event.target.value })} /></label></div>
      <div className="field-grid two"><label>Reason<textarea required rows="2" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><label>Destination<input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} /></label></div>
      <label>Additional notes<textarea rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <p className="form-note"><ShieldCheck size={15} /> The student is not approved yet. This request will be sent to the administrator for a decision.</p>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">Send to administrator</button></div>
    </form></Modal>}
  </>
}

function PermissionDetails({ data, loading, error, onClose }) {
  const permission = data?.permission
  const timeline = data?.history || []
  return <Modal title={permission ? `Permission history · ${permission.full_name}` : 'Permission details'} onClose={onClose}>
    {loading ? <EmptyState message="Loading permission history..." /> : error ? <div className="profile-error" role="alert">{error}</div> : permission && <>
      <div className="permission-detail-summary"><div><span>Student</span><strong>{permission.full_name} · {permission.student_number}</strong></div><div><span>Class</span><strong>{permission.level} · {permission.trade} · {permission.class_name}</strong></div><div><span>Status</span><StatusBadge status={permission.status} /></div></div>
      <div className="permission-detail-grid"><div><span>Reason</span><strong>{permission.reason}</strong></div><div><span>Destination</span><strong>{permission.destination || 'Not provided'}</strong></div><div><span>Additional notes</span><strong>{permission.notes || 'None'}</strong></div><div><span>Requested by</span><strong>{permission.requested_by} · {formatDateTime(permission.created_at)}</strong></div><div><span>Scheduled departure</span><strong>{formatDateTime(permission.departure_at)}</strong></div><div><span>Actual departure</span><strong>{formatDateTime(permission.actual_departure_at)}</strong></div><div><span>Expected return</span><strong>{formatDateTime(permission.expected_return_at)}</strong></div><div><span>Actual return recorded</span><strong>{formatDateTime(permission.actual_return_at)}</strong></div><div><span>Approved by</span><strong>{permission.approved_by ? `${permission.approved_by} · ${formatDateTime(permission.approved_at)}` : 'Not approved'}</strong></div></div>
      <section className="permission-history"><h3>Record history</h3>{timeline.length ? <ol>{timeline.map((event, index) => <li key={`${event.action}-${event.created_at}-${index}`}><strong>{({ request: 'Permission requested', approve: 'Permission approved', reject: 'Permission rejected', depart: 'Departure recorded', return: 'Return recorded' })[event.action] || event.action}</strong><span>{event.changed_by} · {formatDateTime(event.created_at)}</span>{event.reason && <small>{event.reason}</small>}</li>)}</ol> : <EmptyState message="No audit history is available for this permission." />}</section>
    </>}
  </Modal>
}

function BehaviourPage({ token, user, students, records, onCreate, onRefresh, notify, reportError, readOnly }) {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('All records')
  const [removalRequests, setRemovalRequests] = useState([])
  const [form, setForm] = useState({ studentId: '', kind: 'Positive', category: '', points: 3, description: '', severity: 'Low', actionTaken: '' })
  const list = records.filter((record) => filter === 'All records' || record.kind === filter)
  const isPatron = user?.role === 'Patron'
  useEffect(() => {
    if (user?.role !== 'Administrator') return undefined
    let cancelled = false
    request('/behaviour/removal-requests', { token })
      .then((data) => { if (!cancelled) setRemovalRequests(data.requests) })
      .catch((error) => { if (!cancelled) reportError(error.message) })
    return () => { cancelled = true }
  }, [token, user?.role, reportError])
  async function submit(event) {
    event.preventDefault()
    const saved = await onCreate(form)
    if (saved) setShowForm(false)
  }
  async function requestMarkRemoval(record) {
    const reason = window.prompt(`Why should ${record.kind.toLowerCase()} mark "${record.category}" for ${record.full_name} be removed?`)
    if (!reason?.trim()) return
    try {
      await request(`/behaviour/${record.kind}/${record.id}/removal-requests`, { token, method: 'POST', body: JSON.stringify({ reason }) })
      notify('Removal request sent to the administrator.')
    } catch (error) { reportError(error.message) }
  }
  async function reviewRemovalRequest(id, action) {
    try {
      await request(`/behaviour/removal-requests/${id}/${action}`, { token, method: 'POST' })
      const data = await request('/behaviour/removal-requests', { token })
      setRemovalRequests(data.requests)
      await onRefresh()
      notify(action === 'approve' ? 'Mark removed after administrator review.' : 'Removal request rejected.')
    } catch (error) { reportError(error.message) }
  }
  return <>
    <PageHeading eyebrow="STUDENT WELLBEING" title="Behaviour & recognition" description="Recognize positive choices and keep a fair, traceable incident history." action={!readOnly && <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} />Add a record</button>} />
    <div className="behaviour-callout"><div className="callout-icon"><Activity size={21} /></div><div><strong>Build a culture of encouragement</strong><p>Use points to recognize growth and positive contributions—not to publicly shame students.</p></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h2>Behaviour history</h2><p>Every addition and deduction includes a reason and the staff member who recorded it.</p></div><select className="compact-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All records</option><option>Positive</option><option>Incident</option></select></div>
      <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>RECORD TYPE</th><th>DETAILS</th><th>DATE</th><th>RECORDED BY</th><th>POINTS</th>{isPatron && <th>ACTION</th>}</tr></thead><tbody>{list.map((item) => <tr key={`${item.kind}-${item.id}`}><td><strong>{item.full_name}</strong><small className="sub-cell">{item.level} · {item.trade} · {item.class_name}</small></td><td><span className={`status-pill ${item.kind === 'Positive' ? 'returned' : 'rejected'}`}>{item.kind}</span></td><td><strong>{item.category}</strong><small className="sub-cell">{item.description}</small></td><td>{new Date(item.created_at).toLocaleDateString()}</td><td>{item.recorded_by}</td><td className={`points-change ${item.points > 0 ? 'positive-points' : 'negative-points'}`}>{item.points > 0 ? '+' : ''}{item.points}</td>{isPatron && <td><button className="mini-action reject" onClick={() => requestMarkRemoval(item)}>Request removal</button></td>}</tr>)}</tbody></table></div>
      {!list.length && <EmptyState message="No behaviour records yet. Positive actions deserve recognition." />}
    </section>
    {user?.role === 'Administrator' && <section className="panel table-panel mark-removal-queue"><div className="table-toolbar"><div><h2>Patron mark-removal requests</h2><p>Review requests before a behaviour mark is permanently removed.</p></div><span className="status-pill pending">{removalRequests.filter((item) => item.status === 'Pending').length} pending</span></div><div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>MARK</th><th>REASON FROM PATRON</th><th>REQUESTED BY</th><th>STATUS / DECISION</th></tr></thead><tbody>{removalRequests.map((item) => <tr key={item.id}><td>{item.full_name}<small className="sub-cell">{item.student_number}</small></td><td>{item.record_kind} · #{item.record_id}</td><td>{item.reason}</td><td>{item.requested_by}</td><td>{item.status === 'Pending' ? <div className="inline-actions"><button className="mini-action approve" onClick={() => reviewRemovalRequest(item.id, 'approve')}>Approve removal</button><button className="mini-action reject" onClick={() => reviewRemovalRequest(item.id, 'reject')}>Reject</button></div> : <StatusBadge status={item.status} />}</td></tr>)}</tbody></table></div>{!removalRequests.length && <EmptyState message="There are no mark-removal requests." />}</section>}
    {showForm && <Modal title="Add behaviour record" onClose={() => setShowForm(false)}><form className="modal-form" onSubmit={submit}>
      <label>Student<select required value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}><option value="">Choose a student</option>{students.filter((student) => student.status === 'Active').map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.student_number} · {student.level} {student.trade}</option>)}</select></label>
      <div className="field-grid two"><label>Record type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, points: event.target.value === 'Positive' ? 3 : -1 })}><option>Positive</option><option>Incident</option></select></label><label>{form.kind === 'Positive' ? 'Points awarded' : 'Points deducted'}<input required type="number" min="1" max="50" value={Math.abs(form.points)} onChange={(event) => setForm({ ...form, points: (form.kind === 'Positive' ? 1 : -1) * Number(event.target.value) })} /></label></div>
      {form.kind === 'Incident' && <div className="field-grid two"><label>Severity<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label><label>Action taken<input value={form.actionTaken} onChange={(event) => setForm({ ...form, actionTaken: event.target.value })} /></label></div>}
      <label>Category<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder={form.kind === 'Positive' ? 'e.g. Helpful to classmates' : 'e.g. Late arrival'} /></label>
      <label>Description / reason<textarea required rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <p className="form-note"><ShieldCheck size={15} /> Points cannot be removed silently. Corrections require a new audited transaction.</p>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">Save behaviour record</button></div>
    </form></Modal>}
  </>
}

function ReportsPage({ token, students, classes, attendance, permissions, behaviour }) {
  const [tab, setTab] = useState('Attendance')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [attendanceRange, setAttendanceRange] = useState(attendance)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [recordFilter, setRecordFilter] = useState('All records')
  const [filters, setFilters] = useState({ level: '', trade: '', className: '' })
  const [loadError, setLoadError] = useState('')
  const rangeError = fromDate && toDate && fromDate > toDate ? 'The start date must be before or equal to the end date.' : ''
  useEffect(() => {
    if (!fromDate || !toDate || fromDate > toDate) return undefined
    let cancelled = false
    const loadingTimer = window.setTimeout(() => setLoading(true), 0)
    request(`/attendance?from=${fromDate}&to=${toDate}`, { token })
      .then((data) => { if (!cancelled) setAttendanceRange(data.records) })
      .catch((error) => { if (!cancelled) setLoadError(error.message) })
      .finally(() => { window.clearTimeout(loadingTimer); if (!cancelled) setLoading(false) })
    return () => { cancelled = true; window.clearTimeout(loadingTimer) }
  }, [fromDate, toDate, token])
  const reportError = rangeError || loadError
  const matchesFilters = (record) =>
    (!filters.level || record.level === filters.level) &&
    (!filters.trade || record.trade === filters.trade) &&
    (!filters.className || record.class_name === filters.className)
  const attendanceBase = attendanceRange.filter((record) => matchesFilters(record) && (!query || record.full_name.toLowerCase().includes(query.toLowerCase()) || record.student_number.toLowerCase().includes(query.toLowerCase())))
  const attendanceRows = attendanceBase.filter((record) => status === 'All statuses' || record.status === status)
  const permissionRows = permissions.filter((record) => record.departure_at?.slice(0, 10) >= fromDate && record.departure_at?.slice(0, 10) <= toDate && matchesFilters(record) && (recordFilter === 'All records' || record.status === recordFilter) && (!query || record.full_name.toLowerCase().includes(query.toLowerCase())))
  const behaviourRows = behaviour.filter((record) => record.created_at?.slice(0, 10) >= fromDate && record.created_at?.slice(0, 10) <= toDate && matchesFilters(record) && (recordFilter === 'All records' || record.kind === recordFilter) && (!query || record.full_name.toLowerCase().includes(query.toLowerCase())))
  const data = tab === 'Attendance' ? attendanceRows : tab === 'Permissions' ? permissionRows : behaviourRows
  const headers = tab === 'Attendance' ? ['Student', 'Student ID', 'Class', 'Date', 'Status', 'Saved by', 'Saved at'] : tab === 'Permissions' ? ['Student', 'Class', 'Reason', 'Departure', 'Approved by', 'Status'] : ['Student', 'Class', 'Record', 'Date', 'Points']
  function exportCsv() {
    const csv = [headers, ...data.map((row) => tab === 'Attendance' ? [row.full_name, row.student_number, `${row.level} ${row.trade} ${row.class_name}`, row.date?.slice(0, 10), row.status, row.saved_by, row.saved_at] : tab === 'Permissions' ? [row.full_name, `${row.level} ${row.trade} ${row.class_name}`, row.reason, row.departure_at, row.approved_by, row.status] : [row.full_name, `${row.level} ${row.trade} ${row.class_name}`, row.category, row.created_at, row.points])]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `${tab.toLowerCase()}-report-${fromDate}-to-${toDate}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
  }
  return <>
    <PageHeading eyebrow="SCHOOL INSIGHTS" title="Reports" description="Review attendance, student permissions, and behaviour activity." action={<button className="secondary-button" onClick={() => window.print()}><Download size={16} />Print report</button>} />
    <section className="panel reports-panel"><div className="report-tabs">{['Attendance', 'Permissions', 'Behaviour'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setRecordFilter('All records') }}>{item}</button>)}</div>
      <div className="report-toolbar"><div className="table-search"><Search size={16} /><input placeholder="Search student" value={query} onChange={(event) => setQuery(event.target.value)} /></div><label className="date-filter">From<input aria-label="Report start date" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setLoadError('') }} /></label><label className="date-filter">To<input aria-label="Report end date" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setLoadError('') }} /></label><select className="compact-select" value={filters.level} onChange={(event) => setFilters({ level: event.target.value, trade: '', className: '' })}><option value="">All levels</option>{levels.map((level) => <option key={level}>{level}</option>)}</select><select className="compact-select" value={filters.trade} onChange={(event) => setFilters({ ...filters, trade: event.target.value, className: '' })}><option value="">All trades</option>{trades.map((trade) => <option key={trade}>{trade}</option>)}</select><select className="compact-select" value={filters.className} onChange={(event) => setFilters({ ...filters, className: event.target.value })}><option value="">All classes</option>{[...new Set(classes.filter((item) => (!filters.level || item.level === filters.level) && (!filters.trade || item.trade === filters.trade)).map((item) => item.class_name))].map((className) => <option key={className}>{className}</option>)}</select>{tab === 'Attendance' && <select className="compact-select" value={status} onChange={(event) => setStatus(event.target.value)}>{['All statuses', 'Present', 'Absent', 'Late', 'Authorized Away', 'Not Marked'].map((item) => <option key={item}>{item}</option>)}</select>}{tab === 'Permissions' && <select className="compact-select" value={recordFilter} onChange={(event) => setRecordFilter(event.target.value)}>{['All records', 'Pending', 'Approved', 'Rejected', 'Departed', 'Returned', 'Expired'].map((item) => <option key={item}>{item}</option>)}</select>}{tab === 'Behaviour' && <select className="compact-select" value={recordFilter} onChange={(event) => setRecordFilter(event.target.value)}>{['All records', 'Positive', 'Incident'].map((item) => <option key={item}>{item}</option>)}</select>}{tab === 'Attendance' && <span className="report-loading">{loading ? 'Loading…' : ''}</span>}<button className="secondary-button export-button" onClick={exportCsv} disabled={Boolean(reportError) || loading}><ArrowDownToLine size={16} />Export CSV</button></div>
      {reportError && <div className="report-error" role="alert">{reportError}</div>}
      {tab === 'Attendance' && <div className="report-summary">{['Present', 'Absent', 'Late', 'Authorized Away', 'Not Marked'].map((item) => { const count = attendanceBase.filter((row) => row.status === item).length; const percentage = attendanceBase.length ? Math.round(100 * count / attendanceBase.length) : 0; return <div key={item}><StatusBadge status={item} /><strong>{count}<small>{percentage}%</small></strong></div> })}</div>}
      <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header.toUpperCase()}</th>)}</tr></thead><tbody>{data.map((row) => <tr key={row.id}>{tab === 'Attendance' ? <><td>{row.full_name}</td><td>{row.student_number}</td><td>{row.level} · {row.trade} · {row.class_name}</td><td>{row.date?.slice(0, 10)}</td><td><StatusBadge status={row.status} /></td><td>{row.saved_by || '—'}</td><td>{formatDateTime(row.saved_at)}</td></> : tab === 'Permissions' ? <><td>{row.full_name}</td><td>{row.level} · {row.trade} · {row.class_name}</td><td>{row.reason}</td><td>{formatDateTime(row.departure_at)}</td><td>{row.approved_by || '—'}</td><td><StatusBadge status={row.status} /></td></> : <><td>{row.full_name}</td><td>{row.level} · {row.trade} · {row.class_name}</td><td>{row.category}</td><td>{new Date(row.created_at).toLocaleDateString()}</td><td className={row.points > 0 ? 'positive-points' : 'negative-points'}>{row.points > 0 ? '+' : ''}{row.points}</td></>}</tr>)}</tbody></table></div>
      {!data.length && <EmptyState message="No saved records match these filters." />}
      <div className="table-bottom"><span>{data.length} records · {students.length} students in directory</span></div>
    </section>
  </>
}

function SettingsPage({ token, user, classes, onCreateClass, reportError, notify }) {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showClassForm, setShowClassForm] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'Patron' })
  const [classForm, setClassForm] = useState({ level: 'Level 3', trade: 'SOD', className: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  useEffect(() => {
    if (user?.role !== 'Administrator') return undefined
    let cancelled = false
    request('/users', { token })
      .then((data) => { if (!cancelled) setUsers(data.users) })
      .catch((error) => { if (!cancelled) reportError(error.message) })
    return () => { cancelled = true }
  }, [token, user?.role, reportError])
  async function createUser(event) {
    event.preventDefault()
    try {
      await request('/users', { token, method: 'POST', body: JSON.stringify(form) })
      const data = await request('/users', { token })
      setUsers(data.users)
      setShowForm(false)
      setForm({ username: '', name: '', password: '', role: 'Patron' })
      notify('User account created.')
    } catch (error) { reportError(error.message) }
  }
  async function createClass(event) {
    event.preventDefault()
    const saved = await onCreateClass(classForm)
    if (saved) {
      setShowClassForm(false)
      setClassForm({ level: 'Level 3', trade: 'SOD', className: '' })
    }
  }
  async function changePassword(event) {
    event.preventDefault()
    setPasswordError('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('The new password and confirmation do not match.')
      return
    }
    try {
      await request('/auth/change-password', {
        token,
        method: 'POST',
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      notify('Your password has been changed.')
    } catch (error) { reportError(error.message) }
  }
  return <>
    <PageHeading eyebrow="PREFERENCES" title="Settings" description="School structure and account access for this workspace." />
    <div className="settings-grid"><section className="panel settings-card"><div className="settings-card-heading"><div className="settings-icon"><GraduationCap size={20} /></div>{user?.role === 'Administrator' && <button className="secondary-button" onClick={() => setShowClassForm(true)}><Plus size={14} />Add class</button>}</div><h2>School structure</h2><p>Student classes are filtered by level and trade throughout the system.</p><div className="structure-list">{levels.map((level) => <div key={level}><strong>{level}</strong><span>{trades.map((trade) => `${trade} · ${classes.filter((item) => item.level === level && item.trade === trade).map((item) => item.class_name).join(', ') || 'No classes'}`).join('  |  ')}</span></div>)}</div><small className="settings-note">{user?.role === 'Administrator' ? 'Add a class to update student registration and attendance options.' : 'School structure changes are managed by your system administrator.'}</small></section><section className="panel settings-card"><div className="settings-icon green"><UserRound size={20} /></div><h2>Your account</h2><p>Signed in identity and permissions for this session.</p><div className="account-detail"><span>Name</span><strong>{user?.name}</strong></div><div className="account-detail"><span>Username</span><strong>{user?.username}</strong></div><div className="account-detail"><span>Role</span><strong><StatusBadge status={user?.role} /></strong></div><div className="access-note"><ShieldCheck size={16} />Patrons submit permissions; only an administrator makes the final approval decision.</div></section><section className="panel settings-card"><div className="settings-icon green"><LockKeyhole size={20} /></div><h2>Change password</h2><p>Choose a new password with at least 12 characters. Your current password is required to confirm this change.</p>{passwordError && <div className="form-error" role="alert">{passwordError}</div>}<form className="settings-password-form" onSubmit={changePassword}><label>Current password<input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label><label>New password<input required minLength="12" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label><label>Confirm new password<input required minLength="12" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} /></label><button className="primary-button"><LockKeyhole size={15} />Update password</button></form></section></div>
    {user?.role === 'Administrator' && <section className="panel table-panel user-management"><div className="table-toolbar"><div><h2>User management</h2><p>Grant the least access required for each staff member.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={16} />Add user</button></div><div className="table-scroll"><table><thead><tr><th>NAME</th><th>USERNAME</th><th>ROLE</th><th>ADDED</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td><strong>{account.name}</strong></td><td>{account.username}</td><td><StatusBadge status={account.role} /></td><td>{new Date(account.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>}
    {showForm && <Modal title="Create user account" onClose={() => setShowForm(false)}><form className="modal-form" onSubmit={createUser}><label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Username<input required autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><div className="field-grid two"><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Patron</option><option>Authorized Approver</option><option>Read-only Staff</option><option>Administrator</option></select></label><label>Password (12+ characters)<input required minLength="12" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">Create account</button></div></form></Modal>}
    {showClassForm && <Modal title="Add a school class" onClose={() => setShowClassForm(false)}><form className="modal-form" onSubmit={createClass}><div className="field-grid two"><label>Level<select value={classForm.level} onChange={(event) => setClassForm({ ...classForm, level: event.target.value })}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label><label>Trade<select value={classForm.trade} onChange={(event) => setClassForm({ ...classForm, trade: event.target.value })}>{trades.map((trade) => <option key={trade}>{trade}</option>)}</select></label></div><label>Class name<input required pattern="Class [A-Z]" title="Use a name such as Class C" value={classForm.className} onChange={(event) => setClassForm({ ...classForm, className: event.target.value })} placeholder="Class C" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowClassForm(false)}>Cancel</button><button className="primary-button">Add class</button></div></form></Modal>}
  </>
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>{children}</section></div>
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default App
