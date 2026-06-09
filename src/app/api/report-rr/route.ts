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

  const { data: risks } = await supabase
    .from('avr_risks')
    .select(`
      risk_code, title, category, status,
      likelihood, impact, inherent_score, inherent_classification,
      residual_likelihood, residual_impact, residual_score, residual_classification,
      treatment_strategy, date_identified, next_review_date,
      risk_owner:avr_user_profiles!avr_risks_risk_owner_id_fkey(full_name),
      treatment_owner:avr_user_profiles!avr_risks_treatment_owner_id_fkey(full_name),
      unit_kerja:avr_unit_kerja(nama)
    `)
    .neq('status', 'Closed')
    .order('inherent_score', { ascending: false })

  const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const classColor: Record<string, string> = {
    Low:     '#1E5C0A',
    Medium:  '#7A4C00',
    High:    '#6B3500',
    Extreme: '#CC0000',
  }

  const classBg: Record<string, string> = {
    Low:     '#D6EFC7',
    Medium:  '#FFF0C2',
    High:    '#FFE0A0',
    Extreme: '#FFCCCC',
  }

  const rows = (risks ?? []).map(r => {
    const cls = r.inherent_classification ?? 'Low'
    const rcls = r.residual_classification
    return `
      <tr>
        <td style="font-family:monospace;font-size:11px;color:#0344D8;white-space:nowrap">${r.risk_code}</td>
        <td>
          <div style="font-weight:500;font-size:12px">${r.title}</div>
          <div style="color:#888;font-size:10px;margin-top:2px">${r.category} · ${(r as any).unit_kerja?.nama ?? '—'}</div>
        </td>
        <td style="text-align:center">
          <span style="background:${classBg[cls]};color:${classColor[cls]};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">
            ${cls}
          </span>
          <div style="font-size:10px;color:#888;margin-top:2px">${r.inherent_score} (L${r.likelihood}×I${r.impact})</div>
        </td>
        <td style="text-align:center">
          ${rcls ? `<span style="background:${classBg[rcls]};color:${classColor[rcls]};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">${rcls}</span><div style="font-size:10px;color:#888;margin-top:2px">${r.residual_score}</div>` : '<span style="color:#ccc">—</span>'}
        </td>
        <td style="font-size:11px">${r.treatment_strategy ?? '—'}</td>
        <td style="font-size:11px">${(r as any).risk_owner?.full_name ?? '—'}</td>
        <td>
          <span style="background:${r.status === 'Open' ? '#EBF2FF' : r.status === 'In Progress' ? '#FFF8E6' : '#F0F9E8'};
            color:${r.status === 'Open' ? '#0344D8' : r.status === 'In Progress' ? '#7A4C00' : '#1E5C0A'};
            padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500">
            ${r.status}
          </span>
        </td>
        <td style="font-size:11px;color:#888">${formatDate(r.next_review_date)}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1A1F2E; background: white; padding: 32px; }
  .header { border-bottom: 2px solid #0344D8; padding-bottom: 16px; margin-bottom: 24px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22px; font-weight: 700; color: #0344D8; letter-spacing: -0.5px; }
  .report-title { font-size: 16px; font-weight: 600; color: #1A1F2E; margin-top: 4px; }
  .meta { font-size: 11px; color: #888; margin-top: 4px; }
  .badge { display: inline-block; background: #D1EA2C; color: #1A1F2E; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .summary-card { background: #F8F9FB; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
  .summary-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-value { font-size: 24px; font-weight: 700; color: #1A1F2E; margin-top: 2px; }
  .summary-value.red { color: #CC0000; }
  .summary-value.amber { color: #7A4C00; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #F8F9FB; color: #888; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
  td { padding: 10px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <div>
      <div class="brand">AVIRA</div>
      <div class="report-title">Risk Register Report</div>
      <div class="meta">Digenerate: ${now} · Oleh: ${profile?.full_name ?? '—'}</div>
    </div>
    <span class="badge">ISO 27001 · Kl. 6.1</span>
  </div>
</div>

<div class="summary">
  <div class="summary-card">
    <div class="summary-label">Total Risiko</div>
    <div class="summary-value">${risks?.length ?? 0}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Extreme</div>
    <div class="summary-value red">${risks?.filter(r => r.inherent_classification === 'Extreme').length ?? 0}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">High</div>
    <div class="summary-value amber">${risks?.filter(r => r.inherent_classification === 'High').length ?? 0}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Medium</div>
    <div class="summary-value">${risks?.filter(r => r.inherent_classification === 'Medium').length ?? 0}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Low</div>
    <div class="summary-value">${risks?.filter(r => r.inherent_classification === 'Low').length ?? 0}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Kode</th>
      <th>Judul Risiko</th>
      <th style="text-align:center">Inherent</th>
      <th style="text-align:center">Residual</th>
      <th>Treatment</th>
      <th>Risk Owner</th>
      <th>Status</th>
      <th>Next Review</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="8" style="text-align:center;color:#ccc;padding:24px">Tidak ada risiko aktif</td></tr>'}
  </tbody>
</table>

<div class="footer">
  <span>AVIRA Risk Management · Arranet</span>
  <span>Dokumen ini digenerate secara otomatis · ${now}</span>
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
