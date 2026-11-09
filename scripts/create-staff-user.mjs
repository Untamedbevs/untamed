// Provision a staff login (Supabase Auth user + `staff` row), the same two steps as POST /api/admin/staff.
// Staff access (/admin, /referral-hq) is granted by resolveStaff(): an Auth user linked to an active staff row.
//
//   npm run staff:create -- --email you@example.com --name "Your Name" [--role super_admin] [--reset-password] [--yes]
//
// The password is typed at a hidden prompt (or read from STAFF_PASSWORD for non-interactive runs).
// It is never written to disk, and neither it nor any key is printed.
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const env = process.env

const VALID_ROLES = ['super_admin', 'admin', 'contractor_full', 'contractor_limited']

function die(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const email = option('email')?.trim().toLowerCase()
const fullName = option('name')?.trim()
const role = option('role') || 'super_admin'
const resetPassword = flag('reset-password')

if (!email) die('--email is required')
if (!fullName) die('--name is required')
if (!VALID_ROLES.includes(role)) die(`--role must be one of: ${VALID_ROLES.join(', ')}`)
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  die('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)')
}

function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process
    let value = ''
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          stdout.write('\n')
          return resolve(value)
        }
        if (ch === '\u0003') process.exit(130)
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function readPassword() {
  if (env.STAFF_PASSWORD) return env.STAFF_PASSWORD
  if (!process.stdin.isTTY) die('No terminal available; set STAFF_PASSWORD for a non-interactive run')
  return askHidden('Password for the new login: ')
}

const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host
console.log(`Target Supabase project: ${host}`)
console.log(`Will ensure ${email} is an active "${role}" staff member.`)
if (!flag('yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question('Continue? [y/N] ')).trim().toLowerCase()
  rl.close()
  if (answer !== 'y' && answer !== 'yes') die('Cancelled, nothing was changed')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findAuthUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) die(`Could not list auth users: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === email)
    if (match) return match
    if (data.users.length < 200) return null
  }
}

let authUser = await findAuthUser()
let password = null

if (!authUser) {
  password = await readPassword()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
    // Marks the login as created by the app (src/lib/auth/app-account.ts).
    app_metadata: { untamed_portal: true },
  })
  if (error || !data.user) die(`Could not create the auth user: ${error?.message || 'unknown error'}`)
  authUser = data.user
  console.log('Created auth user.')
} else if (resetPassword) {
  password = await readPassword()
  const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(authUser.app_metadata || {}), untamed_portal: true },
  })
  if (error) die(`Could not reset the password: ${error.message}`)
  console.log('Reset password on the existing auth user.')
} else {
  console.log('Auth user already exists; password left unchanged (use --reset-password to set it).')
}

const { data: existing, error: lookupError } = await supabase
  .from('staff')
  .select('id, auth_user_id')
  .eq('email', email)
  .maybeSingle()
if (lookupError) die(`Could not read staff: ${lookupError.message}`)
if (existing?.auth_user_id && existing.auth_user_id !== authUser.id) {
  die('A staff row for this email is already linked to a different auth user; resolve it manually')
}

const { data: staff, error: staffError } = existing
  ? await supabase
      .from('staff')
      .update({ role, is_active: true, auth_user_id: authUser.id })
      .eq('id', existing.id)
      .select('id, email, role, is_active')
      .single()
  : await supabase
      .from('staff')
      .insert({ email, full_name: fullName, role, is_active: true, auth_user_id: authUser.id })
      .select('id, email, role, is_active')
      .single()
if (staffError) die(`Could not write staff: ${staffError.message}`)
console.log(`${existing ? 'Updated' : 'Created'} staff row: ${staff.email} · ${staff.role} · active=${staff.is_active}`)

// Prove the credentials work the way /admin/login uses them (public key, password grant).
if (password && env.NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await anon.auth.signInWithPassword({ email, password })
  console.log(error ? `Sign-in check FAILED: ${error.message}` : 'Sign-in check passed.')
  if (!error) await anon.auth.signOut()
  if (error) process.exit(1)
}

console.log('Done. Sign in at /admin/login, then open /referral-hq.')
