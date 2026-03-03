import { Plus, Store, Link as LinkIcon, Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Añadimos 'campaignUrl' a las props
export default function StoresSidebar({ stores, selectedStore, onSelect, campaignId, campaignUrl, refreshStores }: any) {
  const [newStoreName, setNewStoreName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const addStore = async () => {
    if (!newStoreName || !campaignId) return
    const { error } = await supabase.from('stores').insert({ name: newStoreName, campaign_id: campaignId })
    if (!error) {
      setNewStoreName('')
      refreshStores()
    }
  }

  const handleCopyLink = (e: any, id: string) => {
    e.stopPropagation()
    
    // USAMOS LA URL DE LA BD: Si no existe, usamos un fallback por seguridad
    const baseDomain = campaignUrl || 'fanta.ptm.pe'
    
    // Construimos el link apuntando a la web de registro externa
    const url = `https://${baseDomain}/registro/${id}`
    
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const deleteStore = async (e: any, id: string) => {
    e.stopPropagation()
    if (!confirm("¿Eliminar tienda? Se perderá el stock asignado.")) return
    await supabase.from('stores').update({ is_active: false }).eq('id', id)
    refreshStores()
  }

  return (
    <div className="flex flex-col h-[500px] lg:h-[700px] bg-zinc-100/50 dark:bg-zinc-900/30 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-zinc-800/50 p-4 shadow-inner overflow-hidden">
      <div className="px-3 pt-3 pb-5 flex items-center gap-2 font-bold text-xl tracking-tight">
        <Store className="text-blue-500" size={22}/> Puntos de Entrega
      </div>
      
      <div className="flex gap-2 mb-6 px-1">
        <input 
          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm font-medium"
          placeholder="Añadir tienda..."
          value={newStoreName}
          onChange={(e) => setNewStoreName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStore()}
        />
        <button onClick={addStore} className="bg-blue-600 text-white p-3 rounded-2xl active:scale-90 transition-all shadow-lg shadow-blue-500/20">
          <Plus size={20} strokeWidth={3}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 space-y-2.5 custom-scrollbar">
        {stores.map((s: any) => (
          <div 
            key={s.id} 
            onClick={() => onSelect(s.id)}
            className={`group relative p-4 rounded-[1.5rem] cursor-pointer flex justify-between items-center transition-all duration-300 border
              ${selectedStore === s.id 
                ? 'bg-white dark:bg-zinc-800 border-zinc-200/50 dark:border-zinc-700 shadow-xl scale-[1.02]' 
                : 'bg-transparent border-transparent hover:bg-white/40 dark:hover:bg-zinc-800/20'
              }`}
          >
            <span className={`text-[15px] truncate pr-4 ${selectedStore === s.id ? 'font-bold text-black dark:text-white' : 'font-medium text-zinc-500'}`}>
              {s.name}
            </span>
            
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
              <button 
                onClick={(e) => handleCopyLink(e, s.id)} 
                className="bg-zinc-100 dark:bg-zinc-700 p-2.5 rounded-full hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                title="Copiar link de registro"
              >
                {copiedId === s.id ? <Check size={14} strokeWidth={3}/> : <LinkIcon size={14} />}
              </button>
              <button 
                onClick={(e) => deleteStore(e, s.id)} 
                className="bg-zinc-100 dark:bg-zinc-700 p-2.5 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm"
                title="Eliminar tienda"
              >
                <Trash2 size={14}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}