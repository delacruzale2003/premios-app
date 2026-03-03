'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ArrowLeft, ChevronDown, Globe, LayoutDashboard } from 'lucide-react' // Añadido LayoutDashboard
import Link from 'next/link'
import CampaignDashboard from './components/CampaignDashboard'

export default function AdminPage() {
  // --- STATES ---
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  
  // States para la creación
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignSubdomain, setNewCampaignSubdomain] = useState('')

  // --- EFFECTS ---
  useEffect(() => { fetchCampaigns() }, [])

  // --- FETCHERS ---
  async function fetchCampaigns() {
    const { data } = await supabase.from('campaigns').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setCampaigns(data)
  }

  // --- ACTIONS ---
  const addCampaign = async () => {
    if (!newCampaignName || !newCampaignSubdomain) return
    const fullUrl = `${newCampaignSubdomain.toLowerCase().trim()}.ptm.pe`
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ 
        name: newCampaignName,
        campaign_url: fullUrl 
      })
      .select()

    if (!error && data) {
      setNewCampaignName('')
      setNewCampaignSubdomain('')
      fetchCampaigns()
      setSelectedCampaign(data[0].id)
    } else {
        alert("Error al crear la campaña.")
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
            
            {/* BOTÓN ADMIN ALTERNATIVO (NUEVO) */}
            <div className="flex items-center gap-4">
              <Link 
                href="/admin/adminalternativo" 
                className="bg-zinc-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg active:scale-95"
              >
                <LayoutDashboard size={14} /> Sorteos Semanales
              </Link>
              <span className="hidden md:block text-xs text-zinc-400 font-mono tracking-tighter">ADMIN v2.5 • PTM.PE</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">
                {activeCampaignName ? `Editando: ${activeCampaignName}` : 'Panel de Gestión'}
              </h1>
              <p className="text-zinc-500 text-sm md:text-base">Control total de campañas, sucursales y stock.</p>
            </div>

            {/* BARRA DE ACCIONES DE CAMPAÑA */}
            <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto items-stretch md:items-center">
              
              {/* SELECTOR DE CAMPAÑA */}
              <div className="relative">
                <select 
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="appearance-none w-full md:w-[240px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold rounded-2xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all cursor-pointer"
                >
                  <option value="">Seleccionar Campaña...</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown size={16} strokeWidth={2.5} />
                </div>
              </div>

              <div className="hidden md:block w-px h-8 bg-zinc-200 dark:border-zinc-800 mx-1"></div>

              {/* FORMULARIO NUEVA CAMPAÑA */}
              <div className="flex flex-col sm:flex-row gap-2 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800">
                  <input 
                    placeholder="Nombre Campaña" 
                    value={newCampaignName}
                    onChange={e => setNewCampaignName(e.target.value)}
                    className="bg-white dark:bg-zinc-900 px-4 py-2 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:w-40 border border-transparent"
                  />
                  <div className="relative flex items-center bg-white dark:bg-zinc-900 rounded-xl border border-transparent focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <div className="pl-3 pr-1 text-zinc-400"><Globe size={14}/></div>
                    <input 
                      placeholder="subdominio" 
                      value={newCampaignSubdomain}
                      onChange={e => setNewCampaignSubdomain(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      className="bg-transparent px-1 py-2 text-sm outline-none w-full sm:w-32 font-medium"
                    />
                    <span className="pr-3 text-zinc-400 text-xs font-bold">.ptm.pe</span>
                  </div>
                  <button 
                    onClick={addCampaign} 
                    disabled={!newCampaignName || !newCampaignSubdomain} 
                    className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-sm"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        {selectedCampaign ? (
            <CampaignDashboard campaignId={selectedCampaign} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400 gap-4">
            <div className="bg-zinc-100 dark:bg-zinc-900 p-8 rounded-[2.5rem] animate-pulse">
                <Globe size={48} strokeWidth={1} className="opacity-20" />
            </div>
            <div className="text-center">
                <p className="text-xl font-bold text-zinc-500 dark:text-zinc-400">Listo para gestionar</p>
                <p className="text-sm">Selecciona una campaña para comenzar.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}