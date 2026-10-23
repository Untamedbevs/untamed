'use client'

import { useActionState } from 'react'
import Image from 'next/image'
import { AlertCircle, Loader2, LogIn } from 'lucide-react'
import { signIn, type SignInState } from '../actions'

const DEMO_EMAIL = 'staff@untamed.demo'

/** In demo mode any text (or nothing) signs in, so the fields come pre-filled. */
export function LoginForm({ demo }: { demo: boolean }) {
  const initialState: SignInState = { error: null, username: demo ? DEMO_EMAIL : '' }
  const [state, formAction, pending] = useActionState(signIn, initialState)

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex flex-col items-center text-center mb-8">
        <Image
          src="/images/referral-hq/ranks/apex.webp"
          alt=""
          width={112}
          height={112}
          className="h-28 w-28 object-contain drop-shadow-[0_0_30px_rgba(155,48,255,0.45)]"
          priority
        />
        <p className="mt-4 font-condensed text-xs uppercase tracking-[0.35em] text-[#A0A0A0]">
          Untamed Beverages
        </p>
        <h1 className="font-wild text-4xl text-white mt-1">Referral HQ</h1>
        <p className="text-sm text-[#A0A0A0] mt-2">
          Track your code, stack Wild Credit, claim your territory.
        </p>
      </div>

      <form
        action={formAction}
        className="bg-[#141414]/90 backdrop-blur border border-[#2A2A2A] rounded-2xl p-6 space-y-4"
      >
        <div>
          <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-1.5">
            Email
          </label>
          <input
            id="username"
            name="username"
            type={demo ? 'text' : 'email'}
            key={state.username}
            defaultValue={state.username}
            autoComplete="email"
            required={!demo}
            className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-4 py-3 text-white placeholder:text-[#555] focus:outline-none focus:border-[#9B30FF] focus:ring-1 focus:ring-[#9B30FF]"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            defaultValue={demo ? 'demo' : undefined}
            autoComplete="current-password"
            required={!demo}
            className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-4 py-3 text-white placeholder:text-[#555] focus:outline-none focus:border-[#9B30FF] focus:ring-1 focus:ring-[#9B30FF]"
          />
        </div>

        {demo && (
          <p className="rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/[0.06] px-3 py-2 text-xs text-[#FFD700]/90">
            Demo access: type anything (or nothing) and hit Enter the wild.
          </p>
        )}

        {state.error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#9B30FF] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#7E22CE] disabled:opacity-60 transition-colors"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Enter the wild
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] uppercase tracking-[0.25em] text-[#555]">
        Mock-up · demo data only
      </p>
    </div>
  )
}
