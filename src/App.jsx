import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, CalendarDays, Code2,
  Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, ClipboardCheck,
  Clock3, Download, FileBarChart2, GraduationCap, LayoutDashboard, LockKeyhole, LogOut,
  Languages, Mail, MapPin, Menu, Moon, Plus, Search, Send, Settings, ShieldCheck,
  SlidersHorizontal, Sun, UserRound, Users, X, XCircle, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://estgtss-api.onrender.com/api'
const mediaUrl = (url) => url?.startsWith('/uploads/')
  ? `${API_URL.replace(/\/api\/?$/, '')}${url}`
  : url
const levels = ['Level 3', 'Level 4', 'Level 5']
const trades = ['SOD', 'ELET']
const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Students', icon: Users },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Permissions', icon: ShieldCheck },
  { label: 'Behaviour', icon: Activity },
  { label: 'Reports', icon: FileBarChart2 },
  { label: 'Daily Reports', icon: BookOpen },
  { label: 'Reports Inbox', icon: Bell },
  { label: 'School News', icon: BookOpen },
  { label: 'Account Requests', icon: UserRound },
  { label: 'My Records', icon: CircleUserRound },
]
const translations = {
  en: { Overview: 'Overview', Students: 'Students', Attendance: 'Attendance', Permissions: 'Permissions', Behaviour: 'Behaviour', Reports: 'Reports', 'Student Life': 'Student Life', Settings: 'Settings', 'Welcome back': 'Welcome back', 'Sign in': 'Sign in', 'School life': 'School life' },
  rw: { Overview: 'Incamake', Students: 'Abanyeshuri', Attendance: 'Abitabiriye', Permissions: 'Impushya', Behaviour: 'Imyitwarire', Reports: 'Raporo', 'Student Life': 'Ubuzima bw’abanyeshuri', Settings: 'Igenamiterere', 'Welcome back': 'Murakaza neza', 'Sign in': 'Injira', 'School life': 'Ubuzima bw’ishuri' },
  fr: { Overview: 'Aperçu', Students: 'Étudiants', Attendance: 'Présence', Permissions: 'Autorisations', Behaviour: 'Comportement', Reports: 'Rapports', 'Student Life': 'Vie étudiante', Settings: 'Paramètres', 'Welcome back': 'Bon retour', 'Sign in': 'Se connecter', 'School life': 'Vie scolaire' },
}
const translate = (language, text) => translations[language]?.[text] || text
const todayDate = new Date()
const currentYear = todayDate.getFullYear()
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
  const [token, setToken] = useState(() => sessionStorage.getItem('estgtss_session_token') || '')
  const [showLogin, setShowLogin] = useState(false)
  const [showPublicSite, setShowPublicSite] = useState(false)
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
  const [reportsData, setReportsData] = useState({ reports: [], attendance: [], messages: [] })
  const [pendingAccountRequests, setPendingAccountRequests] = useState(0)
  const [unreadSchoolMessages, setUnreadSchoolMessages] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [topUserOpen, setTopUserOpen] = useState(false)

  useEffect(() => { localStorage.removeItem('patron_token') }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    setBusy(true)
    try {
      const me = await request('/auth/me', { token })
      const role = me.user.role
      const [studentData, classData, attendanceData, permissionData, behaviourData, summary, reportData] = await Promise.all([
        request('/students', { token }),
        request('/classes', { token }),
        request(`/attendance?date=${today}`, { token }),
        request('/permissions', { token }),
        request('/behaviour', { token }),
        ['Class Monitor', 'Teacher', 'Student'].includes(role) ? Promise.resolve(null) : request(`/dashboard?date=${today}`, { token }),
        request('/reports', { token }),
      ])
      setUser(me.user)
      setStudents(studentData.students)
      setSchoolClasses(classData.classes)
      setAttendance(attendanceData.records)
      setPermissions(permissionData.permissions)
      setBehaviour(behaviourData.records)
      setDashboard(summary)
      setReportsData(reportData)
      setError('')
    } catch (requestError) {
      if (requestError.message.toLowerCase().includes('token') ||
          requestError.message.toLowerCase().includes('session') ||
          requestError.message.toLowerCase().includes('authentication') ||
          requestError.message.toLowerCase().includes('account is no longer active')) {
        sessionStorage.removeItem('estgtss_session_token')
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
    if (!token) return undefined
    let cancelled = false
    const validateSession = () => {
      request('/auth/me', { token }).catch((requestError) => {
        const message = requestError.message.toLowerCase()
        if (cancelled || !['account is no longer active', 'session is invalid or has expired', 'authentication is required'].some((reason) => message.includes(reason))) return
        sessionStorage.removeItem('estgtss_session_token')
        setToken('')
        setUser(null)
        setShowLogin(true)
        setError(requestError.message)
      })
    }
    const interval = window.setInterval(validateSession, 30000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [token])
  useEffect(() => {
    if (user?.role !== 'Administrator') return undefined
    let cancelled = false
    const loadNotifications = () => {
      request('/admin/notifications', { token })
        .then((data) => {
          if (cancelled) return
          setPendingAccountRequests(data.pendingAccountRequests)
          setUnreadSchoolMessages(data.unreadSchoolMessages)
        })
        .catch((requestError) => { if (!cancelled) setError(requestError.message) })
    }
    loadNotifications()
    const interval = window.setInterval(loadNotifications, 30000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [token, user?.role])
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
  const visibleNavItems = navItems.filter(({ label }) => {
    if (user?.role === 'Student') return label === 'My Records'
    if (['Class Monitor', 'Teacher'].includes(user?.role)) {
      return ['Attendance', 'Daily Reports'].includes(label) && (label !== 'Attendance' || user?.role === 'Class Monitor')
    }
    if (user?.role === 'Administrator') return !['Daily Reports', 'My Records'].includes(label)
    return !['Daily Reports', 'Reports Inbox', 'School News'].includes(label)
  })
  const activePage = page === 'Overview' && user?.role === 'Class Monitor'
    ? 'Attendance'
    : page === 'Overview' && user?.role === 'Teacher'
      ? 'Daily Reports'
      : page === 'Overview' && user?.role === 'Student'
        ? 'My Records'
        : page
  const selectedPage = activePage === 'Account Requests' ? 'Settings' : activePage
  useEffect(() => {
    if (activePage !== 'Account Requests') return undefined
    const timeout = window.setTimeout(() => {
      document.getElementById('account-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activePage])

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
    sessionStorage.removeItem('estgtss_session_token')
    setToken('')
    setUser(null)
    setShowLogin(false)
    setTopUserOpen(false)
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

  if (token && showPublicSite) return <WelcomePage isAuthenticated onPortalReturn={() => setShowPublicSite(false)} onSignIn={() => setShowPublicSite(false)} />
  if (!token && !showLogin) return <WelcomePage onSignIn={() => setShowLogin(true)} />
  if (!token) return <Login language={language} onLanguageChange={updateLanguage} onBack={() => setShowLogin(false)} onLogin={(newToken) => { sessionStorage.setItem('estgtss_session_token', newToken); setToken(newToken) }} />

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><img src="/images/estg-logo.svg" alt="" /></span>
          <span><strong>ESTG TSS</strong><small>Patron workspace</small></span>
        </a>
        <div className="nav-label">{translate(language, 'School life').toUpperCase()}</div>
        <nav>
          {visibleNavItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${activePage === label || (label === 'Account Requests' && activePage === 'Settings') ? 'active' : ''}`} onClick={() => { setPage(label === 'Account Requests' ? 'Account Requests' : label); setMenuOpen(false); setTopUserOpen(false) }}>
              <Icon size={18} strokeWidth={1.8} /><span>{translate(language, label)}</span>
              {label === 'Account Requests' && pendingAccountRequests > 0 && <span className="nav-count">{pendingAccountRequests}</span>}
              {label === 'School News' && unreadSchoolMessages > 0 && <span className="nav-count">{unreadSchoolMessages}</span>}
              {label === 'Permissions' && permissions.filter((item) => item.status === 'Pending').length > 0 &&
                <span className="nav-count">{permissions.filter((item) => item.status === 'Pending').length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-link" onClick={() => setShowPublicSite(true)}><ArrowUpRight size={18} /><span>View public website</span></button>
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
          <div className="breadcrumb">ESTG TSS <ChevronRight size={15} /> <strong>{translate(language, activePage)}</strong></div>
          <div className="top-actions">
            <label className="language-picker" aria-label="Choose language"><Languages size={15} /><select value={language} onChange={(event) => updateLanguage(event.target.value)}><option value="en">English</option><option value="rw">Kinyarwanda</option><option value="fr">Français</option></select></label>
            <button className="icon-button" aria-label={theme === 'day' ? 'Switch to night mode' : 'Switch to day mode'} title={theme === 'day' ? 'Night mode' : 'Day mode'} onClick={toggleTheme}>{theme === 'day' ? <Moon size={17} /> : <Sun size={17} />}</button>
            <div className="global-search-wrap"><label className="global-search"><Search size={17} /><input placeholder="Search students..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>{search.trim() && <div className="global-results" role="listbox">{filteredStudents.slice(0, 6).map((student) => <button key={student.id} role="option" onClick={() => { setSelectedStudentId(student.id); setSearch('') }}><span className="avatar">{student.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{student.full_name}</strong><small>{student.student_number} · {student.level} · {student.trade} {student.class_name}</small></span></button>)}{!filteredStudents.length && <p>No matching students.</p>}</div>}</div>
            <button className="icon-button notification-button" aria-label={pendingAccountRequests ? `${pendingAccountRequests} account requests need review` : 'Notifications'} onClick={() => { if (user?.role === 'Administrator') setPage('Account Requests') }}><Bell size={18} />{user?.role === 'Administrator' && pendingAccountRequests > 0 && <i />}</button>
            <div className="top-user-wrap">
              <button className="top-user" aria-haspopup="menu" aria-expanded={topUserOpen} onClick={() => setTopUserOpen((open) => !open)}>
                <div className="avatar">{user?.name?.[0] || 'P'}</div><span>{user?.name || 'Patron'}<small>{user?.role || 'Staff'}</small></span><ChevronDown size={15} />
              </button>
              {topUserOpen && <div className="top-user-menu" role="menu">
                <strong>{user?.role === 'Administrator' ? 'School Administrator' : user?.role === 'Matron' ? 'School Matron' : user?.role}</strong>
                <small>{user?.username}</small>
                <button role="menuitem" onClick={() => { setPage('Settings'); setTopUserOpen(false) }}><Settings size={15} />Settings</button>
                <button role="menuitem" onClick={logout}><LogOut size={15} />Log out</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="page-content">
          {error && <div className="toast error-toast" role="alert"><XCircle size={18} />{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
          {notice && <div className="toast success-toast" role="status"><Check size={18} />{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}
          {busy && <div className="loading-line" />}
          {selectedPage === 'Overview' && <Dashboard dashboard={dashboard} students={students} attendance={attendance} permissions={permissions} behaviour={behaviour} setPage={setPage} />}
          {selectedPage === 'Students' && <StudentsPage students={filteredStudents} classes={schoolClasses} onOpenProfile={setSelectedStudentId} readOnly={user?.role === 'Read-only Staff'} onCreate={(body) => mutate('/students', 'POST', body, 'Student registered successfully.')} onUpdate={(id, body) => mutate(`/students/${id}`, 'PATCH', body, 'Student details updated.')} />}
          {selectedPage === 'Attendance' && <AttendancePage token={token} students={students} classes={schoolClasses} permissions={permissions} readOnly={user?.role === 'Read-only Staff'} user={user} onSaved={refresh} notify={setNotice} reportError={setError} />}
          {selectedPage === 'Permissions' && <PermissionsPage token={token} students={students} classes={schoolClasses} permissions={permissions} onRefresh={refresh} notify={setNotice} reportError={setError} user={user} />}
          {selectedPage === 'Behaviour' && <BehaviourPage token={token} user={user} students={students} records={behaviour} onCreate={(body) => mutate('/behaviour', 'POST', body, 'Behaviour record saved.')} onRefresh={refresh} notify={setNotice} reportError={setError} readOnly={user?.role === 'Read-only Staff'} />}
          {selectedPage === 'Reports' && <ReportsPage token={token} students={students} classes={schoolClasses} attendance={attendance} permissions={permissions} behaviour={behaviour} />}
          {selectedPage === 'Daily Reports' && <DailyReportsPage token={token} classes={schoolClasses} students={students} user={user} reports={reportsData.reports} onRefresh={refresh} notify={setNotice} reportError={setError} />}
          {selectedPage === 'Reports Inbox' && <ReportsInboxPage token={token} data={reportsData} onRefresh={refresh} reportError={setError} notify={setNotice} />}
          {selectedPage === 'School News' && user?.role === 'Administrator' && <SchoolNewsAdminPage token={token} onUnreadCountChange={setUnreadSchoolMessages} reportError={setError} notify={setNotice} />}
          {selectedPage === 'My Records' && <MyRecordsPage token={token} user={user} reports={reportsData.reports} />}
          {selectedPage === 'Settings' && <SettingsPage token={token} user={user} classes={schoolClasses} onCreateClass={(body) => mutate('/classes', 'POST', body, 'School class added.')} onPendingAccountRequestsChange={setPendingAccountRequests} reportError={setError} notify={setNotice} />}
        </div>
      </main>
      {selectedStudentId && <StudentProfile token={token} studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />}
    </div>
  )
}

function InstagramMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" className="instagram-mark">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
  </svg>
}

function WelcomePage({ onSignIn, isAuthenticated = false, onPortalReturn }) {
  const pageFromHash = () => window.location.hash.match(/^#\/([a-z-]+)/)?.[1] || 'home'
  const [page, setPage] = useState(pageFromHash)
  const [news, setNews] = useState([])
  const [newsError, setNewsError] = useState('')
  const [contactStatus, setContactStatus] = useState('')
  const [contactError, setContactError] = useState('')
  const [contactSending, setContactSending] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const syncPage = () => { setPage(pageFromHash()); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])
  useEffect(() => {
    let cancelled = false
    request('/public/news')
      .then((data) => { if (!cancelled) setNews(data.news) })
      .catch((error) => { if (!cancelled) setNewsError(error.message) })
    return () => { cancelled = true }
  }, [])
  async function submitContact(event) {
    event.preventDefault()
    setContactSending(true)
    setContactError('')
    setContactStatus('')
    try {
      const result = await request('/public/contact', { method: 'POST', body: JSON.stringify(contactForm) })
      setContactForm({ name: '', email: '', phone: '', subject: '', message: '' })
      setContactStatus(result.message)
    } catch (error) { setContactError(error.message) }
    finally { setContactSending(false) }
  }
  const links = [
    ['Home', 'home'], ['About us', 'about'], ['Trades', 'trades'], ['News', 'news'],
    ['Gallery', 'gallery'], ['Student life', 'student-life'], ['Contact', 'contact'],
  ]
  const photos = [
    { src: '/images/students-collaboration.jpg', label: 'Students learning together', category: 'STUDENT LIFE' },
    { src: '/images/electrical-workshop.jpg', label: 'Students practicing electrical technology', category: 'ELECTRICAL' },
    { src: '/images/school-gate.jpg', label: 'The ESTG TSS school entrance', category: 'OUR SCHOOL' },
    { src: '/images/students-at-school.jpg', label: 'Students gathering at school', category: 'COMMUNITY' },
    { src: '/images/school-office.jpg', label: 'The school administration office', category: 'OUR SCHOOL' },
    { src: '/images/school-courtyard.jpg', label: 'The ESTG school courtyard', category: 'CAMPUS' },
    { src: '/images/campus-buildings.jpg', label: 'Buildings on the ESTG campus', category: 'CAMPUS' },
  ]
  const pageDetails = {
    about: ['About our school', 'A technical education shaped by curiosity, responsibility, and practical learning.'],
    trades: ['Our technical trades', 'Explore Software Development and Electrical Technology across Levels 3–5.'],
    news: ['News & announcements', 'Updates, achievements, and stories from the ESTG TSS community.'],
    gallery: ['School gallery', 'A glimpse into learning, making, teamwork, and student life.'],
    'student-life': ['Student life', 'Learning is only one part of the journey—community, creativity, and friendship matter too.'],
    contact: ['Contact the school', 'Send a message to the school office or find another way to connect with us.'],
  }
  return <main className="public-site">
    <header className="public-header">
      <a className="public-brand" href="#/home" aria-label="ESTG TSS home"><span><img src="/images/estg-logo.svg" alt="" /></span><strong>ESTG TSS<small>Ecole secondaire Technique de Gisenyi</small></strong></a>
      <button className="public-menu-toggle" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={21} /></button>
      <nav className={mobileOpen ? 'public-nav open' : 'public-nav'} aria-label="School website navigation">
        {links.map(([label, id]) => <a key={id} className={page === id ? 'active' : ''} href={`#/${id}`}>{label}</a>)}
        <button className="primary-button public-signin" onClick={isAuthenticated ? onPortalReturn : onSignIn}>{isAuthenticated ? 'Return to portal' : 'Portal sign in'} <ArrowUpRight size={15} /></button>
      </nav>
    </header>
    {page === 'home' ? <section className="public-hero">
      <div className="public-hero-photo" role="img" aria-label="ESTG TSS school campus" />
      <div className="public-hero-shade" />
      <div className="public-hero-content">
        <span className="public-eyebrow"><i /> WELCOME TO ESTG TSS</span>
        <h1>Learn with purpose.<br /><em>Build what’s next.</em></h1>
        <p className="public-full-name">Ecole secondaire Technique de Gisenyi</p>
        <p className="public-hero-intro">Where young minds turn curiosity into skill—from developing thoughtful software to understanding the electrical systems that power our communities.</p>
        <div className="public-hero-actions"><a className="public-light-cta" href="#/trades">Discover our trades <ArrowUpRight size={16} /></a><button className="public-ghost-cta" onClick={onSignIn}>School portal sign in</button></div>
        <div className="public-hero-pill"><Code2 size={16} /> Software Development <span /> <Zap size={16} /> Electrical Technology</div>
      </div>
      <div className="public-hero-caption"><strong>Curiosity becomes capability.</strong><span>Gisenyi · Rwanda</span></div>
    </section> : <section className={`public-page-banner page-banner-${page}`}>
      <span className="public-eyebrow"><i /> ESTG TSS · Gisenyi, Rwanda</span>
      <h1>{pageDetails[page]?.[0] || 'ESTG TSS'}</h1>
      <p>{pageDetails[page]?.[1]}</p>
    </section>}
    {page === 'home' && <section className="public-intro-strip"><span>01 — OUR SCHOOL</span><p>Practical skills. Creative thinking. A future built together.</p><a href="#/about">Discover ESTG <ArrowUpRight size={15} /></a></section>}
    {page === 'home' || page === 'about' ? <section className="public-section public-about">
      <div className="public-section-heading"><span>ABOUT ESTG TSS</span><h2>Education that connects ideas to the real world.</h2></div>
      <div className="public-about-copy"><p>Ecole secondaire Technique de Gisenyi is a technical secondary school in Gisenyi, Rwanda. We believe the best learning grows through curiosity, practice, teamwork, and the confidence to try.</p><p>From writing a first program to understanding a working circuit, our learners develop the knowledge and practical mindset to contribute to their communities and keep growing.</p><a href="#/student-life">Explore student life <ArrowUpRight size={15} /></a></div>
    </section> : null}
    {page === 'home' || page === 'trades' ? <section className="public-section public-trades">
      <div className="public-section-heading"><span>LEARN BY DOING</span><h2>Technical pathways for a changing world.</h2><p>Build a strong foundation, develop practical skills, and keep asking what you can make better.</p></div>
      <div className="public-trade-grid">
        <article className="public-trade-card trade-software"><img className="public-trade-photo" src="/images/gallery-software.svg" alt="Illustration of software development" loading="lazy" /><div className="public-trade-icon"><Code2 size={24} /></div><span>SOD · LEVELS 3–5</span><h3>Software Development</h3><p>Explore programming, web design, databases, and the thinking behind useful, accessible digital experiences. Students learn to plan, build, test, and improve software that solves real problems.</p><a href="#/trades">Explore software development <ArrowUpRight size={15} /></a></article>
        <article className="public-trade-card trade-electrical"><img className="public-trade-photo" src="/images/electrical-workshop.jpg" alt="ESTG students practicing electrical technology" loading="lazy" /><div className="public-trade-icon"><Zap size={24} /></div><span>ELET · LEVELS 3–5</span><h3>Electrical Technology</h3><p>Learn about electrical systems, circuits, safe practice, and the technologies that keep people and places connected. Practical workshops help learners build confidence with tools and electrical principles.</p><a href="#/trades">Explore electrical technology <ArrowUpRight size={15} /></a></article>
      </div>
    </section> : null}
    {page === 'home' || page === 'news' ? <section className="public-section public-news">
      <div className="public-section-title-row"><div className="public-section-heading"><span>FROM OUR COMMUNITY</span><h2>News & announcements</h2><p>Stories and updates shared by the school.</p></div>{page === 'home' && <a href="#/news">All school news <ArrowUpRight size={15} /></a>}</div>
      {newsError ? <p className="public-inline-error" role="alert">{newsError}</p> : news.length ? <div className="public-news-grid">{(page === 'home' ? news.slice(0, 3) : news).map((item) => <article className="public-news-card" key={item.id}>{item.image_url && <img src={mediaUrl(item.image_url)} alt="" loading="lazy" />}{item.video_url && <video src={mediaUrl(item.video_url)} controls preload="metadata" aria-label={`Video: ${item.title}`} />}<span>{new Date(item.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span><h3>{item.title}</h3><p>{item.summary}</p><details><summary>Read story</summary><p>{item.body}</p></details></article>)}</div> : <div className="public-empty-news"><BookOpen size={23} /><p>School news and announcements will appear here.</p></div>}
    </section> : null}
    {page === 'home' || page === 'gallery' ? <section className="public-section public-gallery">
      <div className="public-section-title-row"><div className="public-section-heading"><span>OUR MOMENTS</span><h2>Learning, making, belonging.</h2><p>A gallery celebrating the ideas and energy of school life.</p></div>{page === 'home' && <a href="#/gallery">Explore gallery <ArrowUpRight size={15} /></a>}</div>
      <div className="public-photo-grid">{(page === 'home' ? photos.slice(0, 4) : photos).map((photo, index) => <figure className={`public-photo photo-${index + 1}`} key={photo.src}><img src={photo.src} alt={photo.label} loading="lazy" /><figcaption><span>{photo.category}</span><strong>{photo.label}</strong></figcaption></figure>)}</div>
      <p className="public-gallery-note">Photos shared by ESTG TSS. School staff can add new moments through the news publisher.</p>
    </section> : null}
    {page === 'home' || page === 'student-life' ? <section className="public-section public-life">
      <div className="public-section-heading"><span>BEYOND THE CLASSROOM</span><h2>Grow through every part of school life.</h2><p>Make friends, explore interests, and bring your ideas into the community.</p></div>
      <div className="public-life-grid">
        <article><div className="life-icon"><Users size={21} /></div><span>STUDENT COMMUNITY</span><h3>Life at ESTG</h3><p>Learning together, supporting one another, and celebrating the progress we make along the way.</p><a href="#/student-life">Student life <ArrowUpRight size={14} /></a></article>
        <article><div className="life-icon"><Code2 size={21} /></div><span>INTERESTS & IDEAS</span><h3>Clubs</h3><p>Join the Coding Club or NIT Club to explore technology, make projects, and learn together.</p><a href="#/student-life">Explore clubs <ArrowUpRight size={14} /></a></article>
        <article><div className="life-icon"><CalendarDays size={21} /></div><span>TOGETHER AT SCHOOL</span><h3>Events</h3><p>School gatherings, showcases, and community activities create moments to learn and connect.</p><a href="#/student-life">School events <ArrowUpRight size={14} /></a></article>
      </div>
      {page === 'student-life' && <div className="public-club-grid">
        <article><img src="/images/gallery-software.svg" alt="Software development illustration" loading="lazy" /><span>CODE · CREATE · COLLABORATE</span><h3>Coding Club</h3><p>Students practice programming, experiment with web projects, and share the small steps that turn an idea into working software.</p><a href="#/trades">Explore Software Development <ArrowUpRight size={14} /></a></article>
        <article><img src="/images/gallery-team.svg" alt="Students collaborating" loading="lazy" /><span>NETWORKS · INNOVATION · TECHNOLOGY</span><h3>NIT Club</h3><p>A space for curious learners to explore networks and information technology, exchange ideas, and build confidence with digital tools.</p><a href="#/trades">Explore technical trades <ArrowUpRight size={14} /></a></article>
      </div>}
    </section> : null}
    {page === 'contact' ? <section className="public-section public-contact-section">
      <div className="public-section-heading"><span>GET IN TOUCH</span><h2>We’d be glad to hear from you.</h2><p>Send a message to the school office. A school administrator can review it from the portal.</p>
        <div className="contact-methods"><div><MapPin size={18} /><span><strong>Visit</strong><small>Gisenyi, Rwanda</small></span></div><div><Mail size={18} /><span><strong>Email</strong><small>Use the message form to contact the school office.</small></span></div><div><Camera size={18} /><span><strong>Social updates</strong><small>Follow official school channels when published.</small></span></div></div>
        <div className="public-social-links"><a href="https://www.instagram.com/" target="_blank" rel="noreferrer"><InstagramMark /> Instagram</a><a href="https://x.com/" target="_blank" rel="noreferrer"><span className="social-x-mark">𝕏</span> X</a></div>
      </div>
      <form className="public-contact-form" onSubmit={submitContact}>
        <h3>Send us a message</h3>
        <p>Your message will go to the school administrator.</p>
        {contactStatus && <div className="contact-success" role="status">{contactStatus}</div>}
        {contactError && <div className="form-error" role="alert">{contactError}</div>}
        <div className="contact-form-grid"><label>Your name<input required maxLength="120" autoComplete="name" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} /></label><label>Email address<input required maxLength="254" type="email" autoComplete="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></label></div>
        <label>Phone number <span>(optional)</span><input maxLength="40" type="tel" autoComplete="tel" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} /></label>
        <label>Subject<input required maxLength="180" value={contactForm.subject} onChange={(event) => setContactForm({ ...contactForm, subject: event.target.value })} /></label>
        <label>Your message<textarea required maxLength="5000" rows="5" value={contactForm.message} onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })} /></label>
        <button className="primary-button" disabled={contactSending}>{contactSending ? 'Sending message…' : 'Send message'} <Send size={15} /></button>
      </form>
    </section> : null}
    <section className="public-bottom-cta"><div><span>ESTG TSS · GISENYI</span><h2>Come curious. Leave capable.</h2><p>Explore our technical trades and take the next step in your learning journey.</p></div><a href="#/trades">Explore the trades <ArrowUpRight size={16} /></a></section>
    <footer className="public-footer">
      <div className="public-footer-main"><a className="public-brand footer-brand" href="#/home"><span><img src="/images/estg-logo.svg" alt="" /></span><strong>ESTG TSS<small>Ecole secondaire Technique de Gisenyi</small></strong></a><p>Practical learning. Creative thinking.<br />A future built together.</p>      <div className="public-footer-social"><a href="https://www.instagram.com/" aria-label="Instagram" target="_blank" rel="noreferrer"><InstagramMark /></a><a href="https://x.com/" aria-label="X" target="_blank" rel="noreferrer"><span className="social-x-mark">𝕏</span></a></div></div>
      <div className="public-footer-col"><strong>Discover</strong><a href="#/about">About us</a><a href="#/trades">Our trades</a><a href="#/news">School news</a><a href="#/gallery">Gallery</a></div>
      <div className="public-footer-col"><strong>School life</strong><a href="#/student-life">Student life, clubs & events</a><a href="#/contact">Contact us</a></div>
      <div className="public-footer-col"><strong>Connect</strong><span><MapPin size={14} />Gisenyi, Rwanda</span><button onClick={isAuthenticated ? onPortalReturn : onSignIn}>{isAuthenticated ? 'Return to portal' : 'Staff & student portal'} <ArrowUpRight size={14} /></button><a href="#/contact">Send the school a message</a></div>
      <div className="public-footer-bottom"><span>© {currentYear} Ecole secondaire Technique de Gisenyi. All rights reserved.</span><a href="#/home">Back to top ↑</a></div>
    </footer>
  </main>
}

function Login({ onLogin, onBack, language, onLanguageChange }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [classMistressName, setClassMistressName] = useState('')
  const [subject, setSubject] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const isSignup = mode !== 'login'
  useEffect(() => {
    request('/public/classes')
      .then((data) => setClasses(data.classes))
      .catch((requestError) => setError(requestError.message))
  }, [])
  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (!isSignup) {
        const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
        onLogin(result.token)
      } else if (mode === 'student') {
        const result = await request('/auth/register/student', {
          method: 'POST',
          body: JSON.stringify({ studentNumber, name, password }),
        })
        setSuccess(result.message)
        setMode('login')
        setUsername(studentNumber)
        setPassword('')
      } else {
        const selectedClass = classes.find((item) => String(item.id) === classId)
        if (!selectedClass) throw new Error('Select your level, trade, and class.')
        const result = await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username, name, password, role: mode === 'teacher' ? 'Teacher' : 'Class Monitor', level: selectedClass.level,
            trade: selectedClass.trade, className: selectedClass.class_name,
            classMistressName, subject,
          }),
        })
        setSuccess(result.message)
        setMode('login')
        setPassword('')
      }
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
        <button className="text-button login-home-link" onClick={onBack}><ChevronLeft size={15} />Back to school home</button>
        <div className="login-logo"><img src="/images/estg-logo.svg" alt="ESTG TSS" /></div>
        <p className="eyebrow">ESTG TSS · SCHOOL PATRON</p>
        <h1>{!isSignup ? translate(language, 'Welcome back') : `Request a ${mode === 'student' ? 'student' : mode === 'teacher' ? 'teacher' : 'class monitor'} account`}</h1>
        <p className="login-subtitle">{!isSignup ? 'Sign in to access your school account.' : 'The administrator must approve your request before you can sign in.'}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        {success && <div className="registration-success" role="status">{success}</div>}
        <form onSubmit={submit}>
          {isSignup && <>
            <label>Full name{mode === 'student' && <span className="form-note">Enter the name as it appears in the school register.</span>}<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
          </>}
          {mode === 'student'
            ? <label>Student ID<input required autoComplete="username" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="Your registered school ID" /></label>
            : <label>Email / username<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Email or username" /></label>}
          {(mode === 'teacher' || mode === 'monitor') && <>
            <label>Level, trade, and class<select required value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Select your class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.level} · {item.trade} · {item.class_name}</option>)}</select></label>
            {mode === 'monitor' && <label>Class mistress name<input required value={classMistressName} onChange={(event) => setClassMistressName(event.target.value)} /></label>}
            {mode === 'teacher' && <label>Subject taught<input required value={subject} onChange={(event) => setSubject(event.target.value)} /></label>}
          </>}
          <label>Password<input required minLength={isSignup ? 12 : undefined} type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? 'At least 12 characters' : 'Enter your password'} /></label>
          <button className="primary-button full-button" disabled={loading}>{loading ? 'Please wait...' : isSignup ? 'Send approval request' : translate(language, 'Sign in')}<ArrowUpRight size={17} /></button>
        </form>
        {isSignup
          ? <button className="text-button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Back to sign in</button>
          : <div className="signup-options"><p>Request a separate account as:</p><button className="text-button" onClick={() => { setMode('teacher'); setError(''); setSuccess('') }}>Teacher</button><button className="text-button" onClick={() => { setMode('monitor'); setError(''); setSuccess('') }}>Class monitor</button><button className="text-button" onClick={() => { setMode('student'); setError(''); setSuccess('') }}>Student</button></div>}
        {!isSignup && <p className="login-footnote">Sign in with the account provided by your school. Never share your password.</p>}
      </div>
      <div className="login-decoration"><span>01 / ESTG STUDENT LIFE</span><strong>Every student<br />seen. Every day.</strong><p>A welcoming school community for learning, creativity, and shared experiences.</p><div className="login-club-preview"><span>Coding Club</span><span>NIT Club</span></div><div className="decoration-line" /></div>
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

function MyRecordsPage({ token, user, reports }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    request(`/students/${user.student_id}/profile`, { token })
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch((requestError) => { if (!cancelled) setError(requestError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, user.student_id])
  const myReports = reports.filter((report) => Number(report.student_id) === Number(user.student_id))
  if (loading) return <><PageHeading eyebrow="STUDENT ACCOUNT" title="My records" description="Your attendance, permission history, and reports." /><EmptyState message="Loading your student records..." /></>
  if (error) return <><PageHeading eyebrow="STUDENT ACCOUNT" title="My records" description="Your attendance, permission history, and reports." /><div className="profile-error" role="alert">{error}</div></>
  if (!profile) return null
  const { student } = profile
  return <>
    <PageHeading eyebrow="STUDENT ACCOUNT" title="My records" description="Only you can see the student records linked to your account." />
    <section className="panel settings-card"><h2>{student.full_name}</h2><p>{student.student_number} · {student.level} · {student.trade} · {student.class_name}</p><div className="metric-grid student-metrics">
      <article className="metric-card"><p>Attendance records</p><strong>{profile.attendance.length}</strong></article>
      <article className="metric-card"><p>Permission requests</p><strong>{profile.permissions.length}</strong></article>
      <article className="metric-card"><p>Behaviour points</p><strong>{student.points}</strong></article>
    </div></section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Attendance</h2><p>Your recent attendance marks.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>DATE</th><th>STATUS</th></tr></thead><tbody>{profile.attendance.map((row) => <tr key={`${row.date}-${row.status}`}><td>{String(row.date).slice(0, 10)}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div>
      {!profile.attendance.length && <EmptyState message="No attendance records are available." />}
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Permission requests</h2><p>Requests and decisions linked to your student record.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>REASON</th><th>DEPARTURE</th><th>EXPECTED RETURN</th><th>STATUS</th></tr></thead><tbody>{profile.permissions.map((item) => <tr key={item.id}><td>{item.reason}</td><td>{formatDateTime(item.departure_at)}</td><td>{formatDateTime(item.expected_return_at)}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>
      {!profile.permissions.length && <EmptyState message="No permission requests are available." />}
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Reports about you</h2><p>Teacher notes shared with the administrator.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>DATE</th><th>SUBJECT</th><th>LESSONS</th><th>NOTE</th></tr></thead><tbody>{myReports.map((report) => <tr key={report.id}><td>{String(report.report_date).slice(0, 10)}</td><td>{report.subject}</td><td>{report.lessons}</td><td>{report.behaviour_notes || '—'}</td></tr>)}</tbody></table></div>
      {!myReports.length && <EmptyState message="No reports are linked to your account." />}
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Behaviour</h2><p>Your recorded behaviour points and incidents.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>DATE</th><th>TYPE</th><th>CATEGORY</th><th>DETAILS</th><th>POINTS</th></tr></thead><tbody>{profile.behaviour.map((item) => <tr key={`${item.kind}-${item.id}`}><td>{formatDateTime(item.created_at)}</td><td>{item.kind}</td><td>{item.category}</td><td>{item.description}</td><td>{item.points > 0 ? '+' : ''}{item.points}</td></tr>)}</tbody></table></div>
      {!profile.behaviour.length && <EmptyState message="No behaviour records are available." />}
    </section>
  </>
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

function AttendancePage({ token, students, classes, permissions, readOnly, user, onSaved, notify, reportError }) {
  const [filters, setFilters] = useState(() => ({
    date: today,
    level: user?.role === 'Class Monitor' ? classes[0]?.level || '' : '',
    trade: user?.role === 'Class Monitor' ? classes[0]?.trade || '' : '',
    className: user?.role === 'Class Monitor' ? classes[0]?.class_name || '' : '',
  }))
  const [attendedBy, setAttendedBy] = useState(user?.role === 'Class Monitor' ? 'Class Monitor' : 'Staff')
  const submitToAdmin = user?.role === 'Class Monitor'
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
      const saved = await request('/attendance', { token, method: 'POST', body: JSON.stringify({ date: filters.date, level: filters.level, trade: filters.trade, className: filters.className, reason: correctionReason, attendedBy, submitToAdmin, records: rows.map(({ id, status }) => ({ studentId: id, status })) }) })
      setSessionInfo({ date: filters.date, saved_at: saved.savedAt, saved_by: saved.savedBy, attended_by: attendedBy, submitted_to_admin: submitToAdmin, attendanceKey })
      notify(submitToAdmin ? 'Attendance saved and sent to the administrator.' : 'Attendance saved. Students not yet called remain Not Marked.')
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
      {user?.role === 'Class Monitor'
        ? <div className="field-grid three"><label>Level<input readOnly value={classes[0]?.level || ''} /></label><label>Trade<input readOnly value={classes[0]?.trade || ''} /></label><label>Class<input readOnly value={classes[0]?.class_name || ''} /></label></div>
        : <ClassFields values={filters} onChange={(next) => setFilters({ ...next, date: filters.date })} classes={classes} />}
      <div className="attendance-totals">{counts.map(({ status, count }) => <div key={status}><span className={`status-dot ${status.toLowerCase().replaceAll(' ', '-')}`} />{status}<strong>{count}</strong></div>)}</div>
    </section>
    {!filters.className ? <section className="panel attendance-empty"><div className="empty-icon"><ClipboardCheck size={24} /></div><h2>Choose a class to begin</h2><p>Select a level, trade, and class to load its active student register.</p></section>
      : <div className="attendance-layout"><section className="panel rollcall-panel">
        <div className={`attendance-save-status ${currentSessionInfo ? 'saved' : 'not-saved'}`} role="status"><strong>{currentSessionInfo ? `Attendance recorded for ${attendanceDateLabel}.` : noAttendanceMessage}</strong>{currentSessionInfo ? <span>Saved by {currentSessionInfo.saved_by} · marked by {currentSessionInfo.attended_by || 'Staff'}{currentSessionInfo.submitted_to_admin ? ' · sent to administrator' : ''} at {formatDateTime(currentSessionInfo.saved_at)}.</span> : !hasAttendanceMark && !readOnly && <span>Mark students Present, Absent, Late, or Authorized Away to start the register.</span>}</div>
        {loading ? <EmptyState message="Loading class register..." /> : <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>ATTENDANCE</th><th>MARK</th></tr></thead><tbody>{rows.map((student, index) => <tr key={student.id} className={active === index ? 'current-student' : ''}><td><button className="student-name-button" onClick={() => setActive(index)}><span className={`avatar avatar-color-${index % 4}`}>{student.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>{student.full_name}</button></td><td className="muted-cell">{student.student_number}</td><td><StatusBadge status={student.status} /></td><td><div className="attendance-buttons"><button disabled={readOnly} title="Mark present" aria-label={`Mark ${student.full_name} present`} className={student.status === 'Present' ? 'selected-present' : ''} onClick={() => { setStatus(student.id, 'Present'); setActive(index) }}><Check size={16} /></button><button disabled={readOnly} title="Mark absent" aria-label={`Mark ${student.full_name} absent`} className={student.status === 'Absent' ? 'selected-absent' : ''} onClick={() => { setStatus(student.id, 'Absent'); setActive(index) }}><X size={16} /></button><button disabled={readOnly} title="Mark late" aria-label={`Mark ${student.full_name} late`} className={student.status === 'Late' ? 'selected-late' : ''} onClick={() => { setStatus(student.id, 'Late'); setActive(index) }}><Clock3 size={15} /></button><button disabled={readOnly} title="Authorized away" aria-label={`Mark ${student.full_name} authorized away`} className={student.status === 'Authorized Away' ? 'selected-away' : ''} onClick={() => { setStatus(student.id, 'Authorized Away'); setActive(index) }}><ArrowUpRight size={15} /></button></div></td></tr>)}</tbody></table></div>}
        {!rows.length && !loading && <EmptyState message={allClassStudents.length ? 'No internal boarding students are registered in this class. External students and day scholars are excluded from attendance.' : 'No active students are registered in this class yet.'} />}
        <div className="rollcall-footer"><div className="rollcall-footer-note"><span>{rows.filter((row) => row.status === 'Not Marked').length} students not yet marked</span>{!readOnly && <input aria-label="Reason for attendance correction" placeholder="Correction reason (if changing saved marks)" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />}</div><div className="attendance-submit-controls"><label>Attendance taken by<select value={attendedBy} onChange={(event) => setAttendedBy(event.target.value)}>{(user?.role === 'Class Monitor' ? ['Class Monitor', 'Class Mistress'] : ['Staff', 'Teacher', 'Class Monitor', 'Class Mistress']).map((item) => <option key={item}>{item}</option>)}</select></label><button className="secondary-button" disabled={!rows.length || active >= rows.length - 1} onClick={() => setActive((index) => Math.min(index + 1, rows.length - 1))}>Next student <ChevronRight size={16} /></button>{!readOnly && <button className="primary-button" disabled={saving || loading || !hasAttendanceMark} onClick={save}>{saving ? 'Sending...' : submitToAdmin ? 'Send to administrator' : 'Save attendance'}<Check size={16} /></button>}</div></div>
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
      const result = await request(`/permissions/${id}/${action}`, { token, method: 'POST' })
      await onRefresh()
      notify(action === 'approve' ? result.message : action === 'reject' ? 'Permission rejected.' : 'Permission status updated.')
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

function DailyReportsPage({ token, classes, students, user, reports, onRefresh, notify, reportError }) {
  const [assignments, setAssignments] = useState([])
  const [assignmentForm, setAssignmentForm] = useState({ classId: '', subject: '' })
  const [form, setForm] = useState({ date: today, classId: user?.class_id ? String(user.class_id) : '', subject: user?.subject || '', lessons: '', behaviourNotes: '', studentId: '' })
  const [saving, setSaving] = useState(false)
  const [savingAssignment, setSavingAssignment] = useState(false)
  useEffect(() => {
    if (user?.role !== 'Teacher') return undefined
    let cancelled = false
    request('/teacher/assignments', { token })
      .then((data) => {
        if (cancelled) return
        setAssignments(data.assignments)
        setForm((current) => ({
          ...current,
          classId: current.classId || (data.assignments[0] ? String(data.assignments[0].class_id) : ''),
          subject: current.subject || data.assignments[0]?.subject || '',
        }))
      })
      .catch((error) => { if (!cancelled) reportError(error.message) })
    return () => { cancelled = true }
  }, [token, user?.role, reportError])
  const assignedSubjects = assignments
    .filter((assignment) => assignment.approval_status === 'Approved' && String(assignment.class_id) === form.classId)
    .map((assignment) => assignment.subject)
  const approvedAssignments = assignments.filter((assignment) => assignment.approval_status === 'Approved')
  const selectedClass = classes.find((item) => String(item.id) === form.classId)
  const selectedSubject = assignedSubjects.includes(form.subject) ? form.subject : (assignedSubjects[0] || '')
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await request('/reports', {
        token,
        method: 'POST',
        body: JSON.stringify({ ...form, subject: user?.role === 'Teacher' ? selectedSubject : form.subject, classId: form.classId || classes[0]?.id, studentId: form.studentId || null }),
      })
      setForm((current) => ({ ...current, subject: user?.role === 'Teacher' ? selectedSubject : current.subject, lessons: '', behaviourNotes: '', studentId: '' }))
      notify('Daily report sent to the administrator.')
      await onRefresh()
    } catch (error) { reportError(error.message) }
    finally { setSaving(false) }
  }
  async function addAssignment(event) {
    event.preventDefault()
    setSavingAssignment(true)
    try {
      await request('/teacher/assignments', { token, method: 'POST', body: JSON.stringify(assignmentForm) })
      const data = await request('/teacher/assignments', { token })
      setAssignments(data.assignments)
      setAssignmentForm({ classId: '', subject: '' })
      notify('Teaching assignment sent to the administrator for approval.')
      await onRefresh()
    } catch (error) { reportError(error.message) }
    finally { setSavingAssignment(false) }
  }
  async function removeAssignment(assignment) {
    if (!window.confirm(`Remove ${assignment.subject} from ${assignment.level} ${assignment.trade} ${assignment.class_name}?`)) return
    try {
      await request(`/teacher/assignments/${assignment.id}`, { token, method: 'DELETE' })
      const data = await request('/teacher/assignments', { token })
      setAssignments(data.assignments)
      setForm((current) => current.classId === String(assignment.class_id) && current.subject === assignment.subject
        ? { ...current, subject: '' }
        : current)
      notify('Teaching assignment removed.')
      await onRefresh()
    } catch (error) { reportError(error.message) }
  }
  const classLabel = selectedClass ? `${selectedClass.level} · ${selectedClass.trade} · ${selectedClass.class_name}` : (classes[0] ? `${classes[0].level} · ${classes[0].trade} · ${classes[0].class_name}` : 'Your assigned classes')
  return <>
    <PageHeading eyebrow="SCHOOL DAY" title={user?.role === 'Teacher' ? 'Teacher daily report' : 'Class monitor report'} description={`Submit the subjects and lessons covered, and send any behaviour concerns directly to the administrator. ${classLabel}.`} />
    {user?.role === 'Teacher' && <section className="panel settings-card teacher-assignment-panel"><div className="table-toolbar"><div><h2>Your teaching assignments</h2><p>Record each subject you teach for every class, including SOD and ELET classes across Levels 3–5.</p></div></div>
      <form className="teacher-assignment-form" onSubmit={addAssignment}>
        <label>Level · trade · class<select required value={assignmentForm.classId} onChange={(event) => setAssignmentForm({ ...assignmentForm, classId: event.target.value })}><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.level} · {item.trade} · {item.class_name}</option>)}</select></label>
        <label>Subject you teach<input required maxLength={120} value={assignmentForm.subject} onChange={(event) => setAssignmentForm({ ...assignmentForm, subject: event.target.value })} placeholder="e.g. Software Development" /></label>
        <button className="primary-button" disabled={savingAssignment}><Plus size={15} />{savingAssignment ? 'Saving…' : 'Add assignment'}</button>
      </form>
      <div className="teacher-assignment-list">{assignments.map((assignment) => <div key={assignment.id}><span><strong>{assignment.level} · {assignment.trade} · {assignment.class_name}</strong><small>{assignment.subject}{assignment.approval_status === 'Pending' ? ' · Waiting for administrator approval' : ''}</small></span><button className="secondary-button" onClick={() => void removeAssignment(assignment)}>Remove</button></div>)}{!assignments.length && <EmptyState message="Add the classes and subjects you teach before submitting a daily report." />}</div>
    </section>}
    <section className="panel settings-card"><h2>Send today’s report</h2><p>Reports are visible to the school administrator after submission.</p>
      <form className="modal-form" onSubmit={submit}>
        <div className="field-grid two">
          <label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          {user?.role === 'Teacher' ? <>
            <label>Class<select required value={form.classId} onChange={(event) => {
              const classId = event.target.value
              const subject = assignments.find((assignment) => String(assignment.class_id) === classId)?.subject || ''
              setForm({ ...form, classId, subject, studentId: '' })
            }}><option value="">Choose a class</option>{[...new Map(approvedAssignments.map((assignment) => [String(assignment.class_id), assignment])).values()].map((assignment) => <option key={assignment.class_id} value={assignment.class_id}>{assignment.level} · {assignment.trade} · {assignment.class_name}</option>)}</select></label>
            <label>Subject taught<select required value={selectedSubject} onChange={(event) => setForm({ ...form, subject: event.target.value })}><option value="">Choose your subject</option>{assignedSubjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
          </> : <label>Subject<input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Subject taught" /></label>}
        </div>
        <label>Lessons covered<textarea required rows="4" value={form.lessons} onChange={(event) => setForm({ ...form, lessons: event.target.value })} placeholder="Topics, exercises, and work completed today" /></label>
        <div className="field-grid two">
          <label>Student behaviour concern (optional)<select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}><option value="">No student referral</option>{students.filter((student) => student.status === 'Active' && (user?.role !== 'Teacher' || String(student.class_id) === form.classId)).map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.student_number}</option>)}</select></label>
          <label>Details for administrator<textarea rows="3" value={form.behaviourNotes} onChange={(event) => setForm({ ...form, behaviourNotes: event.target.value })} placeholder="Describe the concern and relevant context" /></label>
        </div>
        <div className="modal-actions"><button className="primary-button" disabled={saving}>{saving ? 'Sending...' : 'Send report to administrator'}<ArrowUpRight size={16} /></button></div>
      </form>
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Reports from your class</h2><p>Your recent submissions.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>DATE</th><th>SUBJECT</th><th>LESSONS</th><th>BEHAVIOUR REFERRAL</th><th>SENT</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td>{String(report.report_date).slice(0, 10)}</td><td>{report.subject}</td><td>{report.lessons}</td><td>{report.student_name ? `${report.student_name}: ${report.behaviour_notes || ''}` : report.behaviour_notes || '—'}</td><td>{formatDateTime(report.created_at)}</td></tr>)}</tbody></table></div>
      {!reports.length && <EmptyState message="No reports have been submitted for your classes yet." />}
    </section>
  </>
}

function ReportsInboxPage({ token, data, onRefresh, reportError, notify }) {
  async function deleteReport(id) {
    if (!window.confirm('Delete this daily report? This action cannot be undone.')) return
    try {
      await request(`/reports/${id}`, { token, method: 'DELETE' })
      notify('Daily report deleted.')
      await onRefresh()
    } catch (error) { reportError(error.message) }
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATOR" title="Reports inbox" description="Daily subject reports, attendance registers submitted by monitors, and Kinyarwanda guardian messages awaiting an SMS gateway." action={<button className="secondary-button" onClick={() => void onRefresh()}><Activity size={15} />Refresh inbox</button>} />
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Daily subject and behaviour reports</h2><p>Teachers and class monitors submit reports directly to this inbox.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>DATE</th><th>CLASS</th><th>FROM</th><th>SUBJECT</th><th>LESSONS</th><th>BEHAVIOUR CONCERN</th><th>ACTION</th></tr></thead><tbody>{data.reports.map((report) => <tr key={report.id}><td>{String(report.report_date).slice(0, 10)}</td><td>{report.level} · {report.trade} · {report.class_name}</td><td>{report.author} · {report.report_type}</td><td>{report.subject}</td><td>{report.lessons}</td><td>{report.student_name ? <strong>{report.student_name}: </strong> : null}{report.behaviour_notes || '—'}</td><td><button className="secondary-button" onClick={() => deleteReport(report.id)}>Delete</button></td></tr>)}</tbody></table></div>
      {!data.reports.length && <EmptyState message="No daily reports have been submitted." />}
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Attendance sent to administrator</h2><p>Class monitor registers explicitly submitted for review.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>DATE</th><th>CLASS</th><th>TAKEN BY</th><th>SUBMITTED BY</th><th>PRESENT</th><th>ABSENT</th><th>LATE</th><th>AWAY</th><th>UNMARKED</th></tr></thead><tbody>{data.attendance.map((record) => <tr key={record.id}><td>{String(record.date).slice(0, 10)}</td><td>{record.level} · {record.trade} · {record.class_name}</td><td>{record.attended_by}</td><td>{record.author}</td><td>{record.present}</td><td>{record.absent}</td><td>{record.late}</td><td>{record.away}</td><td>{record.not_marked}</td></tr>)}</tbody></table></div>
      {!data.attendance.length && <EmptyState message="No attendance registers have been submitted." />}
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Guardian message outbox</h2><p>Permission approvals create Kinyarwanda messages. They are not sent by SMS until an SMS service is configured.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>GUARDIAN NUMBER</th><th>KINYARWANDA MESSAGE</th><th>CREATED</th></tr></thead><tbody>{data.messages.map((message) => <tr key={message.id}><td>{message.student_name}</td><td>{message.recipient}</td><td>{message.message}</td><td>{formatDateTime(message.created_at)}</td></tr>)}</tbody></table></div>
      {!data.messages.length && <EmptyState message="No guardian messages are waiting in the outbox." />}
    </section>
  </>
}

function SchoolNewsAdminPage({ token, onUnreadCountChange, reportError, notify }) {
  const [news, setNews] = useState([])
  const [messages, setMessages] = useState([])
  const [form, setForm] = useState({ title: '', summary: '', body: '', imageUrl: '', videoUrl: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      request('/public/news'),
      request('/admin/school-messages', { token }),
    ]).then(([newsData, messageData]) => {
      if (cancelled) return
      setNews(newsData.news)
      setMessages(messageData.messages)
      onUnreadCountChange(messageData.messages.filter((message) => message.status === 'New').length)
    }).catch((error) => { if (!cancelled) reportError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [onUnreadCountChange, reportError, token])
  async function publishNews(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await request('/admin/school-news', { token, method: 'POST', body: JSON.stringify(form) })
      const data = await request('/public/news')
      setNews(data.news)
      setForm({ title: '', summary: '', body: '', imageUrl: '', videoUrl: '' })
      notify('News article published on the school website.')
    } catch (error) { reportError(error.message) }
    finally { setSaving(false) }
  }
  async function uploadMedia(file, field) {
    if (!file) return
    setUploadingMedia(true)
    try {
      const uploaded = await request('/admin/school-media', {
        token,
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      setForm((current) => ({ ...current, [field]: mediaUrl(uploaded.url) }))
      notify(field === 'imageUrl' ? 'News photo uploaded.' : 'News video uploaded.')
    } catch (error) { reportError(error.message) }
    finally { setUploadingMedia(false) }
  }
  async function removeNews(article) {
    if (!window.confirm(`Delete “${article.title}” from the public website?`)) return
    try {
      await request(`/admin/school-news/${article.id}`, { token, method: 'DELETE' })
      setNews((current) => current.filter((item) => item.id !== article.id))
      notify('News article removed.')
    } catch (error) { reportError(error.message) }
  }
  async function updateMessage(message, status) {
    try {
      await request(`/admin/school-messages/${message.id}`, { token, method: 'PATCH', body: JSON.stringify({ status }) })
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, status } : item))
      if (message.status !== status) {
        onUnreadCountChange((count) => Math.max(0, count + (status === 'New' ? 1 : -1)))
      }
      notify(status === 'Read' ? 'Message marked as read.' : 'Message marked as new.')
    } catch (error) { reportError(error.message) }
  }
  async function removeMessage(message) {
    if (!window.confirm(`Delete the message from ${message.name}?`)) return
    try {
      await request(`/admin/school-messages/${message.id}`, { token, method: 'DELETE' })
      setMessages((current) => current.filter((item) => item.id !== message.id))
      if (message.status === 'New') onUnreadCountChange((count) => Math.max(0, count - 1))
      notify('Contact message deleted.')
    } catch (error) { reportError(error.message) }
  }
  return <>
    <PageHeading eyebrow="SCHOOL ADMINISTRATOR" title="News & contact messages" description="Publish school updates for the public website and manage messages sent through Contact us." />
    <section className="panel settings-card public-news-admin-form"><h2>Publish a school news article</h2><p>Published articles appear in the public News section.</p>
      <form className="modal-form" onSubmit={publishNews}>
        <label>Headline<input required maxLength="180" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Short summary<input required maxLength="500" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
        <label>Full article<textarea required maxLength="10000" rows="6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
        <label>Photo URL <span className="field-hint">(optional; upload a photo or use an HTTPS image URL)</span><input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://…" /></label>
        <label className="media-upload-field">Upload photo <span className="field-hint">JPEG, PNG, or WebP · max 8 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingMedia} onChange={(event) => void uploadMedia(event.target.files?.[0], 'imageUrl')} /></label>
        <label>Short video URL <span className="field-hint">(optional; upload an MP4 or use an HTTPS MP4 URL)</span><input type="url" value={form.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} placeholder="https://…" /></label>
        <label className="media-upload-field">Upload short video <span className="field-hint">MP4 · max 25 MB</span><input type="file" accept="video/mp4,.mp4" disabled={uploadingMedia} onChange={(event) => void uploadMedia(event.target.files?.[0], 'videoUrl')} /></label>
        {uploadingMedia && <p className="field-hint" role="status">Uploading media…</p>}
        {(form.imageUrl || form.videoUrl) && <div className="news-media-preview">{form.imageUrl && <img src={mediaUrl(form.imageUrl)} alt="News photo preview" />}{form.videoUrl && <video src={mediaUrl(form.videoUrl)} controls preload="metadata" aria-label="News video preview" />}</div>}
        <div className="modal-actions"><button className="primary-button" disabled={saving || uploadingMedia}>{saving ? 'Publishing…' : 'Publish news article'} <ArrowUpRight size={15} /></button></div>
      </form>
    </section>
    <section className="panel table-panel user-management"><div className="table-toolbar"><div><h2>Published news</h2><p>{news.length} articles on the public website.</p></div></div>
      {loading ? <div className="report-loading">Loading news and messages…</div> : <div className="table-scroll"><table><thead><tr><th>HEADLINE</th><th>SUMMARY</th><th>PUBLISHED</th><th>ACTION</th></tr></thead><tbody>{news.map((item) => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.summary}</td><td>{formatDateTime(item.published_at)}</td><td><button className="secondary-button" onClick={() => void removeNews(item)}>Delete</button></td></tr>)}</tbody></table></div>}
      {!news.length && !loading && <EmptyState message="No news published yet." />}
    </section>
    <section className="panel table-panel inbox-section"><div className="table-toolbar"><div><h2>Messages from Contact us</h2><p>Reply by email or phone, then mark each message as read.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>FROM</th><th>CONTACT</th><th>SUBJECT & MESSAGE</th><th>RECEIVED</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{messages.map((message) => <tr key={message.id}><td><strong>{message.name}</strong></td><td><a href={`mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}>{message.email}</a>{message.phone && <small className="sub-cell">{message.phone}</small>}</td><td><strong>{message.subject}</strong><p>{message.message}</p></td><td>{formatDateTime(message.created_at)}</td><td><StatusBadge status={message.status} /></td><td><div className="approval-actions">{message.status === 'New' && <button className="primary-button" onClick={() => void updateMessage(message, 'Read')}>Mark read</button>}<button className="secondary-button" onClick={() => void removeMessage(message)}>Delete</button></div></td></tr>)}</tbody></table></div>
      {!messages.length && <EmptyState message="No contact messages have been received." />}
    </section>
  </>
}

function SettingsPage({ token, user, classes, onCreateClass, onPendingAccountRequestsChange, reportError, notify }) {
  const [users, setUsers] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showClassForm, setShowClassForm] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'Patron' })
  const [classForm, setClassForm] = useState({ level: 'Level 3', trade: 'SOD', className: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  useEffect(() => {
    if (user?.role !== 'Administrator') return undefined
    let cancelled = false
    Promise.all([
      request('/users', { token }),
      request('/admin/teacher-assignments', { token }),
    ])
      .then(([userData, assignmentData]) => {
        if (cancelled) return
        setUsers(userData.users)
        setTeacherAssignments(assignmentData.assignments)
      })
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
  async function reviewAccount(id, status) {
    try {
      await request(`/users/${id}/approval`, { token, method: 'PATCH', body: JSON.stringify({ status }) })
      const data = await request('/users', { token })
      setUsers(data.users)
      const notifications = await request('/admin/notifications', { token })
      onPendingAccountRequestsChange(notifications.pendingAccountRequests)
      notify(`Account request ${status.toLowerCase()}.`)
    } catch (error) { reportError(error.message) }
  }
  async function setTeacherStatus(account, isActive) {
    const action = isActive ? 'restore this teacher account' : 'remove this teacher’s access'
    if (!window.confirm(`Are you sure you want to ${action}?`)) return
    try {
      await request(`/users/${account.id}/status`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      })
      const data = await request('/users', { token })
      setUsers(data.users)
      notify(isActive ? 'Teacher access restored.' : 'Teacher access removed.')
    } catch (error) { reportError(error.message) }
  }
  async function reviewTeachingAssignment(id, status) {
    try {
      await request(`/admin/teacher-assignments/${id}/approval`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      const [assignmentData, userData] = await Promise.all([
        request('/admin/teacher-assignments', { token }),
        request('/users', { token }),
      ])
      setTeacherAssignments(assignmentData.assignments)
      setUsers(userData.users)
      notify(`Teaching assignment ${status.toLowerCase()}.`)
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
    <div className="settings-grid"><section className="panel settings-card"><div className="settings-card-heading"><div className="settings-icon"><GraduationCap size={20} /></div>{user?.role === 'Administrator' && <button className="secondary-button" onClick={() => setShowClassForm(true)}><Plus size={14} />Add class</button>}</div><h2>School structure</h2><p>Student classes are filtered by level and trade throughout the system.</p><div className="structure-list">{levels.map((level) => <div key={level}><strong>{level}</strong><span>{trades.map((trade) => `${trade} · ${classes.filter((item) => item.level === level && item.trade === trade).map((item) => item.class_name).join(', ') || 'No classes'}`).join('  |  ')}</span></div>)}</div><small className="settings-note">{user?.role === 'Administrator' ? 'Add a class to update student registration and attendance options.' : 'School structure changes are managed by your system administrator.'}</small></section><section className="panel settings-card"><div className="settings-icon green"><UserRound size={20} /></div><h2>Your account</h2><p>Signed in identity and permissions for this session.</p><div className="account-detail"><span>Name</span><strong>{user?.name}</strong></div><div className="account-detail"><span>Username</span><strong>{user?.username}</strong></div><div className="account-detail"><span>Role</span><strong><StatusBadge status={user?.role} /></strong></div>    <div className="access-note"><ShieldCheck size={16} />Patrons submit permission requests; only an administrator makes the final approval decision.</div></section><section className="panel settings-card"><div className="settings-icon green"><LockKeyhole size={20} /></div><h2>Change password</h2><p>Choose a new password with at least 12 characters. Your current password is required to confirm this change.</p>{passwordError && <div className="form-error" role="alert">{passwordError}</div>}<form className="settings-password-form" onSubmit={changePassword}><label>Current password<input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label><label>New password<input required minLength="12" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label><label>Confirm new password<input required minLength="12" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} /></label><button className="primary-button"><LockKeyhole size={15} />Update password</button></form></section></div>
    {user?.role === 'Administrator' && <section className="panel table-panel user-management" id="account-requests"><div className="table-toolbar"><div><h2>Account requests {users.filter((account) => account.approval_status === 'Pending').length > 0 && <span className="request-count">{users.filter((account) => account.approval_status === 'Pending').length} pending</span>}</h2><p>Review new requests, approve access, and remove teachers who have left the school.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={16} />Add staff user</button></div><div className="table-scroll"><table><thead><tr><th>NAME</th><th>USERNAME / STUDENT ID</th><th>ACCOUNT TYPE</th><th>CLASS / TEACHING ASSIGNMENTS</th><th>ACCOUNT STATUS</th><th>ADDED</th><th>ACTION</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td><strong>{account.name}</strong></td><td>{account.linked_student_number || account.username}</td><td><StatusBadge status={account.role} /></td><td>{account.role === 'Teacher' ? (account.teaching_assignments || 'No teaching assignments') : account.linked_student_number ? 'Student ID matched to school register' : account.level ? `${account.level} · ${account.trade} · ${account.class_name}` : '—'}{account.role !== 'Teacher' && account.subject ? ` · ${account.subject}` : ''}{account.class_mistress_name ? ` · Mistress: ${account.class_mistress_name}` : ''}</td><td>{account.approval_status === 'Pending' ? <StatusBadge status="Pending" /> : <StatusBadge status={account.is_active ? 'Active' : 'Removed'} />}</td><td>{new Date(account.created_at).toLocaleDateString()}</td><td>{account.approval_status === 'Pending' ? <div className="approval-actions"><button className="primary-button" onClick={() => reviewAccount(account.id, 'Approved')}>Approve</button><button className="secondary-button" onClick={() => reviewAccount(account.id, 'Rejected')}>Reject</button></div> : account.role === 'Teacher' && account.approval_status === 'Approved' && <button className={account.is_active ? 'secondary-button' : 'primary-button'} onClick={() => void setTeacherStatus(account, !account.is_active)}>{account.is_active ? 'Remove teacher' : 'Restore access'}</button>}</td></tr>)}</tbody></table></div>{!users.length && <EmptyState message="No account requests or staff accounts yet." />}</section>}
    {user?.role === 'Administrator' && <section className="panel table-panel user-management"><div className="table-toolbar"><div><h2>Teacher subject and class approvals {teacherAssignments.filter((assignment) => assignment.approval_status === 'Pending').length > 0 && <span className="request-count">{teacherAssignments.filter((assignment) => assignment.approval_status === 'Pending').length} pending</span>}</h2><p>Teachers can request each subject they teach in each class. Approve assignments before they can report or access those students.</p></div></div><div className="table-scroll"><table><thead><tr><th>TEACHER</th><th>LEVEL</th><th>TRADE</th><th>CLASS</th><th>SUBJECT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{teacherAssignments.map((assignment) => <tr key={assignment.id}><td><strong>{assignment.teacher_name}</strong><small className="sub-cell">{assignment.username}</small></td><td>{assignment.level}</td><td>{assignment.trade}</td><td>{assignment.class_name}</td><td>{assignment.subject}</td><td><StatusBadge status={assignment.approval_status} /></td><td>{assignment.approval_status === 'Pending' && <div className="approval-actions"><button className="primary-button" onClick={() => reviewTeachingAssignment(assignment.id, 'Approved')}>Approve</button><button className="secondary-button" onClick={() => reviewTeachingAssignment(assignment.id, 'Rejected')}>Reject</button></div>}</td></tr>)}</tbody></table></div>{!teacherAssignments.length && <EmptyState message="No teaching assignments have been submitted." />}</section>}
    {showForm && <Modal title="Create user account" onClose={() => setShowForm(false)}><form className="modal-form" onSubmit={createUser}><label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Username<input required autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><div className="field-grid two"><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Patron</option><option>Matron</option><option>Authorized Approver</option><option>Read-only Staff</option><option>Administrator</option></select></label><label>Password (12+ characters)<input required minLength="12" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">Create account</button></div></form></Modal>}
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
