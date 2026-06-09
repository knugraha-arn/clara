'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShieldAlert, ClipboardList,
  Bell, Users, LogOut, ShieldCheck, Building2,
  Handshake, Sparkles, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { AvrUserProfile } from '@/types'

const NAV = [
  { href: '/dashboard',               label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/risk-generator',          label: 'Risk Generator', icon: Sparkles, highlight: true },
  { href: '/risks',                   label: 'Risk Register',  icon: ShieldAlert },
  { href: '/risks?filter=review_due', label: 'Review',         icon: ClipboardList },
  { href: '/notifications',           label: 'Notifikasi',     icon: Bell },
  { href: '/reports',                 label: 'Laporan',        icon: FileText },
]

const ADMIN_NAV = [
  { href: '/admin/unit-kerja', label: 'Unit Kerja', icon: Building2 },
  { href: '/admin/pihak-lain', label: 'Pihak Lain', icon: Handshake },
  { href: '/users',            label: 'Pengguna',   icon: Users },
]

interface Props {
  profile: AvrUserProfile
  unreadCount?: number
}

export function Sidebar({ profile, unreadCount = 0 }: Props) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const router       = useRouter()

  function isActive(href: string): boolean {
    const [hrefPath, hrefQuery] = href.split('?')
    if (pathname !== hrefPath) {
      if (hrefPath !== '/risks' && pathname.startsWith(hrefPath + '/')) return true
      return false
    }
    if (hrefQuery) {
      const params = new URLSearchParams(hrefQuery)
      for (const [key, val] of params.entries()) {
        if (searchParams.get(key) !== val) return false
      }
      return true
    } else {
      if (hrefPath === '/risks') return !searchParams.has('filter')
      return true
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-brand-navy flex flex-col z-30">

      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-blue flex items-center justify-center shrink-0">
            <ShieldCheck size={14} className="text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-wide">AVIRA</p>
            <p className="text-white/35 text-[10px] mt-0.5">Risk Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={cn('nav-item', active && 'nav-item-active')}>
              <item.icon size={15} />
              <span>{item.label}</span>
              {'highlight' in item && item.highlight && !active && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-lime text-brand-navy leading-none">
                  AI
                </span>
              )}
              {item.href === '/notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-brand-lime text-brand-navy text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}

        {profile.role === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Admin
            </div>
            {ADMIN_NAV.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={cn('nav-item', active && 'nav-item-active')}>
                  <item.icon size={15} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-white/8">
        <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-full bg-brand-blue flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{profile.full_name}</p>
            <p className="text-white/40 text-[10px] capitalize">{profile.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-item w-full mt-0.5 text-white/40 hover:text-white/70">
          <LogOut size={13} />
          <span>Keluar</span>
        </button>
      </div>

    </aside>
  )
}
