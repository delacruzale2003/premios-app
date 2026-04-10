import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, Loader2, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'

// Rango de horas que queremos mostrar (8 AM a 10 PM)
const START_HOUR = 8;
const END_HOUR = 22;

export default function StatsView({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetchStats = async () => {
      const { data: regs } = await supabase
        .from('registrations')
        .select('created_at, stores(name)')
        .eq('campaign_id', campaignId)
      
      if (!regs) return
      
      // Inicializamos un objeto solo con las horas que nos interesan (8 a 22)
      const hoursMap: Record<number, number> = {}
      for (let i = START_HOUR; i <= END_HOUR; i++) {
        hoursMap[i] = 0
      }
      
      const stores: Record<string, number> = {}
      
      regs.forEach((r: any) => {
        const hour = new Date(r.created_at).getHours()
        
        // Solo sumamos si la hora está dentro de nuestro rango
        if (hour >= START_HOUR && hour <= END_HOUR) {
          hoursMap[hour]++
        }
        
        const sName = r.stores?.name || 'Desconocida'
        stores[sName] = (stores[sName] || 0) + 1
      })
      
      // Convertimos el mapa de horas de vuelta a un array ordenado para renderizar
      const hoursArray = Object.entries(hoursMap).map(([hour, count]) => ({
        hour: parseInt(hour),
        count
      }))
      
      setData({ 
        hours: hoursArray, 
        stores: Object.entries(stores).sort((a,b) => (b[1] as number) - (a[1] as number)) 
      })
    }
    
    fetchStats()
  }, [campaignId])

  if (!data) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={32}/>
    </div>
  )

  // Encontramos el valor máximo para calcular los porcentajes de altura
  const maxHourCount = Math.max(...data.hours.map((h: any) => h.count), 1);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-full"
    >
      
      {/* RANKING TIENDAS */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm w-full overflow-hidden">
        <h3 className="font-bold flex items-center gap-2 mb-8 text-xl tracking-tight">
          <Trophy size={20} className="text-yellow-500"/> Mejores Tiendas
        </h3>
        
        <div className="space-y-6 w-full">
          {data.stores.length === 0 ? (
             <p className="text-zinc-500 text-sm">Aún no hay registros.</p>
          ) : (
            data.stores.slice(0, 5).map(([name, count]: any, i: number) => {
              const maxCount = data.stores[0][1] || 1
              const percentage = Math.min((count / maxCount) * 100, 100)

              return (
                <div key={name} className="relative w-full group">
                  <div className="flex justify-between items-end text-xs font-black mb-2 uppercase tracking-widest text-zinc-400">
                    <span className="truncate pr-4 flex-1">{i + 1}. {name}</span>
                    <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">{count} regs</span>
                  </div>
                  
                  <div className="h-3 w-full bg-zinc-100 dark:bg-black rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
                      className="h-full bg-blue-500 rounded-full group-hover:bg-blue-400 transition-colors" 
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* HORARIOS PICO (Rango 8am - 10pm) */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm w-full overflow-hidden flex flex-col">
        <h3 className="font-bold flex items-center gap-2 mb-8 text-xl tracking-tight">
          <Clock size={20} className="text-purple-500"/> Horarios Pico
        </h3>
        
        {/* Aumentamos el gap porque ahora hay menos columnas */}
        <div className="flex items-end justify-between flex-1 min-h-[160px] gap-1 sm:gap-2 w-full pt-6">
          {data.hours.map((item: {hour: number, count: number}, i: number) => {
             const percentage = (item.count / maxHourCount) * 100;
             
             return (
              <div key={item.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                
                {/* Tooltip mejorado con animación */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  className="absolute bottom-full mb-2 bg-zinc-900 dark:bg-white text-white dark:text-black text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 transition-all font-bold pointer-events-none z-10 whitespace-nowrap shadow-lg flex flex-col items-center"
                >
                  <span className="text-[8px] opacity-70 mb-0.5">{item.hour}:00</span>
                  <span className="text-xs">{item.count} reg</span>
                </motion.div>
                
                {/* Barra vertical con efecto hover que la ensancha ligeramente */}
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${percentage}%` }}
                  transition={{ type: "spring", stiffness: 100, damping: 15, delay: i * 0.05 }}
                  className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-t-md group-hover:bg-purple-500 transition-all origin-bottom"
                  style={{ minHeight: '4px' }}
                  whileHover={{ scaleX: 1.1 }}
                />
                
                {/* Números de hora: Al ser menos, podemos mostrar 1 de cada 2 en móviles */}
                <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 mt-3 hidden sm:block">
                  {item.hour}h
                </span>
                <span className="text-[8px] font-black text-zinc-400 mt-3 block sm:hidden">
                  {i % 2 === 0 ? `${item.hour}h` : ''}
                </span>
              </div>
             )
          })}
        </div>
      </div>

    </motion.div>
  )
}