'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Plus, Trash2, Gift, Store, Save, ShieldCheck, 
  AlertTriangle, Lock, Link as LinkIcon, Check, 
  Loader2, Image as ImageIcon, Users, Download 
} from 'lucide-react'
import { useParams } from 'next/navigation'
import StoreRegistrations from '@/app/admin/components/StoreRegistrations'
import * as XLSX from 'xlsx' // <--- IMPORTACIÓN DE EXCEL

export default function ClientSharedPage() {
  const params = useParams()
  const shareUuid = params.uuid as string

  // --- STATES ---
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isExporting, setIsExporting] = useState(false) // Nuevo state para el loading del Excel
  
  const [campaign, setCampaign] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [prizes, setPrizes] = useState<any[]>([]) 
  const [templates, setTemplates] = useState<any[]>([]) 
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [activeView, setActiveView] = useState<'stock' | 'registrations'>('stock')

  // Inputs
  const [newStoreName, setNewStoreName] = useState('')
  const [localStock, setLocalStock] = useState<Record<string, string>>({})
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // --- INIT ---
  useEffect(() => {
    if (shareUuid) initPage()
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
    setHasUnsavedChanges(false)
    const { data } = await supabase.from('prizes').select('*').eq('store_id', storeId).eq('is_active', true)
    
    if (data) {
      setPrizes(data)
      const initialStock: Record<string, string> = {}
      data.forEach(p => {
        initialStock[p.name] = p.stock.toString()
      })
      setLocalStock(initialStock)
    } else {
      setLocalStock({})
    }
  }

  // --- ACTIONS EXCEL (NUEVO) ---
  const downloadCampaignExcel = async () => {
    if (!campaign) return
    setIsExporting(true)

    try {
      // 1. Obtener todos los registros de la campaña con joins
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          created_at,
          full_name,
          dni,
          phone,
          email,
          stores(name),
          prizes(name)
        `)
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        alert("No hay registros para exportar todavía.")
        return
      }

      // 2. Formatear datos para el Excel (Aplanar el JSON)
      const excelData = data.map(reg => ({
        'Fecha y Hora': new Date(reg.created_at).toLocaleString('es-PE'),
        'Participante': reg.full_name,
        'DNI': reg.dni,
        'Teléfono': reg.phone || 'No registrado',
        'Correo': reg.email || 'No registrado',
        'Tienda/Sucursal': (reg.stores as any)?.name || 'N/A',
        'Premio Ganado': (reg.prizes as any)?.name || 'Sin Premio / Agotado'
      }))

      // 3. Crear el libro y la hoja
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Participantes")

      // 4. Generar descarga
      const fileName = `Reporte_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)

    } catch (err) {
      console.error("Error exportando excel:", err)
      alert("Error al generar el reporte.")
    } finally {
      setIsExporting(false)
    }
  }

  // --- OTRAS ACTIONS ---
  const addStore = async () => {
    if (!newStoreName || !campaign?.id) return
    const { data } = await supabase.from('stores').insert({ name: newStoreName, campaign_id: campaign.id }).select()
    if (data) {
      setNewStoreName('')
      fetchStores()
      setSelectedStore(data[0].id)
      setActiveView('stock')
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
            setHasUnsavedChanges(false)
        }
    }
  }

  const handleLocalStockChange = (templateName: string, val: string) => {
    setLocalStock(prev => ({ ...prev, [templateName]: val }))
    setHasUnsavedChanges(true) 
  }

  const saveAllStockToDb = async () => {
    if (!selectedStore || !campaign?.id) return
    setIsSavingAll(true)
    const templatesToSave = templates.filter(template => {
        const valStr = localStock[template.name]
        const isAlreadyLocked = prizes.some(p => p.name === template.name && p.stock > 0)
        return valStr && valStr !== '' && !isAlreadyLocked
    })

    if (templatesToSave.length === 0) {
        setIsSavingAll(false)
        setHasUnsavedChanges(false)
        return
    }

    const prizesToUpsert = templatesToSave.map(template => ({
        store_id: selectedStore,
        campaign_id: campaign.id,
        name: template.name,
        stock: parseInt(localStock[template.name] || '0'),
        is_active: true,
        image_url: template.image_url
    }))

    const { error } = await supabase.from('prizes').upsert(prizesToUpsert, { onConflict: 'store_id, name' })

    if (error) alert("Error al guardar parte del stock.")
    await fetchPrizes(selectedStore)
    setIsSavingAll(false)
    setHasUnsavedChanges(false)
  }

  const handleCopyLink = (e: React.MouseEvent, storeId: string) => {
    e.stopPropagation() 
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000' 
    const url = `${baseUrl}/registro/${storeId}`
    navigator.clipboard.writeText(url)
    setCopiedId(storeId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) return <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center"><Loader2 className="animate-spin text-zinc-400" size={32} /></div>
  if (error) return <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center text-red-500 font-medium">Enlace inválido.</div>

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 font-sans relative selection:bg-blue-200 overflow-x-hidden">
      <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        
        {/* HEADER MEJORADO CON BOTÓN EXCEL */}
        <header className="mb-8 sm:mb-12 flex flex-col md:flex-row md:items-end justify-between pb-6 gap-6 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                        <ShieldCheck size={14} className="text-blue-500"/> Panel Seguro
                    </span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-black dark:text-white">
                    {campaign.name}
                </h1>
            </div>

            {/* BOTÓN EXCEL ESTILO APPLE */}
            <button
                onClick={downloadCampaignExcel}
                disabled={isExporting}
                className="group flex items-center gap-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-white px-6 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
                {isExporting ? (
                    <Loader2 size={18} className="animate-spin text-zinc-400" />
                ) : (
                    <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                        <Download size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                )}
                <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 leading-none mb-1">Exportar Data</p>
                    <p className="text-sm font-bold leading-none">Reporte General Excel</p>
                </div>
            </button>
        </header>

        {/* ... (Resto del código de tiendas y tabs) */}
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative pb-24">
            
            {/* COLUMNA 1: TIENDAS */}
            <div className="lg:col-span-4 flex flex-col h-[500px] lg:h-[700px] bg-zinc-100/50 dark:bg-zinc-900/30 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-zinc-800/50 p-3 sm:p-4 shadow-inner">
                <div className="px-3 pt-3 pb-5">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-zinc-800 dark:text-zinc-200 tracking-tight">
                        <Store className="text-blue-500" size={22}/> Puntos de Entrega
                    </h2>
                </div>
                
                <div className="flex gap-2 mb-4 px-2">
                    <input 
                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium"
                        placeholder="Añadir nueva tienda..."
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addStore()}
                    />
                    <button onClick={addStore} className="bg-blue-600 text-white px-5 rounded-2xl hover:bg-blue-700 transition-all active:scale-90 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                        <Plus size={22} strokeWidth={2.5}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar space-y-2.5">
                    {stores.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => {
                                setSelectedStore(s.id);
                                setActiveView('stock');
                            }}
                            className={`group relative p-4 rounded-[1.5rem] cursor-pointer flex justify-between items-center transition-all duration-300 ease-out border
                                ${selectedStore === s.id 
                                    ? 'bg-white dark:bg-zinc-800 border-zinc-200/50 dark:border-zinc-700 shadow-[0_8px_30px_rgb(0,0,0,0.08)] scale-[1.02]' 
                                    : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-zinc-800/30 hover:border-zinc-200/30'
                                }
                            `}
                        >
                            <span className={`text-[15px] truncate pr-4 transition-all ${selectedStore === s.id ? 'font-bold text-black dark:text-white' : 'font-medium text-zinc-500 dark:text-zinc-400'}`}>
                                {s.name}
                            </span>
                            
                            <div className="flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 transform translate-x-2 lg:group-hover:translate-x-0">
                                <button 
                                    onClick={(e) => handleCopyLink(e, s.id)} 
                                    className="bg-zinc-100 dark:bg-zinc-900/80 hover:bg-blue-500 hover:text-white text-zinc-500 p-2.5 rounded-full backdrop-blur-md transition-all active:scale-75 shadow-sm"
                                >
                                    {copiedId === s.id ? <Check size={16} strokeWidth={3} /> : <LinkIcon size={16} />}
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); deleteStore(s.id) }} 
                                    className="bg-zinc-100 dark:bg-zinc-900/80 hover:bg-red-500 hover:text-white text-zinc-500 p-2.5 rounded-full backdrop-blur-md transition-all active:scale-75 shadow-sm"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUMNA 2: ÁREA DE GESTIÓN */}
            <div className="lg:col-span-8 flex flex-col min-h-[700px]">
                {selectedStore ? (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
                        <div className="mb-6 px-2 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-5">
                            <div>
                                <h2 className="font-black text-3xl tracking-tight text-zinc-900 dark:text-white mb-2">
                                    {stores.find(s=>s.id === selectedStore)?.name}
                                </h2>
                                <p className="text-sm text-zinc-500 font-medium">
                                    {activeView === 'stock' ? 'Configura el inventario para esta ubicación.' : 'Monitorea los premios entregados.'}
                                </p>
                            </div>

                            <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1.5 rounded-[1.25rem] w-full sm:w-auto shadow-inner">
                                <button
                                    onClick={() => setActiveView('stock')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'stock' ? 'bg-white dark:bg-zinc-700 shadow-[0_2px_10px_rgb(0,0,0,0.08)] text-black dark:text-white scale-[1.02]' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                                >
                                    <Gift size={16} /> Inventario
                                </button>
                                <button
                                    onClick={() => setActiveView('registrations')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'registrations' ? 'bg-white dark:bg-zinc-700 shadow-[0_2px_10px_rgb(0,0,0,0.08)] text-black dark:text-white scale-[1.02]' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                                >
                                    <Users size={16} /> Registros
                                </button>
                            </div>
                        </div>

                        {activeView === 'stock' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 overflow-y-auto pb-4 custom-scrollbar px-1 pt-1">
                                {templates.map(template => {
                                    const val = localStock[template.name] ?? ''
                                    const existingPrize = prizes.find(p => p.name === template.name)
                                    const isLocked = existingPrize && existingPrize.stock > 0
                                    return (
                                        <div key={template.id} className={`relative flex flex-col bg-white dark:bg-zinc-900 rounded-[2rem] shadow-sm overflow-hidden border border-white dark:border-zinc-800 transition-all duration-300 ${isLocked ? 'opacity-80' : 'hover:shadow-xl hover:-translate-y-1'}`}>
                                            <div className="aspect-[4/3] w-full bg-[#F5F5F7] dark:bg-black/40 p-6 flex items-center justify-center relative">
                                                {isLocked && <div className="absolute top-4 right-4 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm z-10"><Lock size={12} className="text-zinc-500" /><span className="text-[10px] font-bold uppercase">Fijado</span></div>}
                                                {template.image_url ? <img src={template.image_url} className="w-full h-full object-contain drop-shadow-xl" /> : <ImageIcon size={48} className="text-zinc-300" />}
                                            </div>
                                            <div className="p-5 flex flex-col gap-4 border-t border-zinc-100 dark:border-zinc-800/50">
                                                <h3 className="font-bold text-[17px] truncate">{template.name}</h3>
                                                <div className={`flex items-center justify-between bg-zinc-50 dark:bg-black/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 transition-all ${!isLocked && 'focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-white'}`}>
                                                    <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Stock</span>
                                                    <input type="number" min="0" disabled={!!isLocked} className="w-full bg-transparent font-medium text-xl outline-none text-right disabled:text-zinc-400" value={val} onChange={(e) => handleLocalStockChange(template.name, e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex-1 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-zinc-800 shadow-sm overflow-hidden p-4 sm:p-6 mb-2">
                                <StoreRegistrations storeId={selectedStore} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 bg-white/40 dark:bg-zinc-900/20 backdrop-blur-xl rounded-[3rem] border-2 border-dashed border-white dark:border-zinc-800/50 shadow-sm m-2">
                        <Store size={48} className="text-blue-500 mb-6"/>
                        <p className="text-2xl font-bold tracking-tight text-zinc-700">Panel de Gestión</p>
                        <p className="text-sm mt-2">Selecciona una tienda a la izquierda.</p>
                    </div>
                )}
            </div>

            {/* BOTÓN FLOTANTE */}
            {hasUnsavedChanges && activeView === 'stock' && (
                <div className="fixed bottom-6 lg:bottom-10 left-0 right-0 flex justify-center z-50 animate-in slide-in-from-bottom-12 fade-in duration-500 pointer-events-none px-4">
                    <button onClick={saveAllStockToDb} disabled={isSavingAll} className="pointer-events-auto bg-black dark:bg-white text-white dark:text-black pl-5 pr-8 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 active:scale-95 transition-all">
                        {isSavingAll ? <Loader2 className="animate-spin" size={24}/> : <><div className="bg-blue-500 p-2 rounded-full text-white"><Save size={18} strokeWidth={2.5}/></div> Confirmar y Guardar Cambios</>}
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  )
}