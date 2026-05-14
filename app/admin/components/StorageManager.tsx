'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Trash2, 
  Image as ImageIcon, 
  HardDrive, 
  Loader2, 
  AlertTriangle,
  Server,
  Ghost // Ícono para los archivos huérfanos
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface CampaignStorageData {
  id: string;
  name: string;
  is_active: boolean;
  size: number;
  fileCount: number;
  files: any[];
}

interface OrphanStorageData {
  size: number;
  fileCount: number;
  files: any[];
}

export default function StorageManager() {
  const [campaignsData, setCampaignsData] = useState<CampaignStorageData[]>([])
  const [orphanData, setOrphanData] = useState<OrphanStorageData>({ size: 0, fileCount: 0, files: [] })
  const [loading, setLoading] = useState(true)
  const [purgingId, setPurgingId] = useState<string | null>(null)

  useEffect(() => {
    loadStorageData()
  }, [])

  async function loadStorageData() {
    setLoading(true)
    
    // 1. Obtenemos todas las campañas de la Base de Datos
    const { data: camps } = await supabase
      .from('campaigns')
      .select('id, name, is_active')

    const campIds = (camps || []).map(c => c.id)

    // 2. Escaneamos la raíz del Storage (Buscando carpetas)
    const { data: rootItems } = await supabase.storage
      .from('vouchers')
      .list('', { limit: 1000 })

    // 3. Detectamos cuáles son carpetas huérfanas (que no están en la tabla campaigns)
    const orphanFolderNames = (rootItems || [])
      .map(item => item.name)
      .filter(name => name !== '.emptyFolderPlaceholder' && !campIds.includes(name))

    // 4. Calculamos peso de las campañas VIVAS
    if (camps) {
      const campsWithSizes: CampaignStorageData[] = await Promise.all(
        camps.map(async (c) => {
          const folderPath = `${c.id}/registros_generales`
          const { data: files } = await supabase.storage
            .from('vouchers')
            .list(folderPath, { limit: 5000 }) 

          const validFiles = (files || []).filter(f => f.name !== '.emptyFolderPlaceholder')
          const totalSize = validFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0)

          return {
            id: c.id,
            name: c.name,
            is_active: c.is_active,
            size: totalSize,
            fileCount: validFiles.length,
            files: validFiles
          }
        })
      )
      campsWithSizes.sort((a, b) => b.size - a.size)
      setCampaignsData(campsWithSizes)
    }

    // 5. Calculamos peso de las carpetas HUÉRFANAS
    let orphanSize = 0;
    let orphanCount = 0;
    let orphanFiles: any[] = [];

    await Promise.all(
      orphanFolderNames.map(async (folderName) => {
        const folderPath = `${folderName}/registros_generales`
        const { data: files } = await supabase.storage.from('vouchers').list(folderPath, { limit: 5000 })
        
        const validFiles = (files || []).filter(f => f.name !== '.emptyFolderPlaceholder')
        validFiles.forEach(f => {
          orphanSize += (f.metadata?.size || 0);
          orphanFiles.push({ ...f, folderPath }); // Guardamos su ruta exacta para poder borrarla
        });
        orphanCount += validFiles.length;
      })
    )

    setOrphanData({ size: orphanSize, fileCount: orphanCount, files: orphanFiles })
    setLoading(false)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const globalTotalSize = useMemo(() => {
    const totalCamps = campaignsData.reduce((acc, c) => acc + c.size, 0)
    return formatBytes(totalCamps + orphanData.size)
  }, [campaignsData, orphanData])

  // --- ACCIÓN DE BORRADO (CON CHUNKS PARA EVITAR LÍMITES DE SUPABASE) ---
  const handlePurge = async (id: string, filesToDelete: any[], name: string, isOrphan = false) => {
    const sizeToFree = formatBytes(filesToDelete.reduce((acc, f) => acc + (f.metadata?.size || 0), 0))
    
    let confirmText = isOrphan 
      ? `🚨 ALERTA DE LIMPIEZA: Vas a borrar ${filesToDelete.length} fotos HUÉRFANAS.\n\nLiberarás ${sizeToFree} de espacio inútil. ¿Deseas continuar?`
      : `⚠️ ATENCIÓN: Vas a borrar ${filesToDelete.length} fotos de "${name}".\n\nLiberarás ${sizeToFree}. Tus registros en la base de datos y analíticas quedarán intactos.\n\n¿Deseas continuar?`;
    
    if (!window.confirm(confirmText)) return

    setPurgingId(id)
    
    // Armamos los paths absolutos
    const filePathsToDelete = filesToDelete.map(f => isOrphan ? `${f.folderPath}/${f.name}` : `${id}/registros_generales/${f.name}`)

    // Borrado por Lotes (Chunks de 100) para no colapsar la red
    const chunkSize = 100;
    let hasError = false;

    for (let i = 0; i < filePathsToDelete.length; i += chunkSize) {
      const chunk = filePathsToDelete.slice(i, i + chunkSize);
      const { error } = await supabase.storage.from('vouchers').remove(chunk);
      if (error) hasError = true;
    }

    if (hasError) {
      alert("Hubo algunos errores al purgar. Revisa la consola.")
    } else {
      if (isOrphan) {
        setOrphanData({ size: 0, fileCount: 0, files: [] })
      } else {
        setCampaignsData(prev => prev.map(c => 
          c.id === id ? { ...c, size: 0, fileCount: 0, files: [] } : c
        ))
      }
    }
    setPurgingId(null)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
      
      {/* HEADER DEL GESTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-zinc-900 dark:text-white tracking-tight">
            <Server className="text-red-500" size={28} /> Gestor de Espacio
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            Tus analíticas no se borrarán. Solo estamos destruyendo las fotos (Storage) para liberar tu cuota en Supabase.
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 px-6 py-4 rounded-[2rem] flex flex-col items-end w-full md:w-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Espacio Total Ocupado</span>
          <span className="text-3xl font-black text-red-600 dark:text-red-400 tracking-tighter">
            {loading ? '...' : globalTotalSize}
          </span>
        </div>
      </div>

      {/* CONTENIDO (GRILLA DE TARJETAS) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-xs font-black uppercase tracking-widest">Escaneando Storage y buscando archivos huérfanos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          <AnimatePresence>
            
            {/* TARJETA ESPECIAL: ARCHIVOS HUÉRFANOS */}
            {orphanData.size > 0 && (
              <motion.div 
                layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-[2rem] border-2 transition-all flex flex-col justify-between bg-orange-50 dark:bg-orange-950/30 border-orange-400 shadow-xl shadow-orange-500/10"
              >
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-orange-500 text-white shadow-md">
                      <Ghost size={20} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 animate-pulse">
                      Secreto / Sin Campaña
                    </span>
                  </div>
                  <h3 className="font-black text-lg tracking-tight leading-tight text-orange-900 dark:text-orange-100">
                    Archivos Huérfanos
                  </h3>
                  <p className="text-[10px] text-orange-700/70 dark:text-orange-400 mt-1 font-bold">
                    Carpetas de campañas que ya borraste de la BD. ¡Púrgalas ya!
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4 text-orange-900 dark:text-orange-200">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5">Basura Acumulada</p>
                      <p className="text-2xl font-black tracking-tighter">{formatBytes(orphanData.size)}</p>
                    </div>
                    <p className="text-xs font-bold">{orphanData.fileCount} fotos</p>
                  </div>
                  <button 
                    onClick={() => handlePurge('orphans', orphanData.files, 'Archivos Huérfanos', true)}
                    disabled={purgingId === 'orphans'}
                    className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30 active:scale-95"
                  >
                    {purgingId === 'orphans' ? <><Loader2 className="animate-spin" size={16} /> Borrando...</> : <><Trash2 size={16} /> Destruir Basura</>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* TARJETAS DE CAMPAÑAS NORMALES */}
            {campaignsData.map((camp) => (
              <motion.div 
                key={camp.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`p-6 rounded-[2rem] border transition-all flex flex-col justify-between ${
                  camp.size > 0 
                    ? 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800' 
                    : 'bg-white dark:bg-zinc-900 border-dashed border-zinc-200 dark:border-zinc-800 opacity-60'
                }`}
              >
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${camp.size > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                      {camp.size > 0 ? <HardDrive size={20} /> : <ImageIcon size={20} />}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${camp.is_active ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'}`}>
                      {camp.is_active ? 'Activa' : 'Finalizada'}
                    </span>
                  </div>
                  <h3 className="font-black text-lg tracking-tight leading-tight text-zinc-900 dark:text-white line-clamp-2" title={camp.name}>
                    {camp.name}
                  </h3>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Peso en Storage</p>
                      <p className={`text-2xl font-black tracking-tighter ${camp.size > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300 dark:text-zinc-600'}`}>
                        {formatBytes(camp.size)}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-zinc-400">{camp.fileCount} fotos</p>
                  </div>

                  <button 
                    onClick={() => handlePurge(camp.id, camp.files, camp.name)}
                    disabled={camp.size === 0 || purgingId === camp.id}
                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      camp.size > 0 
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 active:scale-95' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    {purgingId === camp.id ? (
                      <><Loader2 className="animate-spin" size={16} /> Borrando...</>
                    ) : camp.size > 0 ? (
                      <><Trash2 size={16} /> Purgar Fotos</>
                    ) : (
                      <><Trash2 size={16} /> Vacío</>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}