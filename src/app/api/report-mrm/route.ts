import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('avr_user_profiles').select('full_name').eq('id', user.id).single()

  const [{ data: risks }, { data: summary }, { data: overdue }] = await Promise.all([
    supabase.from('avr_risks')
      .select(`risk_code, title, inherent_classification, inherent_score, status, treatment_strategy, mrm_reason, next_review_date, risk_owner:avr_user_profiles!avr_risks_risk_owner_id_fkey(full_name), unit_kerja:avr_unit_kerja(nama)`)
      .eq('is_mrm_flagged', true).neq('status', 'Closed')
      .order('inherent_score', { ascending: false }),
    supabase.from('avr_v_dashboard_summary').select('*').single(),
    supabase.from('avr_v_overdue_mitigations').select('*'),
  ])

  const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const classBg: Record<string, string> = { Low: '#D6EFC7', Medium: '#FFF0C2', High: '#FFE0A0', Extreme: '#FFCCCC' }
  const classColor: Record<string, string> = { Low: '#1E5C0A', Medium: '#7A4C00', High: '#6B3500', Extreme: '#CC0000' }

  const riskRows = (risks ?? []).map(r => {
    const cls = r.inherent_classification ?? 'Low'
    return `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#0344D8">${r.risk_code}</td>
      <td>
        <div style="font-weight:500;font-size:12px">${r.title}</div>
        <div style="color:#888;font-size:10px;margin-top:2px">${(r as any).unit_kerja?.nama ?? '—'}</div>
      </td>
      <td style="text-align:center">
        <span style="background:${classBg[cls]};color:${classColor[cls]};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">${cls} (${r.inherent_score})</span>
      </td>
      <td style="font-size:11px">${(r as any).risk_owner?.full_name ?? '—'}</td>
      <td style="font-size:11px">${r.treatment_strategy ?? '—'}</td>
      <td style="font-size:11px;color:#888">${r.mrm_reason ?? '—'}</td>
    </tr>`
  }).join('')

  const overdueRows = (overdue ?? []).map(o => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#0344D8">${o.risk_code}</td>
      <td style="font-size:12px">${o.risk_title}</td>
      <td style="font-size:11px">${o.risk_owner_name}</td>
      <td style="font-size:11px;color:#CC0000;font-weight:500">+${o.days_overdue} hari</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden">
            <div style="width:${o.progress_percentage}%;height:100%;background:#0344D8;border-radius:3px"></div>
          </div>
          <span style="font-size:10px;color:#888">${o.progress_percentage}%</span>
        </div>
      </td>
    </tr>`
  ).join('')

  const s = summary as any

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1A1F2E; background: white; padding: 32px; }
  .header { border-bottom: 2px solid #0344D8; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; color: #0344D8; }
  .report-title { font-size: 16px; font-weight: 600; margin-top: 4px; }
  .meta { font-size: 11px; color: #888; margin-top: 4px; }
  .badge { background: #D1EA2C; color: #1A1F2E; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .section-title { font-size: 13px; font-weight: 600; color: #1A1F2E; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
  .kpi { background: #F8F9FB; border-radius: 8px; padding: 12px 16px; }
  .kpi-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-value { font-size: 28px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #F8F9FB; color: #888; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
  td { padding: 10px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>

<div class="header" style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <div class="brand">AVIRA</div>
    <div class="report-title">Management Review Meeting — Risk Summary</div>
    <div class="meta">Digenerate: ${now} · Oleh: ${profile?.full_name ?? '—'}</div>
  </div>
  <span class="badge">ISO 27001 Kl. 9.3 · ISO 9001 Kl. 9.3</span>
</div>

<div class="section-title">1. Ringkasan Status Risiko</div>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Total Risiko Aktif</div>
    <div class="kpi-value">${s?.total_open ?? 0}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Extreme</div>
    <div class="kpi-value" style="color:#CC0000">${s?.total_extreme ?? 0}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">High</div>
    <div class="kpi-value" style="color:#7A4C00">${s?.total_high ?? 0}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Mitigasi Terlambat</div>
    <div class="kpi-value" style="color:#CC0000">${overdue?.length ?? 0}</div>
  </div>
</div>

<div class="section-title">2. Risiko untuk Dibahas di MRM (${risks?.length ?? 0} risiko)</div>
<table>
  <thead>
    <tr>
      <th>Kode</th><th>Judul Risiko</th><th>Klasifikasi</th>
      <th>Risk Owner</th><th>Treatment</th><th>Alasan MRM</th>
    </tr>
  </thead>
  <tbody>
    ${riskRows || '<tr><td colspan="6" style="text-align:center;color:#ccc;padding:24px">Tidak ada risiko MRM</td></tr>'}
  </tbody>
</table>

${overdue && overdue.length > 0 ? `
<div class="section-title">3. Mitigasi Terlambat (${overdue.length} item)</div>
<table>
  <thead>
    <tr><th>Kode</th><th>Risiko</th><th>Risk Owner</th><th>Keterlambatan</th><th>Progress</th></tr>
  </thead>
  <tbody>${overdueRows}</tbody>
</table>` : ''}

<div class="footer">
  <span>AVIRA Risk Management · Arranet · Dokumen Rahasia</span>
  <span>${now}</span>
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
