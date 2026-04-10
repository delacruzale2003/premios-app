'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { Loader2, Store, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion' // NUEVO: Importamos Framer Motion para el Toast

// Componentes Segmentados
import CampaignHeader from '@/app/admin/components/CampaignHeader' 
import StatsView from '@/app/admin/components/StatsView' 
import StoreRegistrations from '@/app/admin/components/StoreRegistrations'
import StoresSidebar from '@/app/admin/components/StoreSidebar'
import InventoryGrid from '@/app/admin/components/InventoryGrid'

export default function ClientSharedPage() {
  const params = useParams()
  const shareUuid = params.uuid as string

  // --- ESTADOS GLOBALES ---
  const [initialLoad, setInitialLoad] = useState(true) // CAMBIADO: De `loading` a `initialLoad` para distinguir la primera carga
  const [error, setError] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [campaign, setCampaign] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [prizes, setPrizes] = useState<any[]>([]) 
  const [templates, setTemplates] = useState<any[]>([]) 
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [activeView, setActiveView] = useState<'stock' | 'registrations' | 'stats'>('stock')
  
  // Gestión de Stock
  const [localStock, setLocalStock] = useState<Record<string, string>>({})
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // NUEVO: Estado para el Toast flotante
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'loading' | 'success' } | null>(null)

  useEffect(() => { if (shareUuid) initPage() }, [shareUuid])
  useEffect(() => { if (selectedStore) fetchPrizes(selectedStore) }, [selectedStore])

  // Carga inicial completa (Muestra pantalla blanca)
  async function initPage() {
    setInitialLoad(true)
    const { data: campData, error } = await supabase.from('campaigns').select('*').eq('share_uuid', shareUuid).single()
    if (error || !campData) { setError(true); setInitialLoad(false); return }
    setCampaign(campData)

    const { data: tmplData } = await supabase.from('prize_templates').select('*').eq('campaign_id', campData.id).order('created_at', { ascending: true })
    setTemplates(tmplData || [])

    const { data: storeData } = await supabase.from('stores').select('*').eq('campaign_id', campData.id).eq('is_active', true).order('created_at', { ascending: true })
    setStores(storeData || [])
    setInitialLoad(false)
  }

  // NUEVO: Función para recargar silenciosamente usando Toast
  async function refreshStoresBackground(actionText: string) {
    if (!campaign) return

    setToastMessage({ text: actionText, type: 'loading' })

    const { data: storeData } = await supabase.from('stores').select('*').eq('campaign_id', campaign.id).eq('is_active', true).order('created_at', { ascending: true })
    if (storeData) setStores(storeData)

    setToastMessage({ text: 'Completado con éxito', type: 'success' })
    setTimeout(() => setToastMessage(null), 2500)
  }

  async function fetchPrizes(storeId: string) {
    setHasUnsavedChanges(false)
    const { data } = await supabase.from('prizes').select('*').eq('store_id', storeId).eq('is_active', true)
    const initialStock: Record<string, string> = {}
    data?.forEach(p => { initialStock[p.name] = p.stock.toString() })
    setPrizes(data || [])
    setLocalStock(initialStock)
  }

  const saveAllStockToDb = async () => {
    if (!selectedStore || !campaign) return
    setIsSavingAll(true)

    const prizesToUpsert = templates.map(t => {
      const existingPrize = prizes.find(p => p.name === t.name)
      
      const payload: any = {
        store_id: selectedStore,
        campaign_id: campaign.id,
        name: t.name,
        stock: parseInt(localStock[t.name] || '0'),
        image_url: t.image_url,
        is_active: true,
        batch_number: 1
      }

      if (existingPrize) {
        payload.id = existingPrize.id
        payload.batch_number = existingPrize.batch_number 
      }

      return payload
    }).filter(p => p.stock >= 0)

    const { error } = await supabase.from('prizes').upsert(prizesToUpsert)

    if (error) {
      console.error("Error guardando el stock:", error)
      alert("Hubo un error al guardar el inventario. Revisa la consola.")
    } else {
      // NUEVO: Añadido feedback al guardar inventario
      setToastMessage({ text: 'Inventario guardado', type: 'success' })
      setTimeout(() => setToastMessage(null), 2500)
    }

    await fetchPrizes(selectedStore)
    setIsSavingAll(false)
  }

  const exportToExcel = async () => {
    setIsExporting(true)
    const { data } = await supabase.from('registrations').select('created_at, full_name, dni, phone, email, stores(name), prizes(name)').eq('campaign_id', campaign.id)
    if (data) {
      const formatted = data.map(r => ({
        Fecha: new Date(r.created_at).toLocaleString(),
        Participante: r.full_name,
        DNI: r.dni,
        Tienda: (r.stores as any)?.name,
        Premio: (r.prizes as any)?.name
      }))
      const ws = XLSX.utils.json_to_sheet(formatted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Registros");
      XLSX.writeFile(wb, `Reporte_${campaign.name}.xlsx`);
    }
    setIsExporting(false)
  }

  // La pantalla de carga blanca (Flashbang) AHORA SOLO aparece la primera vez que entras a la URL
  if (initialLoad) return <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center"><Loader2 className="animate-spin text-zinc-400" size={32} /></div>

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black text-zinc-900 dark:text-zinc-100 p-4 sm:p-8 font-sans w-full relative">
      
      {/* NUEVO: TOAST FLOTANTE */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-[9999] flex items-center gap-3 bg-white dark:bg-zinc-800 text-black dark:text-white px-5 py-3 rounded-full shadow-2xl border border-zinc-200 dark:border-zinc-700 font-bold text-sm"
          >
            {toastMessage.type === 'loading' ? (
              <Loader2 className="animate-spin text-blue-500" size={18} />
            ) : (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <CheckCircle2 className="text-green-500" size={18} />
              </motion.div>
            )}
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenedor principal ahora usa w-full en lugar de max-w-7xl */}
      <div className="w-full space-y-8">
        
        <CampaignHeader 
          campaign={campaign} 
          onExport={exportToExcel} 
          isExporting={isExporting} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          
          <aside className="lg:col-span-4 xl:col-span-3">
            <StoresSidebar 
              stores={stores} 
              selectedStore={selectedStore} 
              onSelect={(id: string) => { setSelectedStore(id); setActiveView('stock') }}
              campaignId={campaign?.id}
              campaignUrl={campaign?.campaign_url}
              // CAMBIO CLAVE AQUÍ: En lugar de initPage, usamos refreshStoresBackground
              refreshStores={(actionText: string) => refreshStoresBackground(actionText)}
            />
          </aside>

          <main className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
            {selectedStore ? (
              <>
                <div className="flex justify-between items-center bg-zinc-200/50 dark:bg-zinc-800/50 p-1.5 rounded-2xl w-fit self-end shadow-inner">
                   {['stock', 'registrations', 'stats'].map((v) => (
                     <button 
                        key={v}
                        onClick={() => setActiveView(v as any)}
                        className={`px-6 py-2 rounded-xl text-xs font-bold capitalize transition-all ${activeView === v ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}
                     >
                       {v === 'stock' ? 'Inventario' : v === 'registrations' ? 'Registros' : 'Análisis'}
                     </button>
                   ))}
                </div>

                {activeView === 'stock' && (
                  <InventoryGrid 
                    templates={templates} 
                    prizes={prizes} 
                    localStock={localStock} 
                    onChange={handleLocalStockChange} 
                    onSave={saveAllStockToDb}
                    isSaving={isSavingAll}
                    hasChanges={hasUnsavedChanges}
                  />
                )}
                {activeView === 'registrations' && <StoreRegistrations storeId={selectedStore} />}
                {activeView === 'stats' && <StatsView campaignId={campaign.id} />}
              </>
            ) : (
              <div className="h-[500px] flex flex-col items-center justify-center bg-white/40 dark:bg-zinc-900/20 backdrop-blur-xl rounded-[3rem] border-2 border-dashed border-white dark:border-zinc-800/50">
                <Store size={48} className="text-blue-500 mb-4 opacity-20"/>
                <p className="text-xl font-bold text-zinc-400">Selecciona una tienda para gestionar</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )

  function handleLocalStockChange(name: string, val: string) {
    setLocalStock(prev => ({ ...prev, [name]: val }))
    setHasUnsavedChanges(true)
  }
}