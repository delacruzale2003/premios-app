'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ArrowLeft, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import CampaignDashboard from './components/CampaignDashboard'

export default function AdminPage() {
  // --- STATES ---
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [newCampaignName, setNewCampaignName] = useState('')

  // --- EFFECTS ---
  useEffect(() => { fetchCampaigns() }, [])

  // --- FETCHERS ---
  async function fetchCampaigns() {
    const { data } = await supabase.from('campaigns').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setCampaigns(data)
  }

  // --- ACTIONS ---
  const addCampaign = async () => {
    if (!newCampaignName) return
    const { data, error } = await supabase.from('campaigns').insert({ name: newCampaignName }).select()
    if (!error && data) {
      setNewCampaignName('')
      fetchCampaigns()
      setSelectedCampaign(data[0].id)
    }
  }

  const activeCampaignName = campaigns.find(c => c.id === selectedCampaign)?.name

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & CAMPAIGN SELECTOR */}
        <header className="mb-6 md:mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="flex justify-between items-center mb-4">
            <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-1">
              <ArrowLeft size={16} /> Volver
            </Link>
            <span className="text-xs text-zinc-400">Admin Panel v2.3</span>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
                {activeCampaignName ? `Editando: ${activeCampaignName}` : 'Panel de Gestión'}
              </h1>
              <p className="text-zinc-500 text-sm md:text-base">Gestiona tus campañas, sucursales y stock de premios.</p>
            </div>

            {/* BARRA DE ACCIONES DE CAMPAÑA */}
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              
              {/* SELECTOR CUSTOMIZADO (Sin estilo nativo) */}
              <div className="relative w-full md:w-auto">
                <select 
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="appearance-none w-full md:w-[260px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm md:text-base font-medium rounded-xl pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 shadow-sm transition-all cursor-pointer"
                >
                  <option value="">Seleccionar Campaña...</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* Icono de flecha flotante */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown size={16} strokeWidth={2.5} />
                </div>
              </div>

              {/* INPUT Y BOTÓN DE NUEVA CAMPAÑA */}
              <div className="flex gap-2 w-full md:w-auto">
                 <input 
                   placeholder="Nueva campaña..." 
                   value={newCampaignName}
                   onChange={e => setNewCampaignName(e.target.value)}
                   className="flex-1 w-full md:w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm md:text-base outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 shadow-sm transition-all"
                 />
                 <button 
                    onClick={addCampaign} 
                    disabled={!newCampaignName} 
                    className="bg-white dark:bg-white text-black border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white p-3 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center min-w-[44px]"
                 >
                    <Plus size={20} strokeWidth={2.5} />
                 </button>
              </div>

            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL MODULARIZADO */}
        {selectedCampaign ? (
            <CampaignDashboard campaignId={selectedCampaign} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400 gap-2">
            <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-full">
                <ArrowLeft className="rotate-90 md:rotate-0 md:-ml-1" size={32} strokeWidth={1.5} />
            </div>
            <p className="text-lg font-medium">Selecciona una campaña para comenzar</p>
          </div>
        )}
      </div>
    </div>
  )
}