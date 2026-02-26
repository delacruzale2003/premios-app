'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Gift, Store, Save, ShieldCheck, AlertTriangle, Lock } from 'lucide-react'
import { useParams } from 'next/navigation'

export default function ClientSharedPage() {
  const params = useParams()
  const shareUuid = params.uuid as string

  // --- STATES ---
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const [campaign, setCampaign] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [prizes, setPrizes] = useState<any[]>([]) 
  const [templates, setTemplates] = useState<any[]>([]) 
  
  const [selectedStore, setSelectedStore] = useState<string>('')

  // Inputs
  const [newStoreName, setNewStoreName] = useState('')
  
  // Lógica de Stock
  const [localStock, setLocalStock] = useState<Record<string, string>>({})
  const [savingItems, setSavingItems] = useState<Record<string, boolean>>({})

  // --- INIT ---
  useEffect(() => {
    if (shareUuid) {
      initPage()
    }
  }, [shareUuid])

  useEffect(() => {
    if (selectedStore) fetchPrizes(selectedStore)
  }, [selectedStore])

  // --- FETCHERS ---
  async function initPage() {
    setLoading(true)
    const { data: campData, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('share_uuid', shareUuid)
        .single()

    if (error || !campData) {
        setError(true)
        setLoading(false)
        return
    }

    setCampaign(campData)

    const { data: tmplData } = await supabase
        .from('prize_templates')
        .select('*')
        .eq('campaign_id', campData.id)
        .order('created_at', { ascending: true })
    if (tmplData) setTemplates(tmplData)

    const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('campaign_id', campData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
    if (storeData) setStores(storeData)

    setLoading(false)
  }

  async function fetchStores() {
    if (!campaign?.id) return
    const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('is_active', true)
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

  // --- ACTIONS ---
  const addStore = async () => {
    if (!newStoreName || !campaign?.id) return
    const { data } = await supabase.from('stores').insert({ name: newStoreName, campaign_id: campaign.id }).select()
    if (data) {
      setNewStoreName('')
      fetchStores()
      setSelectedStore(data[0].id)
    }
  }

  const deleteStore = async (id: string) => {
    if (!confirm("¿Eliminar esta tienda? Se perderá el stock asignado.")) return
    const { error } = await supabase.from('stores').update({ is_active: false }).eq('id', id)
    if (!error) {
        setStores(prev => prev.filter(s => s.id !== id))
        if (selectedStore === id) {
            setSelectedStore('')
            setPrizes([])
        }
    }
  }

  const handleLocalStockChange = (templateName: string, val: string) => {
    setLocalStock(prev => ({ ...prev, [templateName]: val }))
  }

  const saveStockToDb = async (templateName: string) => {
    if (!selectedStore || !campaign?.id) return
    
    // Doble check por seguridad
    const alreadySaved = prizes.find(p => p.name === templateName && p.stock > 0)
    if (alreadySaved) return;

    setSavingItems(prev => ({ ...prev, [templateName]: true }))

    const valStr = localStock[templateName]
    const stockVal = valStr && valStr !== '' ? parseInt(valStr) : 0

    const { data, error } = await supabase
        .from('prizes')
        .upsert({
            store_id: selectedStore,
            campaign_id: campaign.id,
            name: templateName,
            stock: stockVal,
            is_active: true
        }, { onConflict: 'store_id, name' })
        .select()
        .single()

    setSavingItems(prev => ({ ...prev, [templateName]: false }))

    if (!error) {
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
  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Cargando campaña...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-400">Enlace inválido o expirado.</div>

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER CLIENTE */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6 gap-4">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={12}/> Acceso Seguro
                    </span>
                    <span className="text-zinc-400 text-xs">Gestor de Premios</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {campaign.name}
                </h1>
                
                {/* DISCLAIMER IMPORTANTE */}
                <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200 dark:border-amber-800/30 max-w-2xl">
                    <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-amber-800 dark:text-amber-200/80 leading-snug">
                        <strong>Importante:</strong> El stock asignado <u>no se puede editar</u> una vez guardado. Esto garantiza que cada premio tenga un código único e inalterable. Si cometes un error, elimina la tienda y créala de nuevo.
                    </p>
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* COLUMNA 1: TIENDAS */}
            <div className="md:col-span-4 flex flex-col h-[600px] bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="font-bold flex items-center gap-2 text-lg mb-4">
                    <Store className="text-zinc-400" size={20}/> Mis Tiendas
                </h2>
                <div className="flex gap-2 mb-4">
                    <input 
                        className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Nombre nueva tienda..."
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addStore()}
                    />
                    <button onClick={addStore} className="bg-black text-white dark:bg-white dark:text-black p-2.5 rounded-xl hover:opacity-80 transition-opacity">
                        <Plus size={20}/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                    {stores.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => setSelectedStore(s.id)}
                            className={`group p-4 rounded-xl cursor-pointer border flex justify-between items-center transition-all
                                ${selectedStore === s.id 
                                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm' 
                                    : 'bg-zinc-50 border-transparent hover:bg-zinc-100 dark:bg-zinc-800/30 dark:hover:bg-zinc-800 dark:border-zinc-800'
                                }
                            `}
                        >
                            <span className={`text-sm ${selectedStore === s.id ? 'font-bold text-blue-700 dark:text-blue-300' : ''}`}>
                                {s.name}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteStore(s.id) }} 
                                className="text-zinc-300 hover:text-red-500 p-1 rounded-md opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUMNA 2: STOCK */}
            <div className="md:col-span-8 flex flex-col h-[600px] bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                {selectedStore ? (
                    <>
                        <div className="mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                            <h2 className="font-bold text-xl flex items-center gap-2">
                                <Gift className="text-purple-500" size={24}/> Inventario de Premios
                            </h2>
                            <p className="text-sm text-zinc-500 mt-1">
                                Asignando stock para: <span className="font-bold text-black dark:text-white">{stores.find(s=>s.id === selectedStore)?.name}</span>
                            </p>
                        </div>

                        {templates.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                                <p>No hay premios configurados para esta campaña.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                                {templates.map(template => {
                                    const val = localStock[template.name] ?? ''
                                    const isSaving = savingItems[template.name]
                                    
                                    // Verificamos si YA se guardó stock en la BD para este premio
                                    // Si existe stock > 0, se bloquea.
                                    const existingPrize = prizes.find(p => p.name === template.name)
                                    const isLocked = existingPrize && existingPrize.stock > 0

                                    return (
                                        <div key={template.id} className="relative group/card">
                                            <div className={`
                                                bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all flex flex-col justify-between h-32
                                                ${isLocked ? 'opacity-70 grayscale-[0.5] cursor-not-allowed' : 'hover:border-blue-300 dark:hover:border-blue-700'}
                                            `}>
                                                <div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Premio</span>
                                                        {isLocked && <Lock size={12} className="text-zinc-400"/>}
                                                    </div>
                                                    <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2 mt-1" title={template.name}>
                                                        {template.name}
                                                    </h3>
                                                </div>
                                                
                                                <div className="flex gap-2 mt-3">
                                                    <div className={`flex-1 flex items-center bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 transition-all ${!isLocked && 'focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'}`}>
                                                        <span className="text-xs text-zinc-400 font-medium mr-2">Cant:</span>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            disabled={!!isLocked}
                                                            className="w-full bg-transparent font-mono font-bold text-lg outline-none text-right disabled:text-zinc-400 disabled:cursor-not-allowed"
                                                            placeholder="0"
                                                            value={val}
                                                            onChange={(e) => handleLocalStockChange(template.name, e.target.value)}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => saveStockToDb(template.name)}
                                                        disabled={!!isLocked || isSaving}
                                                        className={`
                                                            px-3 rounded-lg flex items-center justify-center transition-all
                                                            ${isLocked 
                                                                ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-600' 
                                                                : isSaving 
                                                                    ? 'bg-zinc-200 text-zinc-400'
                                                                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-500/20'
                                                            }
                                                        `}
                                                    >
                                                        {isLocked ? <Lock size={16}/> : <Save size={18}/>}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* TOOLTIP DE BLOQUEO (Solo aparece al hover si está bloqueado) */}
                                            {isLocked && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none z-10">
                                                    <div className="bg-black/80 text-white text-xs px-3 py-2 rounded-lg shadow-xl backdrop-blur-sm max-w-[80%] text-center">
                                                        Stock guardado. No editable.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                        <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                            <Store size={32} className="opacity-50"/>
                        </div>
                        <p className="text-lg font-medium">Selecciona una tienda</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}