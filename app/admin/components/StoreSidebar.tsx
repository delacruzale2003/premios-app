'use client'

import { Plus, Store, Link as LinkIcon, Check, Trash2, Download, ArrowDownAZ, Clock, Package, Search, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence, Variants } from 'framer-motion' 

// Configuraciones de animación
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
}

export default function StoresSidebar({ stores, selectedStore, onSelect, campaignId, campaignUrl, refreshStores }: any) {
  const [newStoreName, setNewStoreName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const [sortBy, setSortBy] = useState<'date' | 'alpha'>('date')
  const [storeStocks, setStoreStocks] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchAllStocks = async () => {
      if (!campaignId) return
      
      const { data } = await supabase
        .from('prizes')
        .select('store_id, stock')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)

      if (data) {
        const stocks: Record<string, number> = {}
        data.forEach(prize => {
          if (!stocks[prize.store_id]) stocks[prize.store_id] = 0
          stocks[prize.store_id] += prize.stock
        })
        setStoreStocks(stocks)
      }
    }

    fetchAllStocks()
  }, [campaignId, stores]) 

  const addStore = async () => {
    const cleanStoreName = newStoreName.trim() 
    if (!cleanStoreName || !campaignId) return
    
    const { error } = await supabase.from('stores').insert({ name: cleanStoreName, campaign_id: campaignId })
    if (!error) {
      setNewStoreName('')
      refreshStores('Creando tienda...')
    }
  }

  const getStoreLink = (id: string) => {
    const baseDomain = (campaignUrl || 'fanta.ptm.pe').replace('https://', '').replace('www.', '')
    return `${baseDomain}/registro/${id}`
  }

  const handleCopyLink = (e: any, id: string) => {
    e.stopPropagation()
    const fullUrl = `https://${getStoreLink(id)}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const downloadQr = (e: any, store: any) => {
    e.stopPropagation()
    const canvas = document.getElementById(`qr-${store.id}`) as HTMLCanvasElement
    if (!canvas) return

    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream")
    const downloadLink = document.createElement("a")
    downloadLink.href = pngUrl
    downloadLink.download = `QR_${store.name.trim().replace(/\s+/g, '_')}.png`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  const handleDeleteClick = async (e: any, id: string) => {
    e.stopPropagation()
    if (deletingId === id) {
      await supabase.from('stores').update({ is_active: false }).eq('id', id)
      setDeletingId(null)
      refreshStores('Eliminando tienda...')
    } else {
      setDeletingId(id)
      setTimeout(() => {
        setDeletingId((current) => current === id ? null : current)
      }, 3000)
    }
  }

  const filteredAndSortedStores = [...stores]
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.name.trim().localeCompare(b.name.trim())
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  return (
    <div className="flex flex-col h-[500px] lg:h-[700px] bg-zinc-100/50 dark:bg-zinc-900/30 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-zinc-800/50 p-4 shadow-inner overflow-hidden">
      
      <div className="px-3 pt-3 pb-4 flex items-center gap-2 font-bold text-xl tracking-tight">
        <Store className="text-blue-500" size={22}/> Puntos de Entrega
        <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded-full ml-auto">
          {stores.length}
        </span>
      </div>
      
      <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-[1.5rem] shadow-md border border-zinc-200 dark:border-zinc-700 mb-5 flex gap-2">
        <input 
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none font-bold text-black dark:text-white placeholder:font-normal placeholder:text-zinc-400"
          placeholder="Crear nueva tienda..."
          value={newStoreName}
          onChange={(e) => setNewStoreName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStore()}
        />
        <button onClick={addStore} className="bg-blue-600 text-white p-2.5 rounded-xl active:scale-95 transition-all shadow-md hover:bg-blue-700">
          <Plus size={20} strokeWidth={3}/>
        </button>
      </div>

      <div className="relative mb-3 px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search size={16} className="text-zinc-400" />
        </div>
        <input 
          type="text"
          className="w-full bg-zinc-200/50 dark:bg-zinc-900 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400"
          placeholder="Buscar tienda en la lista..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex gap-2 px-1 mb-4">
        <button 
          onClick={() => setSortBy('date')} 
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${sortBy === 'date' ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-blue-400 border-zinc-200 dark:border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:bg-white/50 dark:hover:bg-zinc-800/50'}`}
        >
          <Clock size={14}/> Recientes
        </button>
        <button 
          onClick={() => setSortBy('alpha')} 
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${sortBy === 'alpha' ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-blue-400 border-zinc-200 dark:border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:bg-white/50 dark:hover:bg-zinc-800/50'}`}
        >
          <ArrowDownAZ size={14}/> A - Z
        </button>
      </div>

      <motion.div 
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="flex-1 overflow-y-auto px-1 space-y-2.5 custom-scrollbar"
      >
        <AnimatePresence mode="popLayout">
          {filteredAndSortedStores.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-zinc-400 text-sm mt-10">
              No se encontraron tiendas.
            </motion.div>
          ) : (
            filteredAndSortedStores.map((s: any) => {
              const totalPrizes = storeStocks[s.id] || 0 
              const isDeleting = deletingId === s.id

              return (
                <motion.div 
                  variants={itemVariants}
                  layout 
                  key={s.id} 
                  onClick={() => onSelect(s.id)}
                  className={`group relative p-4 rounded-[1.5rem] cursor-pointer flex justify-between items-center transition-colors duration-300 border
                    ${selectedStore === s.id 
                      ? 'bg-white dark:bg-zinc-800 border-zinc-200/50 dark:border-zinc-700 shadow-xl' 
                      : 'bg-transparent border-transparent hover:bg-white/40 dark:hover:bg-zinc-800/20'
                    }`}
                >
                  <div className="flex flex-col gap-1 pr-4 truncate">
                    <span className={`text-[15px] truncate ${selectedStore === s.id ? 'font-bold text-black dark:text-white' : 'font-medium text-zinc-600 dark:text-zinc-300'}`}>
                      {s.name}
                    </span>
                    
                    <div className="flex items-center gap-1.5 text-xs">
                      <Package size={12} className={totalPrizes > 0 ? "text-blue-500" : "text-zinc-400"} />
                      <span className={`font-bold ${totalPrizes > 0 ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}>
                        {totalPrizes} premios
                      </span>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-1 absolute right-2 transition-all duration-300 ${isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'}`}>
                    
                    {!isDeleting && (
                      <>
                        <button 
                          onClick={(e) => downloadQr(e, s)} 
                          className="bg-white dark:bg-zinc-700 p-2 rounded-full hover:bg-black hover:text-white transition-all shadow-md border border-zinc-200/50 dark:border-zinc-600"
                          title="Descargar QR Limpio"
                        >
                          <Download size={14} className="text-zinc-700 dark:text-zinc-300 hover:text-white" />
                        </button>

                        <button 
                          onClick={(e) => handleCopyLink(e, s.id)} 
                          className="bg-white dark:bg-zinc-700 p-2 rounded-full hover:bg-blue-500 transition-all shadow-md border border-zinc-200/50 dark:border-zinc-600 group/btn"
                          title="Copiar link de la tienda"
                        >
                          {copiedId === s.id 
                            ? <Check size={14} strokeWidth={3} className="text-blue-500 group-hover/btn:text-white" /> 
                            : <LinkIcon size={14} className="text-zinc-700 dark:text-zinc-300 group-hover/btn:text-white" />
                          }
                        </button>
                      </>
                    )}
                    
                    <button 
                      onClick={(e) => handleDeleteClick(e, s.id)} 
                      className={`flex items-center gap-1.5 p-2 rounded-full transition-all shadow-md border ${
                        isDeleting 
                          ? 'bg-red-500 text-white border-red-600 w-auto px-3' 
                          : 'bg-white dark:bg-zinc-700 hover:bg-red-500 border-zinc-200/50 dark:border-zinc-600 group/btn'
                      }`}
                      title={isDeleting ? "Click para confirmar" : "Eliminar tienda"}
                    >
                      {isDeleting ? (
                        <>
                          <AlertTriangle size={14} strokeWidth={3} className="animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Borrar</span>
                        </>
                      ) : (
                        <Trash2 size={14} className="text-zinc-700 dark:text-zinc-300 group-hover/btn:text-white" />
                      )}
                    </button>

                    <div className="hidden">
                      <QRCodeCanvas 
                        id={`qr-${s.id}`} 
                        // CAMBIO CLAVE AQUÍ: Le inyectamos el https:// directamente al QR
                        value={`https://${getStoreLink(s.id)}`} 
                        size={1024} 
                        level={"M"}  
                        marginSize={1} 
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}