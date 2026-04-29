'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'
import { motion, Variants } from 'framer-motion'
import { 
  Users, 
  Gift, 
  Store, 
  TrendingUp, 
  Loader2, 
  AlertCircle, 
  Activity,
  RefreshCcw,
  Repeat,
  Clock
} from 'lucide-react'
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts'

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- ANIMACIONES ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

// --- CUSTOM Y-AXIS TICK (Para las Píldoras de Tiendas) ---
const CustomYAxisTick = ({ x, y, payload }: any) => {
  const text = payload.value || '';
  const shortText = text.length > 15 ? text.substring(0, 14) + '...' : text;
  
  return (
    <g transform={`translate(${x},${y})`}>
      <rect 
        x={-125} y={-14} 
        width={115} height={28} 
        rx={14} 
        fill="#ffffff" 
        stroke="#e4e4e7" 
        strokeWidth="1" 
        className="dark:fill-zinc-800 dark:stroke-zinc-700" 
      />
      <text 
        x={-67.5} y={4} 
        textAnchor="middle" 
        fontSize="10px" 
        fontWeight="bold" 
        className="fill-zinc-800 dark:fill-zinc-200"
      >
        {shortText}
      </text>
    </g>
  );
};

export default function ClientAnalyticsDashboard() {
  const params = useParams()
  const shareUuid = params?.uuid as string

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [campaign, setCampaign] = useState<any>(null)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [prizes, setPrizes] = useState<any[]>([])

  useEffect(() => {
    if (shareUuid) fetchDashboardData()
  }, [shareUuid])

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // 1. Obtener Campaña
      const { data: camp, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('share_uuid', shareUuid)
        .single()

      if (campError || !camp) throw new Error("Campaña no encontrada")
      setCampaign(camp)

      // 2. Obtener Tiendas y Premios (cantidades normales)
      const [storesRes, prizesRes] = await Promise.all([
        supabase.from('stores').select('id, name').eq('campaign_id', camp.id),
        supabase.from('prizes').select('id, stock').eq('campaign_id', camp.id)
      ])

      setStores(storesRes.data || [])
      setPrizes(prizesRes.data || [])

      // 3. DESCARGA RECURSIVA
      let allRegs: any[] = [];
      let hasMoreRegs = true;
      let page = 0;
      const pageSize = 1000;

      while (hasMoreRegs) {
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          // Añadimos 'phone' y 'dni' para el filtro avanzado de recurrencia
          .select('id, created_at, store_id, phone, dni') 
          .eq('campaign_id', camp.id)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (regError) throw regError;

        if (regData && regData.length > 0) {
          allRegs = [...allRegs, ...regData];
          if (regData.length < pageSize) {
            hasMoreRegs = false; 
          } else {
            page++; 
          }
        } else {
          hasMoreRegs = false;
        }
      }
      setRegistrations(allRegs);

    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // --- PROCESAMIENTO DE DATOS ---
  
  const totalRegistrations = registrations.length
  const currentStock = prizes.reduce((acc, curr) => acc + (curr.stock || 0), 0)
  const totalStores = stores.length

  // NUEVO: KPI de Recurrencia Auditando la "Trampa" del DNI
  const recurrenceRate = useMemo(() => {
    if (totalRegistrations === 0) return 0
    
    const uniqueIdentifiers = new Set()

    registrations.forEach(r => {
      let identifier = r.phone || r.id; // Por defecto el teléfono (o ID si no hay nada)

      if (r.dni && r.dni !== 'N/A') {
        let cleanDni = r.dni.trim();
        // Si el DNI tiene más de 8 caracteres (la trampa del promotor)
        if (cleanDni.length > 8) {
          // Expresión Regular: Elimina todos los '0' y '1' seguidos al inicio (^) o al final ($)
          const coreDni = cleanDni.replace(/^[01]+|[01]+$/g, '');
          // Usamos el DNI limpio solo si logramos rescatar el núcleo (por seguridad)
          identifier = coreDni.length >= 8 ? coreDni : cleanDni;
        } else {
          identifier = cleanDni;
        }
      }
      uniqueIdentifiers.add(identifier);
    })

    const repeatedPlays = totalRegistrations - uniqueIdentifiers.size
    return ((repeatedPlays / totalRegistrations) * 100).toFixed(1)
  }, [registrations, totalRegistrations])

  // Gráfico 1: Registros por Día
  const chartDataRegistrations = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return { full: `${year}-${month}-${day}`, short: `${day}/${month}` }
    })

    const counts = registrations.reduce((acc, reg) => {
      const d = new Date(reg.created_at)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      acc[dateStr] = (acc[dateStr] || 0) + 1
      return acc
    }, {})

    return last7Days.map(dayObj => ({
      name: dayObj.short,
      Registros: counts[dayObj.full] || 0
    }))
  }, [registrations])

  // Gráfico 2: Top 5 Tiendas
  const topStoresData = useMemo(() => {
    const counts = registrations.reduce((acc, reg) => {
      if (reg.store_id) {
        acc[reg.store_id] = (acc[reg.store_id] || 0) + 1
      }
      return acc
    }, {})

    return Object.keys(counts)
      .map(storeId => {
        const store = stores.find(s => s.id === storeId)
        return {
          name: store ? store.name : 'Desconocida',
          Registros: counts[storeId]
        }
      })
      .sort((a, b) => b.Registros - a.Registros)
      .slice(0, 5) 
  }, [registrations, stores])

  // Gráfico 3: Mapa de Calor por Horas
  const heatMapData = useMemo(() => {
    const timeRanges = {
      'Madrugada (00-06)': 0,
      'Mañana (07-11)': 0,
      'Mediodía (12-15)': 0,
      'Tarde (16-19)': 0,
      'Noche (20-23)': 0
    }

    registrations.forEach(reg => {
      const d = new Date(reg.created_at)
      const hour = d.getHours() 

      if (hour >= 0 && hour <= 6) timeRanges['Madrugada (00-06)']++
      else if (hour >= 7 && hour <= 11) timeRanges['Mañana (07-11)']++
      else if (hour >= 12 && hour <= 15) timeRanges['Mediodía (12-15)']++
      else if (hour >= 16 && hour <= 19) timeRanges['Tarde (16-19)']++
      else timeRanges['Noche (20-23)']++
    })

    return Object.keys(timeRanges).map(key => ({
      name: key.split(' ')[0], 
      Rango: key,
      Registros: timeRanges[key as keyof typeof timeRanges]
    }))
  }, [registrations])

  const getMaxHeatmapValue = () => Math.max(...heatMapData.map(d => d.Registros))


  // --- RENDERIZADO CONDICIONAL ---
  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f5f5f7] dark:bg-black gap-4 px-4 text-center">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-zinc-600 dark:text-zinc-400 font-bold text-sm">Link de analíticas inválido o expirado.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f5f5f7] dark:bg-black gap-4">
        <Loader2 className="animate-spin text-[#0071e3]" size={40} />
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">Cargando gran volumen de métricas...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-8 selection:bg-blue-200">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* HEADER APPLE-STYLE */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
              Rendimiento de Campaña
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-1 flex items-center gap-2">
              <Activity size={16} className="text-[#0071e3]" /> {campaign?.name}
            </p>
          </div>
          
          <button 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="w-full sm:w-auto bg-white dark:bg-zinc-900 text-[#0071e3] border border-zinc-200 dark:border-zinc-800 px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
            Actualizar Datos
          </button>
        </header>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* GRID DE KPIs SIMPLIFICADO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                <Users size={20} className="text-[#0071e3]" />
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Registros Totales</p>
                <h3 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalRegistrations}</h3>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
                <Gift size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Stock Restante</p>
                <h3 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">{currentStock}</h3>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
                <Store size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Tiendas Creadas</p>
                <h3 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalStores}</h3>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#0071e3] to-blue-500 p-6 rounded-[2rem] shadow-md border border-blue-400 flex flex-col justify-between text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-20">
                <Repeat size={100} />
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                <Repeat size={20} className="text-white" />
              </div>
              <div className="relative z-10">
                <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Tasa de Recurrencia</p>
                <h3 className="text-4xl font-black tracking-tighter">{recurrenceRate}%</h3>
              </div>
            </motion.div>

          </div>

          {/* ZONA DE GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 dark:border-zinc-800 lg:col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <TrendingUp size={20} className="text-[#0071e3]" />
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Tráfico últimos 7 días</h3>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataRegistrations}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 600 }} dx={-10} allowDecimals={false} />
                    
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e4e4e7', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#0071e3', fontWeight: '900', fontSize: '16px' }}
                      labelStyle={{ color: '#18181b', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}
                      cursor={{ stroke: '#0071e3', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Registros" 
                      stroke="#0071e3" 
                      strokeWidth={4} 
                      dot={{ r: 4, fill: '#0071e3', strokeWidth: 2, stroke: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-8">
                <Clock size={20} className="text-[#0071e3]" />
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Horas de Mayor Actividad</h3>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={heatMapData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,113,227,0.04)' }}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e4e4e7', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      labelStyle={{ color: '#18181b', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#0071e3', fontWeight: '900', fontSize: '16px' }}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.Rango || label}
                    />
                    <Bar dataKey="Registros" radius={[8, 8, 8, 8]} barSize={32}>
                      {
                        heatMapData.map((entry, index) => {
                          const max = getMaxHeatmapValue();
                          const intensity = max === 0 ? 0.2 : 0.2 + (0.8 * (entry.Registros / max));
                          return <Cell key={`cell-${index}`} fill={`rgba(0, 113, 227, ${intensity})`} />;
                        })
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-8">
                <Store size={20} className="text-[#0071e3]" />
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Top 5 Tiendas (Volumen)</h3>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topStoresData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" opacity={0.5} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 600 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={<CustomYAxisTick />} width={135} />
                    
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,113,227,0.04)' }}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e4e4e7', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#0071e3', fontWeight: '900', fontSize: '16px' }}
                      labelStyle={{ color: '#18181b', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Bar 
                      dataKey="Registros" 
                      fill="#0071e3" 
                      radius={[0, 8, 8, 0]} 
                      barSize={24}
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </div>
  )
}