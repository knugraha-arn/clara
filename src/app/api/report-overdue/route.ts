import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('avr_user_profiles').select('full_name').eq('id', user.id).single()

  const { data: overdue } = await supabase
    .from('avr_v_overdue_mitigations')
    .select('*')
    .order('days_overdue', { ascending: false })

  const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const classBg: Record<string, string> = { Low: '#D6EFC7', Medium: '#FFF0C2', High: '#FFE0A0', Extreme: '#FFCCCC' }
  const classColor: Record<string, string> = { Low: '#1E5C0A', Medium: '#7A4C00', High: '#6B3500', Extreme: '#CC0000' }

  const rows = (overdue ?? []).map(o => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#0344D8;white-space:nowrap">${o.risk_code}</td>
      <td>
        <div style="font-weight:500;font-size:12px">${o.risk_title}</div>
        <div style="color:#888;font-size:10px;margin-top:2px">${o.category ?? '—'}</div>
      </td>
      <td style="text-align:center">
        <span style="background:${classBg[o.inherent_classification] ?? '#F0F0F0'};color:${classColor[o.inherent_classification] ?? '#666'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">
          ${o.inherent_classification}
        </span>
      </td>
      <td style="font-size:11px">${o.risk_owner_name ?? '—'}</td>
      <td style="font-size:11px;color:#888">${o.target_completion_date ? new Date(o.target_completion_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
      <td style="font-size:12px;color:#CC0000;font-weight:600">+${o.days_overdue} hari</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden;min-width:60px">
            <div style="width:${o.progress_percentage}%;height:100%;background:#0344D8;border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:#888;white-space:nowrap">${o.progress_percentage}%</span>
        </div>
      </td>
      <td style="font-size:11px;color:#666">${o.mitigation_notes ? o.mitigation_notes.substring(0, 80) + (o.mitigation_notes.length > 80 ? '...' : '') : '—'}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1A1F2E; background: white; padding: 32px; }
  .header { border-bottom: 2px solid #FFC128; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22px; font-weight: 700; color: #0344D8; }
  .report-title { font-size: 16px; font-weight: 600; margin-top: 4px; }
  .meta { font-size: 11px; color: #888; margin-top: 4px; }
  .badge { background: #FFF0C2; color: #7A4C00; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .alert-box { background: #FFFBF0; border: 1px solid #FFE0A0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #7A4C00; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F8F9FB; color: #888; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
  td { padding: 10px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand">AVIRA</div>
    <div class="report-title">Overdue Mitigation Report</div>
    <div class="meta">Digenerate: ${now} · Oleh: ${profile?.full_name ?? '—'}</div>
  </div>
  <span class="badge">ISO 27001 · Kl. 9.1</span>
</div>

<div class="alert-box">
  ⚠️ Terdapat <strong>${overdue?.length ?? 0} mitigasi terlambat</strong> per ${now}.
  Mitigasi yang terlambat menunjukkan lemahnya pelaksanaan risk treatment dan perlu segera ditindaklanjuti.
</div>

<table>
  <thead>
    <tr>
      <th>Kode</th>
      <th>Judul Risiko</th>
      <th>Klasifikasi</th>
      <th>Risk Owner</th>
      <th>Target Selesai</th>
      <th>Keterlambatan</th>
      <th>Progress</th>
      <th>Catatan Terakhir</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="8" style="text-align:center;color:#ccc;padding:24px">Tidak ada mitigasi yang terlambat</td></tr>'}
  </tbody>
</table>

<div class="footer">
  <span>AVIRA Risk Management · Arranet</span>
  <span>${now}</span>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
