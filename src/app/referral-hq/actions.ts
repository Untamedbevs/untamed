'use server'

import { redirect } from 'next/navigation'
import { checkCredentials, endSession, startSession } from '@/lib/referral-hq/auth'

export type SignInState = { error: string | null; username: string }

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get('username') || '')
  const password = String(formData.get('password') || '')

  if (!checkCredentials(username, password)) {
    return { error: 'That email and password don’t match.', username }
  }

  await startSession(username.trim().toLowerCase())
  redirect('/referral-hq')
}

export async function signOut() {
  await endSession()
  redirect('/referral-hq/login')
}
