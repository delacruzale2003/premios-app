'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Image as ImageIcon, X, Ticket, CalendarClock, User, Smartphone, Info, Search } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, Variants } from 'framer-motion'

interface Props {
  storeId: string
}

const tableVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 } 
  }
}

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
}

export default function StoreRegistrations({ storeId }: Props) {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setMounted(true)
    const delayDebounceFn = setTimeout(() => {
      fetchRegistrations(searchTerm)
    }, 400)

    return () => clearTimeout(delayDebounceFn)
  }, [storeId, searchTerm])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null)
    }
    if (selectedImage) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [selectedImage])

  async function fetchRegistrations(search: string = '') {
    setLoading(true)
    
    const { count } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      
    if (count !== null) setTotalCount(count)

    let query = supabase
      .from('registrations')
      .select(`
        *,
        prize:prizes(name)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(25)

    if (search.trim() !== '') {
        query = query.or(`dni.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching registrations:", error)
    } else {
      setRegistrations(data || [])
    }
    
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const ImageModal = () => {
    if (!selectedImage || !mounted) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200"
        onClick={() => setSelectedImage(null)}
      >
        <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 sm:top-10 sm:right-10 bg-white/10 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition-all active:scale-95 border border-white/20 z-50 shadow-2xl"
            title="Cerrar (Esc)"
        >
            <X size={28} strokeWidth={2.5} />
        </button>
        <div className="relative w-full max-w-5xl h-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Voucher Ampliado" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300" />
        </div>
      </div>,
      document.body
    )
  }

  return (
    <div className="flex flex-col h-[500px] lg:h-[700px] bg-zinc-100/50 dark:bg-zinc-900/30 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-zinc-800/50 p-6 shadow-inner relative animate-in fade-in duration-500 overflow-hidden">
      
      {/* CABECERA: RESUMEN Y BUSCADOR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 px-4 py-2.5 rounded-2xl w-full sm:w-auto shadow-sm">
              <Info size={18} className="text-blue-500 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  Total en tienda: <span className="font-black text-lg mx-1">{totalCount}</span>
              </p>
          </div>

          <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Search size={16} />
              </div>
              <input
                  type="text"
                  placeholder="Buscar DNI o Nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm dark:text-white"
              />
          </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      {loading && registrations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
              <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
              <p className="font-medium">Buscando registros...</p>
          </div>
      ) : registrations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 px-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-white/40 dark:bg-zinc-900/40">
              <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner">
                  {searchTerm ? <Search size={32} className="text-zinc-300 dark:text-zinc-600" /> : <Ticket size={32} className="text-zinc-300 dark:text-zinc-600 rotate-12" />}
              </div>
              <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  {searchTerm ? 'No se encontraron resultados' : 'Aún no hay participantes'}
              </h3>
              <p className="text-sm max-w-sm leading-relaxed">
                  {searchTerm ? `No hay registros que coincidan con "${searchTerm}".` : 'Cuando los clientes participen, los últimos 25 registros aparecerán aquí.'}
              </p>
          </div>
      ) : (
          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar -mx-2 px-2 pb-6">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-3 px-2 sticky left-0">Mostrando los últimos 25 registros</p>
              
              {/* CAMBIO 1: table ahora tiene text-center en lugar de text-left */}
              <table className="w-full text-center border-separate border-spacing-y-2 min-w-[700px]">
                  <thead className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl">
                      <tr>
                          {/* CAMBIO 2: Se agregó text-center a todos los encabezados (th) */}
                          <th className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap rounded-l-2xl text-center">Fecha</th>
                          <th className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap text-center">Participante</th>
                          <th className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap text-center">Contacto</th>
                          <th className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap text-center">Voucher</th>
                          <th className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap rounded-r-2xl text-center">Premio Entregado</th>
                      </tr>
                  </thead>
                  
                  <motion.tbody 
                    variants={tableVariants}
                    initial="hidden"
                    animate="show"
                    className="text-sm"
                  >
                      {registrations.map((reg) => (
                          <motion.tr 
                            variants={rowVariants}
                            key={reg.id} 
                            className="bg-white dark:bg-zinc-800/40 shadow-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group hover:scale-[1.01]"
                          >
                              <td className="py-4 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap rounded-l-2xl border-t border-b border-l border-zinc-100 dark:border-zinc-800">
                                  {/* CAMBIO 3: justify-center para centrar el icono y la fecha */}
                                  <div className="flex items-center justify-center gap-2 font-medium">
                                      <CalendarClock size={14} className="opacity-40" />
                                      {formatDate(reg.created_at)}
                                  </div>
                              </td>
                              <td className="py-4 px-4 border-t border-b border-zinc-100 dark:border-zinc-800 text-center">
                                  {/* CAMBIO 4: text-center y justify-center para el nombre y DNI */}
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100 text-base text-center">{reg.full_name}</div>
                                  <div className="mt-1 flex items-center justify-center gap-1.5">
                                      <span className="inline-flex items-center justify-center gap-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide">
                                          <User size={10} /> {reg.dni}
                                      </span>
                                  </div>
                              </td>
                              <td className="py-4 px-4 border-t border-b border-zinc-100 dark:border-zinc-800 text-center">
                                  {/* CAMBIO 5: Flex container alineado al centro para el celular */}
                                  <div className="flex justify-center">
                                      {reg.phone ? (
                                          <div className="inline-flex items-center justify-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium">
                                              <Smartphone size={14} className="text-zinc-400" /> {reg.phone}
                                          </div>
                                      ) : <span className="text-zinc-400 italic text-xs">No provisto</span>}
                                  </div>
                              </td>
                              <td className="py-4 px-4 text-center border-t border-b border-zinc-100 dark:border-zinc-800">
                                  {reg.voucher_url ? (
                                      <button 
                                          onClick={() => setSelectedImage(reg.voucher_url)}
                                          className="w-14 h-14 rounded-xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 mx-auto hover:border-blue-500 hover:ring-2 hover:ring-blue-500/50 transition-all active:scale-90 shadow-sm relative group/btn"
                                          title="Click para ampliar voucher"
                                      >
                                          <img src={reg.voucher_url} alt="Voucher" className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/0 group-hover/btn:bg-black/20 transition-colors"></div>
                                      </button>
                                  ) : (
                                      <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto border border-dashed border-zinc-300 dark:border-zinc-700">
                                          <ImageIcon size={20} className="text-zinc-300 dark:text-zinc-600" />
                                      </div>
                                  )}
                              </td>
                              <td className="py-4 px-4 text-center rounded-r-2xl border-t border-b border-r border-zinc-100 dark:border-zinc-800">
                                  {/* CAMBIO 6: Agregado text-center explícito a la celda del premio */}
                                  {reg.prize?.name ? (
                                      <span className="inline-flex items-center justify-center gap-1.5 bg-amber-100/50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 px-3 py-2 rounded-xl text-xs font-bold border border-amber-200/50 dark:border-amber-900/50 shadow-sm">
                                          <Ticket size={14} className="text-amber-500" />
                                          {reg.prize.name}
                                      </span>
                                  ) : (
                                      <span className="inline-flex items-center justify-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 px-3 py-2 rounded-xl text-xs font-bold">
                                          Sin premio (Agotado)
                                      </span>
                                  )}
                              </td>
                          </motion.tr>
                      ))}
                  </motion.tbody>
              </table>
          </div>
      )}
      <ImageModal />
    </div>
  )
}