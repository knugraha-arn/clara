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
      residual_score, residual_classification,
      treatment_strategy, treatment_notes, existing_control,
      next_review_date,
      risk_owner:avr_user_profiles!avr_risks_risk_owner_id_fkey(full_name),
      unit_kerja:avr_unit_kerja(nama)
    `)
    .in('inherent_classification', ['High', 'Extreme'])
    .neq('status', 'Closed')
    .order('inherent_score', { ascending: false })

  const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const classBg: Record<string, string> = { High: '#FFE0A0', Extreme: '#FFCCCC' }
  const classColor: Record<string, string> = { High: '#6B3500', Extreme: '#CC0000' }

  const rows = (risks ?? []).map(r => {
    const cls = r.inherent_classification ?? 'High'
    return `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#0344D8;white-space:nowrap">${r.risk_code}</td>
      <td>
        <div style="font-weight:600;font-size:12px">${r.title}</div>
        <div style="color:#888;font-size:10px;margin-top:2px">${r.category} · ${(r as any).unit_kerja?.nama ?? '—'}</div>
        ${r.existing_control ? `<div style="color:#666;font-size:10px;margin-top:4px"><strong>Kontrol:</strong> ${r.existing_control}</div>` : ''}
      </td>
      <td style="text-align:center;white-space:nowrap">
        <span style="background:${classBg[cls]};color:${classColor[cls]};padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600">${cls}</span>
        <div style="font-size:10px;color:#888;margin-top:2px">${r.inherent_score} (L${r.likelihood}×I${r.impact})</div>
      </td>
      <td style="text-align:center">
        ${r.residual_classification ? `<span style="background:${classBg[r.residual_classification] ?? '#F0F0F0'};color:${classColor[r.residual_classification] ?? '#666'};padding:2px 8px;border-radius:4px;font-size:11px">${r.residual_classification} (${r.residual_score})</span>` : '<span style="color:#ccc">—</span>'}
      </td>
      <td style="font-size:11px">${r.treatment_strategy ?? '—'}<br><span style="color:#888;font-size:10px">${r.treatment_notes ?? ''}</span></td>
      <td style="font-size:11px">${(r as any).risk_owner?.full_name ?? '—'}</td>
      <td style="font-size:11px;color:${new Date(r.next_review_date ?? '').getTime() < Date.now() ? '#CC0000' : '#888'}">${formatDate(r.next_review_date)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1A1F2E; background: white; padding: 32px; }
  .header { border-bottom: 2px solid #CC0000; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22px; font-weight: 700; color: #0344D8; }
  .report-title { font-size: 16px; font-weight: 600; margin-top: 4px; }
  .meta { font-size: 11px; color: #888; margin-top: 4px; }
  .badge { background: #FFCCCC; color: #CC0000; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .alert-box { background: #FFF5F5; border: 1px solid #FFD0D0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #CC0000; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F8F9FB; color: #888; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
  td { padding: 10px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">AVIRA</div>
    <div class="report-title">High & Extreme Risk Report</div>
    <div class="meta">Digenerate: ${now} · Oleh: ${profile?.full_name ?? '—'}</div>
  </div>
  <span class="badge">ISO 27001 · Kl. 8.2</span>
</div>

<div class="alert-box">
  ⚠️ Laporan ini berisi <strong>${risks?.length ?? 0} risiko</strong> dengan klasifikasi High dan Extreme yang memerlukan perhatian segera.
  ${risks?.filter(r => r.inherent_classification === 'Extreme').length ? `Terdapat <strong>${risks?.filter(r => r.inherent_classification === 'Extreme').length} risiko Extreme</strong> yang harus dibahas di Management Review Meeting.` : ''}
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
      <th>Next Review</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="7" style="text-align:center;color:#ccc;padding:24px">Tidak ada risiko High/Extreme</td></tr>'}
  </tbody>
</table>

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
