import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import Link from 'next/link'
import {
  FileText, AlertTriangle, Clock,
  Flag, TrendingUp, Download,
} from 'lucide-react'
import type { AvrUserProfile } from '@/types'

export const metadata = { title: 'Laporan' }

const REPORTS = [
  {
    id:          'risk-register',
    title:       'Risk Register Report',
    desc:        'Seluruh risiko aktif lengkap dengan owner, score, treatment, dan status mitigasi.',
    icon:        FileText,
    color:       'bg-blue-50 text-brand-blue',
    href:        '/api/report-rr',
    compliance:  'ISO 27001 Kl. 6.1 · ISO 9001 Kl. 6.1',
  },
  {
    id:          'high-risk',
    title:       'High & Extreme Risk Report',
    desc:        'Risiko dengan klasifikasi High dan Extreme, diurutkan berdasarkan score tertinggi.',
    icon:        AlertTriangle,
    color:       'bg-red-50 text-red-600',
    href:        '/api/report-high',
    compliance:  'ISO 27001 Kl. 8.2',
  },
  {
    id:          'overdue',
    title:       'Overdue Mitigation Report',
    desc:        'Risiko dengan mitigasi yang melewati target penyelesaian.',
    icon:        Clock,
    color:       'bg-brand-amber/10 text-[#7A4C00]',
    href:        '/api/report-overdue',
    compliance:  'ISO 27001 Kl. 9.1',
  },
  {
    id:          'mrm',
    title:       'MRM Summary Report',
    desc:        'Ringkasan risiko untuk agenda Management Review Meeting.',
    icon:        Flag,
    color:       'bg-brand-lime/20 text-brand-navy',
    href:        '/api/report-mrm',
    compliance:  'ISO 27001 Kl. 9.3 · ISO 9001 Kl. 9.3',
  },
]

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('avr_user_profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')

  const { count: unreadCount } = await supabase
    .from('avr_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('is_read', false)

  return (
    <div className="flex min-h-screen bg-brand-gray">
      <Sidebar profile={profile as AvrUserProfile} unreadCount={unreadCount ?? 0} />
      <main className="flex-1 ml-56 min-w-0">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

          <div>
            <span className="eyebrow">Export</span>
            <h1 className="mt-1">Laporan</h1>
            <p className="text-sm text-black/50 mt-0.5">
              Generate laporan dalam format PDF — siap untuk audit ISO 27001 & ISO 9001
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map(r => (
              <div key={r.id} className="card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.color}`}>
                    <r.icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-brand-navy">{r.title}</h3>
                    <p className="text-xs text-black/40 mt-0.5">{r.compliance}</p>
                  </div>
                </div>
                <p className="text-xs text-black/60 leading-relaxed mb-4">{r.desc}</p>
                <a href={r.href} target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-xs gap-1.5 w-full justify-center py-2">
                  <Download size={13} /> Generate PDF
                </a>
              </div>
            ))}
          </div>

          <div className="card bg-brand-gray border-0 p-4">
            <p className="text-xs text-black/40 leading-relaxed">
              <strong className="text-black/60">Catatan:</strong> Laporan di-generate secara real-time dari data terkini.
              Setiap laporan menyertakan tanggal generate dan nama pembuat untuk keperluan audit trail.
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
