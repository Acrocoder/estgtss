import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const port = Number(process.env.PORT || 4000)
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.')
}
if (!process.env.DB_NAME || !process.env.DB_USER) {
  throw new Error('DB_NAME and DB_USER must be set before starting the server.')
}
if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 8) {
  throw new Error('ADMIN_PASSWORD must contain at least 8 characters.')
}
if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 12) {
  console.warn('The bootstrap administrator password is shorter than 12 characters. Change it before production use.')
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
})

const app = express()
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('This browser origin is not allowed by the API CORS configuration.'))
  },
}))

app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'ESTG TSS API is working'
  })
})

app.get('/api', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'ESTG TSS API is running'
  })
})
const validStatuses = ['Present', 'Absent', 'Late', 'Authorized Away', 'Not Marked']
const validRoles = ['Administrator', 'Patron', 'Authorized Approver', 'Read-only Staff', 'Class Monitor', 'Teacher']
const classStructure = [
  ['Level 3', 'SOD', 'Class A'], ['Level 3', 'SOD', 'Class B'], ['Level 3', 'ELET', 'Class A'],
  ['Level 4', 'SOD', 'Class A'], ['Level 4', 'SOD', 'Class B'], ['Level 4', 'ELET', 'Class A'],
  ['Level 5', 'SOD', 'Class A'], ['Level 5', 'SOD', 'Class B'], ['Level 5', 'ELET', 'Class A'], ['Level 5', 'ELET', 'Class B'],
]

async function initializeDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('Administrator','Patron','Authorized Approver','Read-only Staff','Class Monitor','Teacher') NOT NULL DEFAULT 'Patron',
      approval_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Approved',
      class_id BIGINT UNSIGNED NULL,
      class_mistress_name VARCHAR(160) NULL,
      subject VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS classes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      level VARCHAR(20) NOT NULL,
      trade VARCHAR(20) NOT NULL,
      class_name VARCHAR(30) NOT NULL,
      UNIQUE KEY uq_school_class (level, trade, class_name)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS students (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_number VARCHAR(60) NOT NULL UNIQUE,
      full_name VARCHAR(160) NOT NULL,
      gender VARCHAR(30) NULL,
      student_type ENUM('Internal','External') NOT NULL DEFAULT 'Internal',
      residence_type ENUM('Boarding','Day Scholar') NOT NULL DEFAULT 'Boarding',
      class_id BIGINT UNSIGNED NOT NULL,
      guardian_contact VARCHAR(100) NULL,
      status ENUM('Active','Transferred','Inactive') NOT NULL DEFAULT 'Active',
      registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id),
      INDEX idx_students_name (full_name),
      INDEX idx_students_class_status (class_id, status)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      class_id BIGINT UNSIGNED NOT NULL,
      session_date DATE NOT NULL,
      saved_by BIGINT UNSIGNED NOT NULL,
      saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_attendance_session (class_id, session_date),
      CONSTRAINT fk_attendance_session_class FOREIGN KEY (class_id) REFERENCES classes(id),
      CONSTRAINT fk_attendance_session_user FOREIGN KEY (saved_by) REFERENCES users(id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_id BIGINT UNSIGNED NOT NULL,
      student_id BIGINT UNSIGNED NOT NULL,
      status ENUM('Present','Absent','Late','Authorized Away','Not Marked') NOT NULL DEFAULT 'Not Marked',
      updated_by BIGINT UNSIGNED NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_attendance_student_session (session_id, student_id),
      CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
      CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id),
      CONSTRAINT fk_attendance_user FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS permission_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id BIGINT UNSIGNED NOT NULL,
      departure_at DATETIME NOT NULL,
      expected_return_at DATETIME NOT NULL,
      actual_departure_at DATETIME NULL,
      actual_return_at DATETIME NULL,
      reason TEXT NOT NULL,
      destination VARCHAR(255) NULL,
      notes TEXT NULL,
      status ENUM('Pending','Approved','Rejected','Departed','Returned','Expired') NOT NULL DEFAULT 'Pending',
      requested_by BIGINT UNSIGNED NOT NULL,
      approved_by BIGINT UNSIGNED NULL,
      approved_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_permission_student FOREIGN KEY (student_id) REFERENCES students(id),
      CONSTRAINT fk_permission_requester FOREIGN KEY (requested_by) REFERENCES users(id),
      CONSTRAINT fk_permission_approver FOREIGN KEY (approved_by) REFERENCES users(id),
      INDEX idx_permission_status_return (status, expected_return_at),
      INDEX idx_permission_student_date (student_id, departure_at)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS behaviour_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id BIGINT UNSIGNED NOT NULL,
      incident_id BIGINT UNSIGNED NULL,
      points INT NOT NULL,
      category VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      recorded_by BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_behaviour_student FOREIGN KEY (student_id) REFERENCES students(id),
      CONSTRAINT fk_behaviour_user FOREIGN KEY (recorded_by) REFERENCES users(id),
      INDEX idx_behaviour_student_date (student_id, created_at)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS discipline_incidents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id BIGINT UNSIGNED NOT NULL,
      points INT NOT NULL,
      category VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      severity ENUM('Low','Medium','High') NOT NULL DEFAULT 'Low',
      action_taken TEXT NULL,
      recorded_by BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_incident_student FOREIGN KEY (student_id) REFERENCES students(id),
      CONSTRAINT fk_incident_user FOREIGN KEY (recorded_by) REFERENCES users(id),
      INDEX idx_incident_student_date (student_id, created_at)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(80) NOT NULL,
      entity VARCHAR(80) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      reason TEXT NULL,
      previous_value JSON NULL,
      new_value JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_audit_entity (entity, entity_id, created_at)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS daily_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      author_id BIGINT UNSIGNED NOT NULL,
      class_id BIGINT UNSIGNED NOT NULL,
      report_date DATE NOT NULL,
      report_type ENUM('Class Monitor','Teacher') NOT NULL,
      subject VARCHAR(120) NULL,
      lessons TEXT NULL,
      behaviour_notes TEXT NULL,
      student_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_daily_report_author FOREIGN KEY (author_id) REFERENCES users(id),
      CONSTRAINT fk_daily_report_class FOREIGN KEY (class_id) REFERENCES classes(id),
      CONSTRAINT fk_daily_report_student FOREIGN KEY (student_id) REFERENCES students(id),
      INDEX idx_daily_report_date (report_date, class_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS guardian_message_outbox (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      permission_id BIGINT UNSIGNED NOT NULL UNIQUE,
      student_id BIGINT UNSIGNED NOT NULL,
      recipient VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_guardian_message_permission FOREIGN KEY (permission_id) REFERENCES permission_records(id),
      CONSTRAINT fk_guardian_message_student FOREIGN KEY (student_id) REFERENCES students(id)
    ) ENGINE=InnoDB`,
  ]
  for (const statement of statements) await pool.query(statement)
  await pool.query("ALTER TABLE users MODIFY role ENUM('Administrator','Patron','Authorized Approver','Read-only Staff','Class Monitor','Teacher') NOT NULL DEFAULT 'Patron'")
  const [userColumns] = await pool.query('SHOW COLUMNS FROM users')
  const existingUserColumns = new Set(userColumns.map((column) => column.Field))
  if (!existingUserColumns.has('approval_status')) {
    await pool.query("ALTER TABLE users ADD COLUMN approval_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Approved'")
  }
  if (!existingUserColumns.has('class_id')) await pool.query('ALTER TABLE users ADD COLUMN class_id BIGINT UNSIGNED NULL')
  if (!existingUserColumns.has('class_mistress_name')) await pool.query('ALTER TABLE users ADD COLUMN class_mistress_name VARCHAR(160) NULL')
  if (!existingUserColumns.has('subject')) await pool.query('ALTER TABLE users ADD COLUMN subject VARCHAR(120) NULL')
  const [attendanceColumns] = await pool.query('SHOW COLUMNS FROM attendance_sessions')
  const existingAttendanceColumns = new Set(attendanceColumns.map((column) => column.Field))
  if (!existingAttendanceColumns.has('attended_by')) {
    await pool.query("ALTER TABLE attendance_sessions ADD COLUMN attended_by ENUM('Class Monitor','Class Mistress','Teacher','Staff') NOT NULL DEFAULT 'Staff'")
  }
  if (!existingAttendanceColumns.has('submitted_to_admin')) {
    await pool.query('ALTER TABLE attendance_sessions ADD COLUMN submitted_to_admin BOOLEAN NOT NULL DEFAULT FALSE')
  }
  const [studentColumns] = await pool.query('SHOW COLUMNS FROM students')
  const existingStudentColumns = new Set(studentColumns.map((column) => column.Field))
  if (!existingStudentColumns.has('student_type')) {
    await pool.query("ALTER TABLE students ADD COLUMN student_type ENUM('Internal','External') NOT NULL DEFAULT 'Internal' AFTER gender")
  }
  if (!existingStudentColumns.has('residence_type')) {
    await pool.query("ALTER TABLE students ADD COLUMN residence_type ENUM('Boarding','Day Scholar') NOT NULL DEFAULT 'Boarding' AFTER student_type")
  }
  for (const [level, trade, className] of classStructure) {
    await pool.execute('INSERT IGNORE INTO classes (level, trade, class_name) VALUES (?, ?, ?)', [level, trade, className])
  }
  if (process.env.RESET_ADMIN_PASSWORD === 'true' && (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set to reset the administrator password.')
  }
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [process.env.ADMIN_USERNAME])
    if (!existing.length && process.env.ADMIN_NAME) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
      await pool.execute('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)', [
        process.env.ADMIN_USERNAME, process.env.ADMIN_NAME, passwordHash, 'Administrator',
      ])
      console.info(`Created initial administrator account "${process.env.ADMIN_USERNAME}".`)
    } else if (!existing.length) {
      throw new Error('ADMIN_NAME must be set when creating the initial administrator account.')
    } else if (process.env.RESET_ADMIN_PASSWORD === 'true') {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, existing[0].id])
      console.info(`Reset the password for administrator account "${process.env.ADMIN_USERNAME}".`)
    }
  }
}

function authenticate(req, res, next) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Authentication is required.' })
  try {
    req.user = jwt.verify(token, jwtSecret)
    return next()
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or has expired. Please sign in again.' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' })
    return next()
  }
}

function requireWrite(req, res, next) {
  if (['Read-only Staff', 'Class Monitor', 'Teacher'].includes(req.user.role)) {
    return res.status(403).json({ error: 'This account cannot change this type of record.' })
  }
  return next()
}

function inputError(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

async function audit(connection, userId, action, entity, entityId, reason, previousValue, newValue) {
  await connection.execute(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, reason, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, entity, entityId || null, reason || null, previousValue ? JSON.stringify(previousValue) : null, newValue ? JSON.stringify(newValue) : null],
  )
}

async function getClass(level, trade, className) {
  const [rows] = await pool.execute('SELECT id FROM classes WHERE level = ? AND trade = ? AND class_name = ?', [level, trade, className])
  return rows[0]?.id
}

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) throw inputError('Enter your username and password.')
    const [rows] = await pool.execute('SELECT id, username, name, password_hash, role, approval_status, class_id, class_mistress_name, subject FROM users WHERE username = ?', [username])
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Incorrect username or password.' })
    const { password_hash: _, ...user } = rows[0]
    if (user.approval_status !== 'Approved') {
      return res.status(403).json({ error: user.approval_status === 'Rejected' ? 'This account request was not approved. Contact the administrator.' : 'Your account is waiting for administrator approval.' })
    }
    const token = jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role, class_id: user.class_id }, jwtSecret, { expiresIn: '12h' })
    return res.json({ token, user })
  } catch (error) { return next(error) }
})

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { username, name, password, role, level, trade, className, classMistressName, subject } = req.body || {}
    if (!username?.trim() || !name?.trim() || typeof password !== 'string' || password.length < 12 ||
        !['Class Monitor', 'Teacher'].includes(role) || !level || !trade || !className) {
      throw inputError('Enter your name, username, a password of at least 12 characters, role, and class.')
    }
    if (role === 'Class Monitor' && !classMistressName?.trim()) throw inputError('Enter the class mistress name for this class.')
    if (role === 'Teacher' && !subject?.trim()) throw inputError('Enter the subject you teach.')
    const classId = await getClass(level, trade, className)
    if (!classId) throw inputError('That class is not configured.')
    const passwordHash = await bcrypt.hash(password, 12)
    await pool.execute(
      `INSERT INTO users (username, name, password_hash, role, approval_status, class_id, class_mistress_name, subject)
       VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [username.trim(), name.trim(), passwordHash, role, classId, role === 'Class Monitor' ? classMistressName.trim() : null, role === 'Teacher' ? subject.trim() : null],
    )
    return res.status(201).json({ status: 'Pending', message: 'Your account request was sent to the administrator for approval.' })
  } catch (error) { return next(error) }
})

app.post('/api/auth/change-password', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection()
  let transactionStarted = false
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      throw inputError('Enter your current password and a new password.')
    }
    if (newPassword.length < 12) throw inputError('Your new password must contain at least 12 characters.')

    const [rows] = await connection.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
    if (!rows.length) return res.status(401).json({ error: 'This account is no longer available.' })
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Your current password is incorrect.' })
    }
    if (currentPassword === newPassword) throw inputError('Choose a new password that is different from your current password.')

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await connection.beginTransaction()
    transactionStarted = true
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id])
    await audit(connection, req.user.id, 'update', 'user', req.user.id, 'Account password changed', null, { passwordChanged: true })
    await connection.commit()
    return res.json({ success: true })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, name, role, approval_status, class_id, class_mistress_name, subject FROM users WHERE id = ?', [req.user.id])
    if (!rows.length) return res.status(401).json({ error: 'This account is no longer available.' })
    return res.json({ user: rows[0] })
  } catch (error) { return next(error) }
})

app.get('/api/classes', authenticate, async (_req, res, next) => {
  try {
    const [classes] = await pool.execute(
      `SELECT id, level, trade, class_name FROM classes
       ${_req.user.role === 'Class Monitor' || _req.user.role === 'Teacher' ? 'WHERE id = ?' : ''}
       ORDER BY level, trade, class_name`,
      _req.user.role === 'Class Monitor' || _req.user.role === 'Teacher' ? [_req.user.class_id] : [],
    )
    return res.json({ classes })
  } catch (error) { return next(error) }
})

app.get('/api/public/classes', async (_req, res, next) => {
  try {
    const [classes] = await pool.query('SELECT id, level, trade, class_name FROM classes ORDER BY level, trade, class_name')
    return res.json({ classes })
  } catch (error) { return next(error) }
})

app.post('/api/classes', authenticate, requireRole('Administrator'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { level, trade, className } = req.body || {}
    if (!['Level 3', 'Level 4', 'Level 5'].includes(level) ||
        !['SOD', 'ELET'].includes(trade) ||
        !/^Class [A-Z]$/.test(className || '')) {
      throw inputError('Choose a valid level and trade and enter a class name such as "Class C".')
    }
    await connection.beginTransaction()
    const [result] = await connection.execute('INSERT INTO classes (level, trade, class_name) VALUES (?, ?, ?)', [level, trade, className])
    await audit(connection, req.user.id, 'create', 'class', result.insertId, 'School structure update', null, { level, trade, className })
    await connection.commit()
    return res.status(201).json({ id: result.insertId })
  } catch (error) { await connection.rollback(); return next(error) }
  finally { connection.release() }
})

app.get('/api/students', authenticate, async (req, res, next) => {
  try {
    const conditions = []
    const params = []
    if (['Class Monitor', 'Teacher'].includes(req.user.role)) {
      conditions.push('s.class_id = ?')
      params.push(req.user.class_id)
    }
    for (const [key, column] of [['level', 'c.level'], ['trade', 'c.trade'], ['class', 'c.class_name'], ['status', 's.status']]) {
      if (req.query[key]) { conditions.push(`${column} = ?`); params.push(req.query[key]) }
    }
    if (req.query.search) {
      conditions.push('(s.full_name LIKE ? OR s.student_number LIKE ?)')
      params.push(`%${req.query.search}%`, `%${req.query.search}%`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [students] = await pool.execute(
      `SELECT s.id, s.student_number, s.full_name, s.gender, s.student_type, s.residence_type, s.guardian_contact, s.status, s.registered_at, c.level, c.trade, c.class_name,
        COALESCE((SELECT SUM(bt.points) FROM behaviour_transactions bt WHERE bt.student_id = s.id), 0) AS points
       FROM students s JOIN classes c ON c.id = s.class_id ${where} ORDER BY s.full_name`,
      params,
    )
    return res.json({ students })
  } catch (error) { return next(error) }
})

app.post('/api/students', authenticate, requireWrite, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { student_number, full_name, gender, student_type = 'Internal', residence_type = 'Boarding', level, trade, className, guardian_contact } = req.body || {}
    if (!student_number?.trim() || !full_name?.trim() || !level || !trade || !className) throw inputError('Student ID, full name, level, trade, and class are required.')
    if (!['Internal', 'External'].includes(student_type) || !['Boarding', 'Day Scholar'].includes(residence_type)) {
      throw inputError('Choose a valid student type and accommodation.')
    }
    const classId = await getClass(level, trade, className)
    if (!classId) throw inputError('That class is not configured for the selected level and trade.')
    await connection.beginTransaction()
    const [result] = await connection.execute(
      'INSERT INTO students (student_number, full_name, gender, student_type, residence_type, class_id, guardian_contact) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [student_number.trim(), full_name.trim(), gender || null, student_type, residence_type, classId, guardian_contact || null],
    )
    await audit(connection, req.user.id, 'create', 'student', result.insertId, 'Student registration', null, { student_number, full_name, student_type, residence_type, level, trade, className })
    await connection.commit()
    return res.status(201).json({ id: result.insertId })
  } catch (error) { await connection.rollback(); return next(error) }
  finally { connection.release() }
})

app.patch('/api/students/:id', authenticate, requireWrite, async (req, res, next) => {
  try {
    const { full_name, gender, student_type, residence_type, level, trade, className, guardian_contact, status } = req.body || {}
    const [beforeRows] = await pool.execute(
      'SELECT s.*, c.level, c.trade, c.class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=?',
      [req.params.id],
    )
    if (!beforeRows.length) return res.status(404).json({ error: 'Student not found.' })
    const before = beforeRows[0]
    if (status && !['Active', 'Transferred', 'Inactive'].includes(status)) throw inputError('Choose a valid student status.')
    if (student_type && !['Internal', 'External'].includes(student_type)) throw inputError('Choose a valid student type.')
    if (residence_type && !['Boarding', 'Day Scholar'].includes(residence_type)) throw inputError('Choose a valid accommodation type.')
    const classId = level && trade && className ? await getClass(level, trade, className) : before.class_id
    if (!classId) throw inputError('That class is not configured for the selected level and trade.')
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute(
        'UPDATE students SET full_name=?, gender=?, student_type=?, residence_type=?, class_id=?, guardian_contact=?, status=? WHERE id=?',
        [full_name?.trim() || before.full_name, gender ?? before.gender, student_type || before.student_type, residence_type || before.residence_type, classId, guardian_contact ?? before.guardian_contact, status || before.status, req.params.id],
      )
      await audit(connection, req.user.id, 'update', 'student', req.params.id, 'Student record correction', { full_name: before.full_name, student_type: before.student_type, residence_type: before.residence_type, status: before.status }, { full_name: full_name || before.full_name, student_type: student_type || before.student_type, residence_type: residence_type || before.residence_type, status: status || before.status })
      await connection.commit()
    } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
    return res.json({ success: true })
  } catch (error) { return next(error) }
})

app.get('/api/students/:id/profile', authenticate, async (req, res, next) => {
  try {
    const [studentRows] = await pool.execute(
      `SELECT s.id, s.class_id, s.student_number, s.full_name, s.gender, s.student_type, s.residence_type, s.guardian_contact, s.status, s.registered_at,
       c.level, c.trade, c.class_name,
       COALESCE((SELECT SUM(points) FROM behaviour_transactions WHERE student_id=s.id), 0) AS points
       FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=?`,
      [req.params.id],
    )
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found.' })
    if (['Class Monitor', 'Teacher'].includes(req.user.role) &&
        Number(studentRows[0].class_id) !== Number(req.user.class_id)) {
      return res.status(403).json({ error: 'You can only access student profiles for your assigned class.' })
    }
    const [attendance] = await pool.execute(
      `SELECT ss.session_date AS date, ar.status, ar.updated_at, u.name AS recorded_by
       FROM attendance_records ar JOIN attendance_sessions ss ON ss.id=ar.session_id
       JOIN users u ON u.id=ar.updated_by
       WHERE ar.student_id=? ORDER BY ss.session_date DESC LIMIT 100`,
      [req.params.id],
    )
    const [permissions] = await pool.execute(
      `SELECT p.id, p.departure_at, p.expected_return_at, p.actual_departure_at, p.actual_return_at,
       p.reason, p.destination, p.notes, p.status, p.created_at, p.approved_at,
       requester.name AS requested_by, approver.name AS approved_by
       FROM permission_records p JOIN users requester ON requester.id=p.requested_by
       LEFT JOIN users approver ON approver.id=p.approved_by
       WHERE p.student_id=? ORDER BY p.created_at DESC LIMIT 100`,
      [req.params.id],
    )
    const [behaviour] = await pool.execute(
      `SELECT bt.id, bt.points, bt.category, bt.description, bt.created_at, u.name AS recorded_by,
       CASE WHEN bt.incident_id IS NULL THEN 'Positive' ELSE 'Incident' END AS kind,
       di.severity, di.action_taken
       FROM behaviour_transactions bt JOIN users u ON u.id=bt.recorded_by
       LEFT JOIN discipline_incidents di ON di.id=bt.incident_id
       WHERE bt.student_id=? ORDER BY bt.created_at DESC LIMIT 100`,
      [req.params.id],
    )
    return res.json({ student: studentRows[0], attendance, permissions, behaviour })
  } catch (error) { return next(error) }
})

app.get('/api/attendance', authenticate, async (req, res, next) => {
  try {
    const conditions = []
    const params = []
    if (req.query.from || req.query.to) {
      const start = req.query.from || req.query.to
      const end = req.query.to || req.query.from
      if (!isValidDateOnly(start) || !isValidDateOnly(end)) throw inputError('Enter valid report start and end dates.')
      if (start > end) throw inputError('The start date must be before or equal to the end date.')
      conditions.push('ss.session_date BETWEEN ? AND ?')
      params.push(start, end)
    } else {
      const date = req.query.date || new Date().toISOString().slice(0, 10)
      if (!isValidDateOnly(date)) throw inputError('Enter a valid attendance date.')
      conditions.push('ss.session_date = ?')
      params.push(date)
    }
    for (const [key, column] of [['level', 'c.level'], ['trade', 'c.trade'], ['class', 'c.class_name']]) {
      if (req.query[key]) { conditions.push(`${column} = ?`); params.push(req.query[key]) }
    }
    if (['Class Monitor', 'Teacher'].includes(req.user.role)) {
      conditions.push('ss.class_id = ?')
      params.push(req.user.class_id)
    }
    const [records] = await pool.execute(
      `SELECT ar.id, s.id AS student_id, s.student_number, s.full_name, c.level, c.trade, c.class_name,
       ss.session_date AS date, ss.saved_at, saver.name AS saved_by, ss.attended_by, ss.submitted_to_admin,
       ar.status, ar.updated_at, u.name AS recorded_by
       FROM attendance_records ar JOIN attendance_sessions ss ON ss.id=ar.session_id
       JOIN students s ON s.id=ar.student_id JOIN classes c ON c.id=s.class_id JOIN users u ON u.id=ar.updated_by
       JOIN users saver ON saver.id=ss.saved_by
       WHERE s.student_type='Internal' AND s.residence_type='Boarding' AND ${conditions.join(' AND ')} ORDER BY s.full_name`,
      params,
    )
    let session = null
    if (req.query.date && req.query.level && req.query.trade && req.query.class) {
      const [sessions] = await pool.execute(
        `SELECT ss.session_date AS date, ss.saved_at, u.name AS saved_by, ss.attended_by, ss.submitted_to_admin
         FROM attendance_sessions ss JOIN classes c ON c.id=ss.class_id JOIN users u ON u.id=ss.saved_by
         WHERE ss.session_date=? AND c.level=? AND c.trade=? AND c.class_name=? ${['Class Monitor', 'Teacher'].includes(req.user.role) ? 'AND ss.class_id=?' : ''}`,
        ['Class Monitor', 'Teacher'].includes(req.user.role)
          ? [req.query.date, req.query.level, req.query.trade, req.query.class, req.user.class_id]
          : [req.query.date, req.query.level, req.query.trade, req.query.class],
      )
      session = sessions[0] || null
    }
    return res.json({ records, session })
  } catch (error) { return next(error) }
})

app.post('/api/attendance', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { date, level, trade, className, records, reason, attendedBy = 'Staff', submitToAdmin = false } = req.body || {}
    if (!isValidDateOnly(date) || !level || !trade || !className || !Array.isArray(records) || !records.length) throw inputError('Select a valid date and class with students before saving attendance.')
    if (!['Administrator', 'Patron', 'Authorized Approver', 'Class Monitor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'This account cannot record attendance.' })
    }
    if (!['Class Monitor', 'Class Mistress', 'Teacher', 'Staff'].includes(attendedBy)) throw inputError('Select who is taking attendance.')
    if (req.user.role === 'Class Monitor' && !['Class Monitor', 'Class Mistress'].includes(attendedBy)) throw inputError('Attendance must be recorded by the class monitor or class mistress.')
    if (req.user.role === 'Class Monitor' && !submitToAdmin) throw inputError('Select “Send to administrator” to submit this attendance register.')
    if (records.every((record) => record.status === 'Not Marked')) {
      throw inputError('Mark at least one student Present, Absent, Late, or Authorized Away before saving attendance.')
    }
    const [classRows] = await connection.execute('SELECT id FROM classes WHERE level=? AND trade=? AND class_name=?', [level, trade, className])
    if (!classRows.length) throw inputError('That class is not configured.')
    const classId = classRows[0].id
    if (['Class Monitor', 'Teacher'].includes(req.user.role) && Number(classId) !== Number(req.user.class_id)) {
      return res.status(403).json({ error: 'You can only access your assigned class.' })
    }
    const ids = [...new Set(records.map((record) => Number(record.studentId)))]
    if (ids.length !== records.length) throw inputError('A student appears more than once in this attendance session.')
    for (const record of records) if (!validStatuses.includes(record.status)) throw inputError('Choose a valid attendance status for every student.')
    const placeholders = ids.map(() => '?').join(',')
    const [enrolled] = await connection.execute(`SELECT id FROM students WHERE class_id=? AND status='Active' AND student_type='Internal' AND residence_type='Boarding' AND id IN (${placeholders})`, [classId, ...ids])
    if (enrolled.length !== ids.length) throw inputError('Attendance can only be recorded for active internal boarding students in this class. External students and day scholars are not included in the attendance register.')
    await connection.beginTransaction()
    await connection.execute(
      `INSERT INTO attendance_sessions (class_id, session_date, saved_by, attended_by, submitted_to_admin)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE saved_by=VALUES(saved_by), saved_at=CURRENT_TIMESTAMP,
       attended_by=VALUES(attended_by), submitted_to_admin=IF(VALUES(submitted_to_admin), TRUE, submitted_to_admin)`,
      [classId, date, req.user.id, attendedBy, Boolean(submitToAdmin)],
    )
    const [sessions] = await connection.execute('SELECT id FROM attendance_sessions WHERE class_id=? AND session_date=?', [classId, date])
    const sessionId = sessions[0].id
    const [oldRecords] = await connection.execute('SELECT student_id, status FROM attendance_records WHERE session_id=?', [sessionId])
    const oldStatus = new Map(oldRecords.map((record) => [String(record.student_id), record.status]))
    for (const record of records) {
      if (oldStatus.has(String(record.studentId)) &&
          oldStatus.get(String(record.studentId)) !== record.status &&
          !reason?.trim()) {
        throw inputError('Enter a reason to correct previously saved attendance.')
      }
      await connection.execute(
        'INSERT INTO attendance_records (session_id, student_id, status, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP',
        [sessionId, record.studentId, record.status, req.user.id],
      )
      if (oldStatus.get(String(record.studentId)) !== record.status) {
        await audit(connection, req.user.id, 'mark', 'attendance', record.studentId, reason?.trim() || `Initial attendance mark for ${date}`, { status: oldStatus.get(String(record.studentId)) || 'Not Marked' }, { status: record.status, date, classId })
      }
    }
    await connection.commit()
    return res.json({ success: true, savedAt: new Date().toISOString(), savedBy: req.user.name })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally { connection.release() }
})

app.get('/api/permissions', authenticate, async (req, res, next) => {
  try {
    const params = []
    const conditions = []
    if (req.query.status) { conditions.push('p.status=?'); params.push(req.query.status) }
    if (['Class Monitor', 'Teacher'].includes(req.user.role)) {
      conditions.push('s.class_id=?')
      params.push(req.user.class_id)
    }
    const filter = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [permissions] = await pool.execute(
      `SELECT p.id, p.student_id, s.student_number, s.full_name, c.level, c.trade, c.class_name, p.departure_at, p.expected_return_at,
        p.actual_departure_at, p.actual_return_at, p.reason, p.destination, p.notes, p.status, requester.name AS requested_by,
        approver.name AS approved_by, p.approved_at, p.created_at,
        (p.status='Departed' AND p.expected_return_at < UTC_TIMESTAMP()) AS overdue
       FROM permission_records p JOIN students s ON s.id=p.student_id JOIN classes c ON c.id=s.class_id
       JOIN users requester ON requester.id=p.requested_by LEFT JOIN users approver ON approver.id=p.approved_by
       ${filter} ORDER BY p.created_at DESC`,
      params,
    )
    return res.json({ permissions })
  } catch (error) { return next(error) }
})

app.get('/api/permissions/:id', authenticate, async (req, res, next) => {
  try {
    const [records] = await pool.execute(
      `SELECT p.id, p.student_id, s.class_id, s.student_number, s.full_name, c.level, c.trade, c.class_name,
       p.departure_at, p.expected_return_at, p.actual_departure_at, p.actual_return_at,
       p.reason, p.destination, p.notes, p.status, p.created_at, p.approved_at,
       requester.name AS requested_by, approver.name AS approved_by
       FROM permission_records p JOIN students s ON s.id=p.student_id
       JOIN classes c ON c.id=s.class_id JOIN users requester ON requester.id=p.requested_by
       LEFT JOIN users approver ON approver.id=p.approved_by WHERE p.id=?`,
      [req.params.id],
    )
    if (['Class Monitor', 'Teacher'].includes(req.user.role) &&
        records[0] && Number(records[0].class_id) !== Number(req.user.class_id)) {
      return res.status(403).json({ error: 'You can only access permission records for your assigned class.' })
    }
    if (!records.length) return res.status(404).json({ error: 'Permission record not found.' })
    const [history] = await pool.execute(
      `SELECT a.action, a.reason, a.previous_value, a.new_value, a.created_at, u.name AS changed_by
       FROM audit_logs a JOIN users u ON u.id=a.user_id
       WHERE a.entity='permission' AND a.entity_id=? ORDER BY a.created_at ASC, a.id ASC`,
      [req.params.id],
    )
    return res.json({ permission: records[0], history })
  } catch (error) { return next(error) }
})

app.post('/api/permissions', authenticate, requireWrite, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { studentId, departureAt, expectedReturnAt, reason, destination, notes } = req.body || {}
    if (!studentId || !departureAt || !expectedReturnAt || !reason?.trim() ||
        Number.isNaN(Date.parse(departureAt)) || Number.isNaN(Date.parse(expectedReturnAt))) {
      throw inputError('Student, valid departure and return times, and reason are required.')
    }
    if (new Date(expectedReturnAt) <= new Date(departureAt)) throw inputError('Expected return must be after the departure time.')
    const [student] = await connection.execute(
      `SELECT id FROM students WHERE id=? AND status=? ${['Class Monitor', 'Teacher'].includes(req.user.role) ? 'AND class_id=?' : ''}`,
      ['Class Monitor', 'Teacher'].includes(req.user.role) ? [studentId, 'Active', req.user.class_id] : [studentId, 'Active'],
    )
    if (!student.length) throw inputError('Select an active student.')
    await connection.beginTransaction()
    const [result] = await connection.execute(
      'INSERT INTO permission_records (student_id, departure_at, expected_return_at, reason, destination, notes, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [studentId, new Date(departureAt), new Date(expectedReturnAt), reason.trim(), destination || null, notes || null, req.user.id],
    )
    await audit(connection, req.user.id, 'request', 'permission', result.insertId, reason.trim(), null, { status: 'Pending', studentId })
    await connection.commit()
    return res.status(201).json({ id: result.insertId, status: 'Pending' })
  } catch (error) { await connection.rollback(); return next(error) }
  finally { connection.release() }
})

app.post('/api/permissions/:id/:action', authenticate, requireWrite, async (req, res, next) => {
  const { action } = req.params
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [records] = await connection.execute(
      `SELECT p.*, s.full_name, s.guardian_contact FROM permission_records p
       JOIN students s ON s.id=p.student_id WHERE p.id=? FOR UPDATE`,
      [req.params.id],
    )
    if (!records.length) {
      await connection.rollback()
      return res.status(404).json({ error: 'Permission record not found.' })
    }
    const permission = records[0]
    if (['Class Monitor', 'Teacher'].includes(req.user.role)) {
      const [studentClass] = await connection.execute('SELECT class_id FROM students WHERE id=?', [permission.student_id])
      if (!studentClass.length || Number(studentClass[0].class_id) !== Number(req.user.class_id)) {
        await connection.rollback()
        return res.status(403).json({ error: 'You can only access permission records for your assigned class.' })
      }
    }
    const transitions = { approve: ['Pending', 'Approved'], reject: ['Pending', 'Rejected'], depart: ['Approved', 'Departed'], return: ['Departed', 'Returned'] }
    if (!transitions[action]) throw inputError('Unknown permission action.')
    if (permission.status !== transitions[action][0]) {
      const actionText = { approve: 'approved', reject: 'rejected', depart: 'marked departed', return: 'marked returned' }[action]
      throw inputError(`A ${permission.status.toLowerCase()} permission cannot be ${actionText}.`)
    }
    if (['approve', 'reject'].includes(action) && !['Administrator', 'Authorized Approver'].includes(req.user.role)) {
      await connection.rollback()
      return res.status(403).json({ error: 'Only an authorized approver or administrator can approve or reject permissions.' })
    }
    const nextStatus = transitions[action][1]
    if (action === 'approve') {
      await connection.execute('UPDATE permission_records SET status=?, approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?', [nextStatus, req.user.id, req.params.id])
      if (permission.guardian_contact?.trim()) {
        const returnDate = new Date(permission.expected_return_at).toLocaleString('rw-RW', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kigali' })
        const message = `Mubyeyi wa ${permission.full_name}, turabamenyesha ko uruhushya rwo kuva ku ishuri rwemejwe. Azagaruka ku ishuri ku wa ${returnDate}. Ku yandi makuru mwavugana n'ubuyobozi bw'ishuri.`
        await connection.execute(
          `INSERT INTO guardian_message_outbox (permission_id, student_id, recipient, message)
           VALUES (?, ?, ?, ?)`,
          [req.params.id, permission.student_id, permission.guardian_contact.trim(), message],
        )
      }
    }
    else if (action === 'depart') await connection.execute('UPDATE permission_records SET status=?, actual_departure_at=CURRENT_TIMESTAMP WHERE id=?', [nextStatus, req.params.id])
    else if (action === 'return') await connection.execute('UPDATE permission_records SET status=?, actual_return_at=CURRENT_TIMESTAMP WHERE id=?', [nextStatus, req.params.id])
    else await connection.execute('UPDATE permission_records SET status=? WHERE id=?', [nextStatus, req.params.id])
    await audit(connection, req.user.id, action, 'permission', req.params.id, `Permission ${action}`, { status: permission.status }, { status: nextStatus })
    await connection.commit()
    return res.json({ success: true, status: nextStatus })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally { connection.release() }
})

app.get('/api/behaviour', authenticate, async (_req, res, next) => {
  try {
    const studentScope = ['Class Monitor', 'Teacher'].includes(_req.user.role) ? 'AND s.class_id = ?' : ''
    const scopeParams = ['Class Monitor', 'Teacher'].includes(_req.user.role) ? [_req.user.class_id] : []
    const [transactions] = await pool.query(
      `SELECT bt.id, bt.student_id, s.student_number, s.full_name, c.level, c.trade, c.class_name, 'Positive' AS kind,
       bt.points, bt.category, bt.description, u.name AS recorded_by, bt.created_at, NULL AS severity, NULL AS action_taken
       FROM behaviour_transactions bt JOIN students s ON s.id=bt.student_id JOIN classes c ON c.id=s.class_id JOIN users u ON u.id=bt.recorded_by
       WHERE bt.incident_id IS NULL ${studentScope}`,
      scopeParams,
    )
    const [incidents] = await pool.query(
      `SELECT di.id, di.student_id, s.student_number, s.full_name, c.level, c.trade, c.class_name, 'Incident' AS kind,
       di.points,
       di.category, di.description, u.name AS recorded_by, di.created_at, di.severity, di.action_taken
       FROM discipline_incidents di JOIN students s ON s.id=di.student_id JOIN classes c ON c.id=s.class_id JOIN users u ON u.id=di.recorded_by
       WHERE 1=1 ${studentScope}`,
      scopeParams,
    )
    return res.json({ records: [...transactions, ...incidents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) })
  } catch (error) { return next(error) }
})

app.post('/api/behaviour', authenticate, requireWrite, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { studentId, kind, points, category, description, severity, actionTaken } = req.body || {}
    if (!studentId || !['Positive', 'Incident'].includes(kind) || !category?.trim() || !description?.trim()) throw inputError('Student, record type, category, and reason are required.')
    const numericPoints = Number(points)
    if (!Number.isInteger(numericPoints) || numericPoints === 0 || Math.abs(numericPoints) > 50 || (kind === 'Positive' && numericPoints < 0) || (kind === 'Incident' && numericPoints > 0)) {
      throw inputError('Points must be between 1 and 50, with positive awards and deductions recorded using the correct sign.')
    }
    await connection.beginTransaction()
    const [student] = await connection.execute('SELECT id FROM students WHERE id=? FOR UPDATE', [studentId])
    if (!student.length) throw inputError('Select a registered student.')
    const [[balanceRecord]] = await connection.execute('SELECT COALESCE(SUM(points), 0) AS balance FROM behaviour_transactions WHERE student_id=?', [studentId])
    const previousBalance = Number(balanceRecord.balance)
    let id
    if (kind === 'Positive') {
      const [result] = await connection.execute('INSERT INTO behaviour_transactions (student_id, points, category, description, recorded_by) VALUES (?, ?, ?, ?, ?)', [studentId, numericPoints, category.trim(), description.trim(), req.user.id])
      id = result.insertId
    } else {
      if (!['Low', 'Medium', 'High'].includes(severity)) throw inputError('Choose a valid incident severity.')
      const [incident] = await connection.execute('INSERT INTO discipline_incidents (student_id, points, category, description, severity, action_taken, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [studentId, numericPoints, category.trim(), description.trim(), severity, actionTaken || null, req.user.id])
      id = incident.insertId
      await connection.execute('INSERT INTO behaviour_transactions (student_id, incident_id, points, category, description, recorded_by) VALUES (?, ?, ?, ?, ?, ?)', [studentId, id, numericPoints, category.trim(), description.trim(), req.user.id])
    }
    await audit(connection, req.user.id, 'create', kind === 'Incident' ? 'discipline_incident' : 'behaviour_transaction', id, description.trim(), { balance: previousBalance }, { studentId, points: numericPoints, balance: previousBalance + numericPoints, kind, category })
    await connection.commit()
    return res.status(201).json({ id })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally { connection.release() }
})

app.get('/api/reports', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'Administrator'
    if (!isAdmin && !['Class Monitor', 'Teacher'].includes(req.user.role)) {
      return res.json({ reports: [], attendance: [], messages: [] })
    }
    const scope = isAdmin ? '' : 'WHERE dr.class_id = ?'
    const params = isAdmin ? [] : [req.user.class_id]
    const [reports] = await pool.execute(
      `SELECT dr.id, dr.report_date, dr.report_type, dr.subject, dr.lessons, dr.behaviour_notes,
       dr.student_id, s.full_name AS student_name, c.level, c.trade, c.class_name,
       u.name AS author, dr.created_at
       FROM daily_reports dr JOIN classes c ON c.id=dr.class_id
       JOIN users u ON u.id=dr.author_id
       LEFT JOIN students s ON s.id=dr.student_id ${scope}
       ORDER BY dr.report_date DESC, dr.created_at DESC LIMIT 300`,
      params,
    )
    if (!isAdmin) return res.json({ reports, attendance: [], messages: [] })
    const [attendance] = await pool.query(
      `SELECT ss.id, ss.session_date AS date, ss.attended_by, ss.saved_at,
       u.name AS author, c.level, c.trade, c.class_name,
       SUM(ar.status='Present') AS present,
       SUM(ar.status='Absent') AS absent,
       SUM(ar.status='Late') AS late,
       SUM(ar.status='Authorized Away') AS away,
       SUM(ar.status='Not Marked') AS not_marked
       FROM attendance_sessions ss JOIN users u ON u.id=ss.saved_by
       JOIN classes c ON c.id=ss.class_id
       LEFT JOIN attendance_records ar ON ar.session_id=ss.id
       WHERE ss.submitted_to_admin=TRUE
       GROUP BY ss.id ORDER BY ss.session_date DESC, ss.saved_at DESC LIMIT 300`,
    )
    const [messages] = await pool.query(
      `SELECT gm.id, gm.permission_id, gm.student_id, gm.recipient, gm.message, gm.created_at,
       s.full_name AS student_name
       FROM guardian_message_outbox gm JOIN students s ON s.id=gm.student_id
       ORDER BY gm.created_at DESC LIMIT 300`,
    )
    return res.json({ reports, attendance, messages })
  } catch (error) { return next(error) }
})

app.post('/api/reports', authenticate, async (req, res, next) => {
  try {
    if (!['Class Monitor', 'Teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only approved class monitors and teachers can send daily reports.' })
    }
    const { date, subject, lessons, behaviourNotes, studentId } = req.body || {}
    if (!isValidDateOnly(date) || !subject?.trim() || !lessons?.trim()) {
      throw inputError('Choose the date and enter the subject and lessons covered.')
    }
    if (req.user.role === 'Teacher' && studentId && !behaviourNotes?.trim()) {
      throw inputError('Describe the behaviour concern before referring a student.')
    }
    if (studentId) {
      const [students] = await pool.execute('SELECT id FROM students WHERE id=? AND class_id=? AND status=?', [studentId, req.user.class_id, 'Active'])
      if (!students.length) throw inputError('Choose an active student from your assigned class.')
    }
    const [result] = await pool.execute(
      `INSERT INTO daily_reports
       (author_id, class_id, report_date, report_type, subject, lessons, behaviour_notes, student_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.class_id, date, req.user.role, subject.trim(), lessons.trim(), behaviourNotes?.trim() || null, studentId || null],
    )
    return res.status(201).json({ id: result.insertId, sentToAdministrator: true })
  } catch (error) { return next(error) }
})

app.delete('/api/reports/:id', authenticate, requireRole('Administrator'), async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM daily_reports WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Daily report not found.' })
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, reason)
       VALUES (?, 'delete', 'daily_report', ?, 'Administrator removed an unnecessary daily report')`,
      [req.user.id, req.params.id],
    )
    return res.json({ success: true })
  } catch (error) { return next(error) }
})

app.get('/api/dashboard', authenticate, requireRole('Administrator', 'Patron', 'Authorized Approver', 'Read-only Staff'), async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10)
    if (!isValidDateOnly(date)) throw inputError('Enter a valid dashboard date.')
    const [[total]] = await pool.query("SELECT COUNT(*) AS totalStudents FROM students WHERE status='Active'")
    const [[attendanceSummary]] = await pool.execute(
      `SELECT SUM(ar.status='Present') AS present, SUM(ar.status='Absent') AS absent,
       SUM(ar.status='Late') AS late, SUM(ar.status='Authorized Away') AS away
       FROM attendance_records ar JOIN attendance_sessions ss ON ss.id=ar.session_id
       JOIN students s ON s.id=ar.student_id AND s.student_type='Internal' AND s.residence_type='Boarding'
       WHERE ss.session_date=?`,
      [date],
    )
    const [[away]] = await pool.query("SELECT COUNT(*) AS count FROM permission_records WHERE status='Departed'")
    const [[pending]] = await pool.query("SELECT COUNT(*) AS count FROM permission_records WHERE status='Pending'")
    const [[discipline]] = await pool.query('SELECT COUNT(DISTINCT student_id) AS count FROM discipline_incidents')
    const [classes] = await pool.execute(
      `SELECT c.level, c.trade, c.class_name, COUNT(DISTINCT s.id) AS total,
       COUNT(DISTINCT CASE WHEN ar.status='Present' THEN s.id END) AS present
       FROM classes c LEFT JOIN students s ON s.class_id=c.id AND s.status='Active' AND s.student_type='Internal' AND s.residence_type='Boarding'
       LEFT JOIN attendance_sessions ss ON ss.class_id=c.id AND ss.session_date=?
       LEFT JOIN attendance_records ar ON ar.session_id=ss.id AND ar.student_id=s.id
       GROUP BY c.id ORDER BY c.level, c.trade, c.class_name`,
      [date],
    )
    const [weekly] = await pool.execute(
      `SELECT DATE_FORMAT(ss.session_date, '%a') AS day,
       ROUND(100 * SUM(ar.status IN ('Present','Late')) / NULLIF(COUNT(ar.id), 0)) AS rate
       FROM attendance_sessions ss JOIN attendance_records ar ON ar.session_id=ss.id
       JOIN students s ON s.id=ar.student_id AND s.student_type='Internal' AND s.residence_type='Boarding'
       WHERE ss.session_date BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
       GROUP BY ss.session_date ORDER BY ss.session_date`,
      [date, date],
    )
    const attendanceDenominator = Number(attendanceSummary.present || 0) + Number(attendanceSummary.absent || 0) + Number(attendanceSummary.late || 0)
    const attendanceRate = attendanceDenominator ? Math.round(100 * (Number(attendanceSummary.present || 0) + Number(attendanceSummary.late || 0)) / attendanceDenominator) : 0
    return res.json({
      totalStudents: total.totalStudents,
      present: Number(attendanceSummary.present || 0),
      absent: Number(attendanceSummary.absent || 0),
      away: Number(away.count || 0),
      pending: Number(pending.count || 0),
      disciplineStudents: Number(discipline.count || 0),
      attendanceRate,
      classes,
      weeklyAttendance: weekly.map((item) => ({ day: item.day, rate: Number(item.rate || 0) })),
    })
  } catch (error) { return next(error) }
})

app.get('/api/users', authenticate, requireRole('Administrator'), async (_req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.approval_status, u.class_mistress_name,
       u.subject, u.created_at, c.level, c.trade, c.class_name
       FROM users u LEFT JOIN classes c ON c.id=u.class_id ORDER BY u.created_at DESC`,
    )
    return res.json({ users, roles: validRoles })
  } catch (error) { return next(error) }
})

app.patch('/api/users/:id/approval', authenticate, requireRole('Administrator'), async (req, res, next) => {
  try {
    const { status } = req.body || {}
    if (!['Approved', 'Rejected'].includes(status)) throw inputError('Choose Approved or Rejected.')
    const [result] = await pool.execute(
      `UPDATE users SET approval_status=? WHERE id=? AND role IN ('Class Monitor','Teacher')`,
      [status, req.params.id],
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'Pending staff account not found.' })
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, reason, new_value)
       VALUES (?, 'update', 'user_approval', ?, 'Administrator reviewed staff account', JSON_OBJECT('status', ?))`,
      [req.user.id, req.params.id, status],
    )
    return res.json({ success: true, status })
  } catch (error) { return next(error) }
})

app.post('/api/users', authenticate, requireRole('Administrator'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { username, name, password, role } = req.body || {}
    if (!username?.trim() || !name?.trim() || !password || password.length < 12 ||
        !validRoles.includes(role) || ['Class Monitor', 'Teacher'].includes(role)) {
      throw inputError('Provide a username, name, valid role, and a password of at least 12 characters.')
    }
    const hash = await bcrypt.hash(password, 12)
    await connection.beginTransaction()
    const [result] = await connection.execute('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)', [username.trim(), name.trim(), hash, role])
    await audit(connection, req.user.id, 'create', 'user', result.insertId, 'User account created', null, { username, name, role })
    await connection.commit()
    return res.status(201).json({ id: result.insertId })
  } catch (error) { await connection.rollback(); return next(error) }
  finally { connection.release() }
})

app.use((error, _req, res, _next) => {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with this ID or unique value already exists.' })
  if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'The selected record is not available.' })
  const status = error.status || 500
  if (status >= 500) console.error(error)
  return res.status(status).json({ error: status >= 500 ? 'A server error occurred. Please try again or contact your administrator.' : error.message })
})

initializeDatabase()
  .then(() => app.listen(port, () => console.info(`School Patron API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('Database initialization failed:', error)
    process.exitCode = 1
  })
