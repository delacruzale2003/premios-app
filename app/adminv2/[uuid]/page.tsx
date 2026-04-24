'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation' 
import {
  Layers,
  Save,
  Loader2,
  AlertCircle,
  Smartphone,
  Gift,
  Download,
  Users,
  CheckCircle2,
  Store,
  Info
} from 'lucide-react'
import * as XLSX from 'xlsx'

// IMPORTAMOS TU NUEVO COMPONENTE (Ajusta la ruta según tu estructura)
import StoresSidebar from '@/app/admin/components/StoreSidebar'

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function SharedCampaignAdmin() {
  const params = useParams()
  const shareUuid = params?.uuid as string
  
  // --- ESTADOS GLOBALES ---
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  const [campaign, setCampaign] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [templates, setTemplates] = useState<any[]>([]) 
  const [prizes, setPrizes] = useState<any[]>([])
  
  const [localStock, setLocalStock] = useState<Record<string, number | string>>({})
  const [activeBatch, setActiveBatch] = useState(1) 

  // NUEVO: Estado para avisarle al Sidebar que se guardó nuevo stock y debe recalcular
  const [stockRefreshTrigger, setStockRefreshTrigger] = useState(0)

  // --- CARGA INICIAL DINÁMICA ---
  useEffect(() => {
    if (shareUuid) {
      initAdmin()
    }
  }, [shareUuid])

  useEffect(() => {
    if (selectedStore) {
      fetchStoreData(selectedStore.id)
    }
  }, [selectedStore])

  async function initAdmin() {
    setLoading(true)
    
    // 1. Cargar Campaña
    const { data: camp, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('share_uuid', shareUuid)
      .single()

    if (error || !camp) {
      console.error("Campaña no encontrada o link inválido")
      setLoading(false)
      return
    }
    setCampaign(camp)

    // 2. Cargar Plantillas
    const { data: tmplData } = await supabase
      .from('prize_templates')
      .select('*')
      .eq('campaign_id', camp.id)
      .order('created_at', { ascending: true })
      
    setTemplates(tmplData || [])

    // 3. Cargar Tiendas
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('campaign_id', camp.id)
      .eq('is_active', true)
    setStores(storeData || [])
    
    setLoading(false)
  }

  async function fetchStoreData(storeId: any) {
    const { data } = await supabase
      .from('prizes')
      .select('*')
      .eq('store_id', storeId)
    
    const newStock: Record<string, number | string> = {}
    if (data) {
      data.forEach((p: any) => {
        const batch = p.batch_number || 1
        newStock[`${batch}_${p.name}`] = p.stock
      })
      setPrizes(data) 
    }
    setLocalStock(newStock)
  }

  const handleUpdateStock = (batch: number, prizeName: string, val: string) => {
    setLocalStock(prev => ({
      ...prev,
      [`${batch}_${prizeName}`]: val
    }))
  }

  // --- GUARDADO DE STOCK EN PARALELO ---
  const saveStock = async () => {
    setIsSaving(true)
    const prizesToInsert: any[] = []
    const prizesToUpdate: any[] = []
    
    for (let b = 1; b <= 4; b++) {
      templates.forEach(t => {
        const stockVal = parseInt(localStock[`${b}_${t.name}`] as string) || 0
        const existing = prizes.find(p => p.name === t.name && (Number(p.batch_number) === b || (!p.batch_number && b === 1)))
        
        if (existing?.id) {
          prizesToUpdate.push({
            id: existing.id,
            stock: stockVal,
            batch_number: b, 
            is_active: true
          })
        } else if (stockVal >= 0) {
          prizesToInsert.push({
            name: t.name,
            image_url: t.image_url,
            stock: stockVal,
            store_id: selectedStore.id,
            campaign_id: campaign.id,
            batch_number: b,
            is_active: true
          })
        }
      })
    }

    let hasError = false;

    if (prizesToUpdate.length > 0) {
      const updatePromises = prizesToUpdate.map(p => 
        supabase.from('prizes').update({ stock: p.stock, batch_number: p.batch_number }).eq('id', p.id)
      );
      const results = await Promise.all(updatePromises);
      if (results.some(res => res.error)) hasError = true;
    }

    if (prizesToInsert.length > 0) {
      const { error } = await supabase.from('prizes').insert(prizesToInsert)
      if (error) hasError = true;
    }
    
    if (hasError) {
      alert("Ocurrió un error parcial al guardar. Por favor, revisa el inventario.")
    } else {
      alert("¡Stock de Lotes guardado exitosamente!")
    }

    await fetchStoreData(selectedStore.id) 
    // 🔥 Disparamos la señal para que el sidebar descargue los stocks actualizados
    setStockRefreshTrigger(prev => prev + 1)
    setIsSaving(false)
  }

  const exportToExcel = async () => {
    setIsExporting(true)
    const { data } = await supabase
      .from('registrations')
      .select('created_at, full_name, dni, phone, email, stores(name), prizes(name)')
      .eq('campaign_id', campaign.id)
    
    if (data) {
      const formatted = data.map((r: any) => ({
        Fecha: new Date(r.created_at).toLocaleString(),
        Participante: r.full_name,
        DNI: r.dni,
        Telefono: r.phone,
        Tienda: Array.isArray(r.stores) ? r.stores[0]?.name : (typeof r.stores === 'object' ? r.stores?.name : ''),
        Premio: Array.isArray(r.prizes) ? r.prizes[0]?.name : (typeof r.prizes === 'object' ? r.prizes?.name : '') || 'Ninguno'
      }))
      const ws = XLSX.utils.json_to_sheet(formatted)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Registros")
      XLSX.writeFile(wb, `Reporte_${campaign.name}_${new Date().toLocaleDateString()}.xlsx`)
    }
    setIsExporting(false)
  }

  if (!shareUuid) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">Link de Campaña Inválido</p>
      </div>
    )
  }

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-zinc-400 font-black uppercase tracking-widest text-[10px]">Cargando Control Center...</p>
    </div>
  )

  if (!campaign && !loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4">
      <AlertCircle className="text-red-500" size={48} />
      <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">Campaña no encontrada o inactiva</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-8 selection:bg-blue-100">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* HEADER PRINCIPAL */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-600/20 rotate-3">
               <Smartphone className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter leading-none flex items-center gap-2 text-zinc-900 dark:text-white">
                Panel de <span className="text-blue-600 italic">Control</span>
              </h1>
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-blue-500" /> Campaña Activa: {campaign?.name}
              </p>
            </div>
          </div>
          
          <button 
            onClick={exportToExcel}
            disabled={isExporting}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-zinc-900 text-white dark:bg-white dark:text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Exportar Global
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* BARRA LATERAL: COMPONENTE MODULARIZADO */}
          <aside className="lg:col-span-4 space-y-6">
             <StoresSidebar 
                stores={stores}
                selectedStore={selectedStore?.id}
                onSelect={(id: string) => setSelectedStore(stores.find(s => s.id === id))}
                campaignId={campaign?.id}
                campaignUrl={campaign?.campaign_url}
                refreshStores={initAdmin}
                isMobile={false} // O ajustarlo si manejas un hook de responsividad
                stockRefreshTrigger={stockRefreshTrigger}
             />
          </aside>

          {/* CONTENIDO PRINCIPAL */}
          <main className="lg:col-span-8 space-y-6">
            {selectedStore ? (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                
                <div className="flex flex-wrap gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-2 sm:p-3 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                   <div className="flex gap-1 pl-4">
                     <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                       <Layers size={14} /> Inventario en Lotes
                     </span>
                   </div>

                   <div className="flex items-center gap-4 w-full sm:w-auto justify-end px-2 sm:px-0">
                     <a 
                       href={`/admin/registrations?store=${selectedStore.id}`}
                       className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-blue-600 flex items-center gap-2 transition-colors px-4"
                     >
                       <Users size={14} /> Ver Registros
                     </a>
                     
                     <button 
                        onClick={saveStock}
                        disabled={isSaving}
                        className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-[0_8px_20px_rgba(37,99,235,0.3)] disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Guardar Lotes
                      </button>
                   </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
                  <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-col xl:flex-row justify-between gap-6 bg-zinc-50/50 dark:bg-black/20">
                     <div className="space-y-1 shrink-0">
                       <h3 className="text-xl font-black uppercase tracking-tighter italic">Gestión de Stock</h3>
                       <p className="text-zinc-400 text-xs font-medium">Sucursal: <span className="text-black dark:text-white">{selectedStore.name}</span></p>
                     </div>
                     
                     <div className="flex bg-white dark:bg-black p-1.5 rounded-2xl shadow-inner border border-zinc-200 dark:border-zinc-800 overflow-x-auto custom-scrollbar w-full xl:w-auto">
                       {[1, 2, 3, 4].map(num => {
                         const totalStock = templates.reduce((sum, t) => sum + (parseInt(localStock[`${num}_${t.name}`] as string) || 0), 0)
                         return (
                         <button
                           key={num}
                           onClick={() => setActiveBatch(num)}
                           className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-2 ${
                             activeBatch === num ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                           }`}
                         >
                           Lote {num}
                           <span className={`px-2 py-0.5 rounded-full text-[8px] ${activeBatch === num ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                             {totalStock}
                           </span>
                         </button>
                         )
                       })}
                     </div>
                  </div>

                  <div className="p-4 sm:p-6 md:p-8 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                     {templates.length === 0 ? (
                       <div className="col-span-full py-10 flex flex-col items-center text-zinc-400 gap-3">
                         <AlertCircle size={40} className="opacity-20" />
                         <p className="font-black uppercase text-[10px] sm:text-xs tracking-widest text-center">No hay premios configurados</p>
                       </div>
                     ) : templates.map(t => {
                       const stockVal = localStock[`${activeBatch}_${t.name}`] ?? 0
                       
                       return (
                       <div key={t.id} className="bg-zinc-50 dark:bg-black/40 p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-zinc-100 dark:border-zinc-800 flex flex-col group transition-all hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md">
                          <div className="w-full aspect-square bg-white dark:bg-zinc-800 rounded-xl sm:rounded-[1.5rem] overflow-hidden shadow-inner border border-zinc-100 dark:border-zinc-700 mb-3 sm:mb-4 group-hover:scale-[1.02] transition-transform flex items-center justify-center p-2 sm:p-3">
                            {t.image_url ? (
                              <img src={t.image_url} className="w-full h-full object-cover rounded-lg sm:rounded-xl" alt={t.name} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-200"><Gift size={24} className="sm:w-8 sm:h-8" /></div>
                            )}
                          </div>
                          <h4 className="font-black text-[11px] sm:text-[13px] uppercase tracking-tighter text-zinc-800 dark:text-zinc-100 mb-3 sm:mb-4 line-clamp-2 leading-tight min-h-[1.75rem] sm:min-h-[2rem]">
                            {t.name}
                          </h4>
                          
                          <div className="w-full mt-auto">
                            <label className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-400 ml-1 tracking-[0.1em] mb-1 block">Stock</label>
                            <div className="flex items-center w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border transition-all shadow-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                              <Gift size={14} className="shrink-0 mr-1.5 sm:mr-2 text-blue-500 hidden sm:block" />
                              <input 
                                type="number"
                                min="0"
                                className="w-full bg-transparent font-black text-base sm:text-xl text-center sm:text-right outline-none text-zinc-900 dark:text-zinc-100"
                                value={stockVal}
                                onChange={e => handleUpdateStock(activeBatch, t.name, e.target.value)}
                              />
                            </div>
                          </div>
                       </div>
                       )
                     })}
                  </div>

                  <div className="p-5 sm:p-6 bg-blue-50/50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30 flex items-start sm:items-center gap-3">
                     <Info size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
                     <p className="text-[10px] sm:text-xs font-bold text-blue-800 dark:text-blue-300 tracking-wide leading-relaxed">
                        <strong className="uppercase">Importante:</strong> Los premios del <span className="underline">Lote {activeBatch + 1 > 4 ? 4 : activeBatch + 1}</span> se habilitarán automáticamente para la ruleta cuando la sumatoria de stock total del <span className="underline">Lote {activeBatch}</span> llegue a 0 en esta tienda.
                     </p>
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full min-h-[650px] bg-white/40 dark:bg-zinc-900/20 backdrop-blur-xl border-2 border-dashed border-white dark:border-zinc-800 rounded-[4rem] flex flex-col items-center justify-center text-zinc-300 gap-6 p-4">
                 <div className="bg-white dark:bg-zinc-900 p-10 sm:p-12 rounded-[3rem] shadow-xl animate-pulse">
                   <Store size={60} strokeWidth={1} className="sm:w-20 sm:h-20 opacity-20 text-blue-500" />
                 </div>
                 <div className="text-center space-y-2">
                   <p className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-zinc-400">Selecciona una sucursal</p>
                   <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-300">Para iniciar el control de inventario por lotes</p>
                 </div>
              </div>
            )}
          </main>

        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
      `}</style>
    </div>
  )
}