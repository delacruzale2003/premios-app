'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertCircle, Download, Smartphone, CheckCircle2, User, FileText, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function GlobalCampaignAdmin({ params }: { params: Promise<{ uuid: string }> }) {
  const unwrappedParams = use(params);
  const shareUuid = unwrappedParams.uuid;
  
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [campaign, setCampaign] = useState<any>(null)
  const [registrations, setRegistrations] = useState<any[]>([])

  useEffect(() => {
    if (shareUuid) initAdmin()
  }, [shareUuid])

  async function initAdmin() {
    setLoading(true)
    
    // 1. Cargar Campaña
    const { data: camp, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('share_uuid', shareUuid)
      .single()

    if (error || !camp) {
      setLoading(false)
      return
    }
    setCampaign(camp)

    // 2. Cargar TODOS los registros de esta campaña (sin filtrar por tienda)
    const { data: regs } = await supabase
      .from('registrations')
      .select('*')
      .eq('campaign_id', camp.id)
      .order('created_at', { ascending: false })
      
    setRegistrations(regs || [])
    setLoading(false)
  }

  const exportToExcel = () => {
    setIsExporting(true)
    const formatted = registrations.map(r => ({
      Fecha: new Date(r.created_at).toLocaleString(),
      Nombre: r.full_name,
      DNI: r.dni,
      Telefono: r.phone,
      'Cod. Voucher': r.ticket_number,
      'URL Voucher': r.voucher_url
    }))
    const ws = XLSX.utils.json_to_sheet(formatted)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Registros")
    XLSX.writeFile(wb, `Reporte_Global_${campaign.name}.xlsx`)
    setIsExporting(false)
  }

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4">
      <Loader2 className="animate-spin text-[#a2e71a]" size={40} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
              Sorteo: <span className="text-[#a2e71a]">{campaign?.name}</span>
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-2">
              Panel de control global • {registrations.length} registros totales
            </p>
          </div>
          
          <button 
            onClick={exportToExcel}
            disabled={isExporting}
            className="mt-4 md:mt-0 flex items-center gap-2 bg-[#a2e71a] text-black px-6 py-3 rounded-full font-black text-sm uppercase hover:scale-105 transition-all"
          >
            {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Exportar Excel
          </button>
        </header>

        {/* TABLA DE REGISTROS */}
        <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800 text-[#a2e71a] uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">DNI</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Voucher</th>
                  <th className="p-4">Imagen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-zinc-800/50">
                    <td className="p-4 text-zinc-400">{new Date(reg.created_at).toLocaleDateString()}</td>
                    <td className="p-4 font-bold">{reg.full_name}</td>
                    <td className="p-4">{reg.dni}</td>
                    <td className="p-4">{reg.phone}</td>
                    <td className="p-4 font-mono text-[#a2e71a]">{reg.ticket_number}</td>
                    <td className="p-4">
                      <a href={reg.voucher_url} target="_blank" className="text-blue-400 underline text-xs">Ver</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}