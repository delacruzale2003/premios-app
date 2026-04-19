import { Image as ImageIcon, Save, Loader2, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
}

export default function InventoryGrid({ templates, prizes, localStock, onChange, onSave, isSaving, hasChanges }: any) {
  
  // Detector de móvil
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const totalStock = Object.values(localStock).reduce((acc, currentVal) => {
    const num = parseInt(currentVal as string) || 0;
    return (acc as number) + num;
  }, 0)

  const getThumbnailUrl = (fullUrl: string) => {
    if (!fullUrl) return ''
    if (fullUrl.includes('/storage/v1/object/public/')) {
      // 200x200px es súper ligero y perfecto para la grilla y la lista
      return fullUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=200&height=200&resize=contain'
    }
    return fullUrl
  }

  // DISEÑO DESKTOP: Tarjeta Cuadrada Grande
  const renderDesktopCard = (template: any, val: string) => (
    <>
      <div className="aspect-square w-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        {template.image_url ? (
          <img 
            src={getThumbnailUrl(template.image_url)} 
            alt={template.name} 
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-110" 
          />
        ) : (
          <div className="text-zinc-300 dark:text-zinc-700 flex flex-col items-center gap-1 opacity-50">
            <ImageIcon size={32} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Sin imagen</span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <h3 className="font-bold text-xs leading-tight line-clamp-2 text-zinc-800 dark:text-zinc-200" title={template.name}>
          {template.name}
        </h3>
        
        <div className="flex items-center justify-between bg-zinc-100 dark:bg-black rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-zinc-900">
          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Stock</span>
          <input 
            type="number" 
            min="0" 
            className="w-full bg-transparent font-black text-base text-black dark:text-white outline-none text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={val}
            placeholder="0"
            onChange={(e) => onChange(template.name, e.target.value)}
          />
        </div>
      </div>
    </>
  )

  // DISEÑO MÓVIL: Fila de Lista Compacta
  const renderMobileRow = (template: any, val: string) => (
    <div className="flex items-center gap-3 p-2.5">
      {/* Miniatura Cuadrada Pequeña */}
      <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-zinc-950 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800">
        {template.image_url ? (
          <img 
            src={getThumbnailUrl(template.image_url)} 
            alt={template.name} 
            loading="lazy"
            className="w-full h-full object-cover" 
          />
        ) : (
          <ImageIcon size={16} className="text-zinc-300 dark:text-zinc-700" />
        )}
      </div>

      {/* Título truncado a 1 sola línea para ahorrar espacio */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate" title={template.name}>
          {template.name}
        </h3>
      </div>
      
      {/* Input Compacto a la derecha */}
      <div className="shrink-0 w-20 flex items-center justify-between bg-zinc-100 dark:bg-black rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all">
        <input 
          type="number" 
          min="0" 
          className="w-full bg-transparent font-black text-sm text-black dark:text-white outline-none text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={val}
          placeholder="0"
          onChange={(e) => onChange(template.name, e.target.value)}
        />
      </div>
    </div>
  )

  return (
    <div className="relative flex-1 flex flex-col">
      
      {/* PANEL DE TOTAL */}
      <div className="mb-4 flex items-center justify-between bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            <Package size={20} className="text-blue-500" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Stock Global</span>
            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">Total en esta tienda</span>
          </div>
        </div>
        <div className="bg-zinc-100 dark:bg-black px-4 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <span className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
            {totalStock as number}
          </span>
        </div>
      </div>

      {/* RENDERIZADO CONDICIONAL POR DISPOSITIVO */}
      {isMobile ? (
        // VERSIÓN MÓVIL: Lista vertical delgada (Fila por fila)
        <div className="flex flex-col gap-2 overflow-y-auto pb-24 custom-scrollbar px-1">
          {templates.map((template: any) => {
            const val = localStock[template.name] ?? ''
            return (
              <div 
                key={template.id} 
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
              >
                {renderMobileRow(template, val)}
              </div>
            )
          })}
        </div>
      ) : (
        // VERSIÓN DESKTOP: Grilla Cuadrada Animada (Tarjetas grandes)
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pb-24 custom-scrollbar px-1"
        >
          {templates.map((template: any) => {
            const val = localStock[template.name] ?? ''
            return (
              <motion.div 
                variants={itemVariants}
                key={template.id} 
                className="relative flex flex-col bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
              >
                {renderDesktopCard(template, val)}
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* FLOATING SAVE BUTTON */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <button 
            onClick={onSave} disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full text-sm font-bold shadow-[0_10px_30px_rgba(37,99,235,0.4)] flex items-center gap-2 active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16} /> Guardar Inventario</>}
          </button>
        </div>
      )}
    </div>
  )
}