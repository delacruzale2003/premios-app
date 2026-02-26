'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Copy, Trash2, Gift, Store, Lock, Globe, AlertCircle, Save } from 'lucide-react'

interface Props {
  campaignId: string
}

export default function CampaignDashboard({ campaignId }: Props) {
  // --- STATES ---
  const [stores, setStores] = useState<any[]>([])
  const [prizes, setPrizes] = useState<any[]>([]) 
  const [templates, setTemplates] = useState<any[]>([]) 
  const [campaign, setCampaign] = useState<any>(null)
  const [selectedStore, setSelectedStore] = useState<string>('')

  // Estado local para inputs
  const [localStock, setLocalStock] = useState<Record<string, string>>({})
  // Estado para feedback de carga por item (loading)
  const [savingItems, setSavingItems] = useState<Record<string, boolean>>({})

  // Inputs
  const [newStoreName, setNewStoreName] = useState('')
  const [newTemplateName, setNewTemplateName] = useState('')

  // --- EFFECTS ---
  useEffect(() => {
    if (campaignId) {
      fetchCampaign()
      fetchTemplates()
      fetchStores()
      resetView()
    }
  }, [campaignId])

  useEffect(() => {
    if (selectedStore) fetchPrizes(selectedStore)
  }, [selectedStore])

  // --- HELPERS ---
  const resetView = () => {
    setSelectedStore('')
    setPrizes([])
    setLocalStock({})
    setSavingItems({})
  }

  // --- FETCHERS ---
  async function fetchCampaign() {
    const { data } = await supabase.from('campaigns').select('*').eq('id', campaignId).single()
    setCampaign(data)
  }

  async function fetchTemplates() {
    const { data } = await supabase.from('prize_templates').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true })
    if (data) setTemplates(data)
  }

  // FUEGO: Solo trae tiendas activas
  async function fetchStores() {
    const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_active', true) // Asegura que solo vengan las activas
        .order('created_at', { ascending: true })
    
    if (data) setStores(data)
  }

  async function fetchPrizes(storeId: string) {
    const { data } = await supabase.from('prizes').select('*').eq('store_id', storeId).eq('is_active', true)
    
    if (data) {
      setPrizes(data)
      const initialStock: Record<string, string> = {}
      data.forEach(p => {
        initialStock[p.name] = p.stock.toString()
      })
      setLocalStock(initialStock)
    }
  }

  // --- ACTIONS: MASTER TEMPLATES ---
  const addTemplate = async () => {
    if (!newTemplateName) return
    await supabase.from('prize_templates').insert({ name: newTemplateName, campaign_id: campaignId })
    setNewTemplateName('')
    fetchTemplates()
  }

  const deleteTemplate = async (id: string) => {
    await supabase.from('prize_templates').delete().eq('id', id)
    fetchTemplates()
  }

  const copyClientLink = () => {
    const link = `${window.location.origin}/share/${campaign?.share_uuid}`
    navigator.clipboard.writeText(link)
    alert('Link copiado: ' + link)
  }

  // --- ACTIONS: STORES ---
  const addStore = async () => {
    if (!newStoreName) return
    const { data } = await supabase.from('stores').insert({ name: newStoreName, campaign_id: campaignId }).select()
    if (data) {
      setNewStoreName('')
      fetchStores()
      setSelectedStore(data[0].id)
    }
  }

  // CORRECCIÓN PRINCIPAL AQUI:
  const deleteStore = async (id: string) => {
    const confirmDelete = window.confirm("¿Eliminar tienda?")
    if (!confirmDelete) return

    // 1. Actualizar en Base de Datos
    const { error } = await supabase.from('stores').update({ is_active: false }).eq('id', id)
    
    if (error) {
        console.error("Error al eliminar tienda:", error)
        alert("Error al eliminar. Revisa la consola o permisos.")
        return
    }

    // 2. Actualizar estado local inmediatamente (Feedback visual rápido)
    setStores(prev => prev.filter(s => s.id !== id))

    // 3. Resetear vista si era la seleccionada
    if (selectedStore === id) resetView()

    // 4. (Opcional pero seguro) Volver a pedir la lista al servidor para asegurar sincronización
    fetchStores()
  }

  // --- ACTIONS: STOCK MANAGEMENT ---
  
  const handleLocalStockChange = (templateName: string, val: string) => {
    setLocalStock(prev => ({ ...prev, [templateName]: val }))
  }

  const saveStockToDb = async (templateName: string) => {
    if (!selectedStore) return
    
    setSavingItems(prev => ({ ...prev, [templateName]: true }))

    const valStr = localStock[templateName]
    const stockVal = valStr && valStr !== '' ? parseInt(valStr) : 0

    const { data, error } = await supabase
        .from('prizes')
        .upsert({
            store_id: selectedStore,
            campaign_id: campaignId,
            name: templateName,
            stock: stockVal,
            is_active: true
        }, { onConflict: 'store_id, name' })
        .select()
        .single()

    setSavingItems(prev => ({ ...prev, [templateName]: false }))

    if (error) {
        console.error("Error guardando stock:", error)
        alert("Error al guardar stock.")
    } else {
        setPrizes(prev => {
            const exists = prev.find(p => p.name === templateName)
            if (exists) {
                return prev.map(p => p.name === templateName ? { ...p, stock: stockVal } : p)
            } else {
                return [...prev, data]
            }
        })
    }
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      
      {/* 1. CONFIGURACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PANEL A: Premios Maestros */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                        <Lock size={18} className="text-amber-500"/> Premios de la Campaña
                    </h2>
                    <p className="text-xs text-zinc-500">Define los nombres aquí. No se pueden duplicar.</p>
                </div>
            </div>

            <div className="flex gap-2 mb-3">
                <input 
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTemplate()}
                    placeholder="Nuevo premio maestro..."
                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <button onClick={addTemplate} className="bg-black text-white dark:bg-white dark:text-black p-2 rounded-xl hover:opacity-80">
                    <Plus size={20}/>
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                    <div key={t.id} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full text-sm border border-zinc-200 dark:border-zinc-700">
                        <span className="font-medium">{t.name}</span>
                        <button onClick={() => deleteTemplate(t.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                ))}
                {templates.length === 0 && <span className="text-xs text-zinc-400 italic py-2">Sin premios definidos.</span>}
            </div>
        </div>

        {/* PANEL B: Link */}
        <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col justify-center items-start">
            <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300 font-bold">
                <Globe size={20}/> Link para el Cliente
            </div>
            <p className="text-sm text-blue-600/80 dark:text-blue-400 mb-4">
                Envía este enlace a tu cliente para que gestionen su stock.
            </p>
            <button 
                onClick={copyClientLink}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 shadow-lg shadow-blue-500/20"
            >
                <Copy size={16}/> Copiar Enlace Seguro
            </button>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* 2. GESTIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:h-[500px]">
          
          {/* Tiendas */}
          <div className="md:col-span-4 bg-zinc-100 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
            <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                <Store size={18}/> Tiendas Activas
            </h3>
            
            <div className="flex gap-2 mb-4">
                <input 
                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Nueva tienda..."
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addStore()}
                />
                <button onClick={addStore} className="bg-white dark:bg-zinc-800 p-2 rounded-xl shadow-sm hover:bg-gray-50"><Plus size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {stores.map(s => (
                    <div 
                        key={s.id} 
                        onClick={() => setSelectedStore(s.id)}
                        className={`group p-3 rounded-xl cursor-pointer border text-sm flex justify-between items-center transition-all ${selectedStore === s.id ? 'bg-white border-zinc-300 shadow-sm dark:bg-zinc-800 dark:border-zinc-600 font-bold' : 'bg-white/50 border-transparent hover:bg-white dark:hover:bg-zinc-800/50'}`}
                    >
                        {s.name}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation()
                                deleteStore(s.id)
                            }} 
                            className="text-zinc-300 hover:text-red-500 p-1.5 rounded-md transition-colors opacity-100 md:opacity-0 group-hover:opacity-100"
                            title="Eliminar tienda"
                        >
                            <Trash2 size={14}/>
                        </button>
                    </div>
                ))}
                {stores.length === 0 && <div className="text-center text-zinc-400 py-4 text-xs">No hay tiendas activas.</div>}
            </div>
          </div>

          {/* Stock */}
          <div className="md:col-span-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-full">
            {selectedStore ? (
                <>
                    <div className="mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Gift className="text-purple-500" size={20}/> Gestión de Stock
                        </h3>
                        <p className="text-sm text-zinc-500">
                            Tienda: <span className="font-bold text-black dark:text-white">{stores.find(s=>s.id === selectedStore)?.name}</span>
                        </p>
                    </div>

                    {templates.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-xl">
                            <AlertCircle size={32} className="mb-2 opacity-20"/>
                            <p className="text-sm">Primero define premios maestros arriba a la izquierda.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                            {templates.map(template => {
                                const val = localStock[template.name] ?? ''
                                const isSaving = savingItems[template.name]

                                return (
                                    <div key={template.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex flex-col justify-between group hover:border-purple-200 dark:hover:border-purple-900 transition-colors">
                                        <div className="mb-3">
                                            <span className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Premio</span>
                                            <h4 className="font-bold text-base truncate mt-1" title={template.name}>{template.name}</h4>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all">
                                                <span className="text-xs font-medium pl-1 text-zinc-500">Cant:</span>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    className="w-full bg-transparent text-right font-mono font-bold outline-none"
                                                    placeholder="0"
                                                    value={val}
                                                    onChange={(e) => handleLocalStockChange(template.name, e.target.value)}
                                                />
                                            </div>
                                            
                                            <button 
                                                onClick={() => saveStockToDb(template.name)}
                                                disabled={isSaving}
                                                className={`p-2 rounded-lg flex items-center justify-center transition-all ${isSaving ? 'bg-zinc-200 text-zinc-400' : 'bg-black text-white dark:bg-white dark:text-black hover:opacity-80 active:scale-95'}`}
                                                title="Guardar Stock"
                                            >
                                                <Save size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                    <Store size={40} className="mb-4 opacity-20"/>
                    <p className="text-lg font-medium">Selecciona una tienda</p>
                </div>
            )}
          </div>
      </div>
    </div>
  )
}