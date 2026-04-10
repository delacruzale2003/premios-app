'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Upload, CheckCircle2, AlertCircle, Loader2, MapPin, Gift, Camera } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion' // NUEVO: Importamos Framer Motion

export default function RegisterStorePage() {
  const params = useParams()
  const storeId = params.storeId as string

  // Estados de tienda
  const [storeName, setStoreName] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [validStore, setValidStore] = useState<boolean | null>(null)

  // Estados del formulario
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [voucherFile, setVoucherFile] = useState<File | null>(null)

  // Estados de UI
  const [loading, setLoading] = useState(false)
  
  // NUEVO: Estado para los Toasts Flotantes (Reemplaza al antiguo 'error' estático)
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'loading' } | null>(null)
  
  // Estado de Éxito y Premio
  const [success, setSuccess] = useState(false)
  const [wonPrize, setWonPrize] = useState<{ name: string, image_url: string | null } | null>(null)

  // NUEVO: Función auxiliar para mostrar Toasts de error temporalmente
  const showErrorToast = (message: string) => {
    setToastMessage({ text: message, type: 'error' })
    setTimeout(() => setToastMessage(null), 4000) // Desaparece a los 4 segundos
  }

  useEffect(() => {
    if (!storeId) return

    const fetchStore = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('name, campaign_id, is_active')
        .eq('id', storeId)
        .single()

      if (error || !data || !data.is_active) {
        setValidStore(false)
        return
      }

      setStoreName(data.name)
      setCampaignId(data.campaign_id)
      setValidStore(true)
    }

    fetchStore()
  }, [storeId])

  // --- FUNCIÓN DE COMPRESIÓN SÚPER AGRESIVA (WebP + 800px) ---
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        const MAX_SIZE = 800 
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width
          width = MAX_SIZE
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height
          height = MAX_SIZE
        }
        
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          } else {
            reject(new Error("Fallo en la compresión de imagen"))
          }
        }, 'image/webp', 0.6)
      }
      img.onerror = (err) => reject(err)
    })
  }

  // --- VALIDACIÓN DE ARCHIVO AL SELECCIONAR ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToastMessage(null) // Limpiamos cualquier error previo
    const file = e.target.files?.[0]
    
    if (!file) {
      setVoucherFile(null)
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    
    if (!validTypes.includes(file.type)) {
      showErrorToast("Formato no permitido. Por favor sube una foto normal (JPG, PNG o HEIC).")
      setVoucherFile(null)
      e.target.value = ''
      return
    }

    setVoucherFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!fullName || !dni || !voucherFile) {
      showErrorToast('Por favor, completa los campos obligatorios y toma la foto del voucher.')
      return
    }

    if (dni.length < 8) {
      showErrorToast('El DNI debe tener al menos 8 dígitos.')
      return
    }

    setLoading(true)
    setToastMessage({ text: 'Validando registro y subiendo foto...', type: 'loading' })

    try {
      // 1. ASIGNACIÓN SEGURA DE PREMIO
      const { data: availablePrizes, error: prizesError } = await supabase
        .from('prizes')
        .select('id, name, stock, image_url')
        .eq('store_id', storeId)
        .gt('stock', 0)

      if (prizesError) throw new Error('Error al consultar el stock de premios.')

      let assignedPrize = null

      if (availablePrizes && availablePrizes.length > 0) {
        const randomPrizeIndex = Math.floor(Math.random() * availablePrizes.length)
        assignedPrize = availablePrizes[randomPrizeIndex]

        const { error: updateStockError } = await supabase
          .from('prizes')
          .update({ stock: assignedPrize.stock - 1 })
          .eq('id', assignedPrize.id)
          .gt('stock', 0) 

        if (updateStockError) {
          assignedPrize = null
        }
      }

      // 2. COMPRESIÓN Y SUBIDA DEL VOUCHER
      const optimizedFile = await compressImage(voucherFile)
      
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`
      const filePath = `${campaignId}/${storeId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('vouchers')
        .upload(filePath, optimizedFile)

      if (uploadError) throw new Error('Error al subir la foto al servidor.')

      const { data: publicUrlData } = supabase.storage
        .from('vouchers')
        .getPublicUrl(filePath)
      const voucherUrl = publicUrlData.publicUrl

      // 3. GUARDAR REGISTRO
      const { error: insertError } = await supabase
        .from('registrations')
        .insert({
          full_name: fullName,
          dni: dni,
          phone: phone || null,
          email: email || null,
          voucher_url: voucherUrl,
          store_id: storeId,
          campaign_id: campaignId,
          prize_id: assignedPrize ? assignedPrize.id : null 
        })

      if (insertError) throw new Error('Error al guardar tus datos. Intenta nuevamente.')

      if (assignedPrize) {
          setWonPrize({ name: assignedPrize.name, image_url: assignedPrize.image_url })
      }
      
      setToastMessage(null) // Quitamos el loading
      setSuccess(true)

    } catch (err: any) {
      console.error(err)
      setLoading(false)
      showErrorToast(err.message || 'Ocurrió un error inesperado al procesar el registro.')
    }
  }

  if (validStore === null) return <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center"><Loader2 className="animate-spin text-zinc-400" size={32} /></div>
  
  if (validStore === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] dark:bg-black p-4 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">Tienda no encontrada</h1>
        <p className="text-zinc-500 mt-2">El enlace proporcionado no es válido o ha expirado.</p>
      </div>
    )
  }

  // --- PANTALLA DE ÉXITO ESTILO APPLE ---
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] dark:bg-black p-4 text-center font-sans">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white dark:border-zinc-800 max-w-md w-full relative overflow-hidden">
          
          <div className="relative z-10">
              {wonPrize ? (
                <>
                    <h1 className="text-4xl font-black text-black dark:text-white mb-2 tracking-tight">¡Ganaste!</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">Acércate al módulo para reclamar:</p>
                    
                    {/* TARJETA DE PREMIO PREMIUM */}
                    <div className="bg-[#F5F5F7] dark:bg-black p-8 rounded-[2rem] mb-10 w-full transform transition-all duration-500 hover:scale-105 border border-zinc-200/50 dark:border-zinc-800 shadow-inner">
                        {wonPrize.image_url ? (
                            <div className="aspect-square w-full relative mb-6">
                                <img 
                                    src={wonPrize.image_url} 
                                    alt={wonPrize.name} 
                                    className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl"
                                />
                            </div>
                        ) : (
                            <div className="w-32 h-32 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <Gift size={48} className="text-zinc-300 dark:text-zinc-600" />
                            </div>
                        )}
                        <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight leading-tight">
                            {wonPrize.name}
                        </h2>
                    </div>
                </>
              ) : (
                  <>
                    <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={48} className="text-green-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-black dark:text-white mb-3 tracking-tight">Registro Completo</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-10 leading-relaxed">
                        Tus datos han sido guardados correctamente.<br/><br/>
                        <span className="text-sm">Nota: El stock de premios para esta sucursal se ha agotado.</span>
                    </p>
                  </>
              )}
              
              <button 
                onClick={() => window.location.reload()} 
                className="bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-full font-bold hover:opacity-80 w-full transition-all active:scale-95 text-lg"
              >
                Nuevo Registro
              </button>
          </div>
        </div>
      </div>
    )
  }

  // --- FORMULARIO ESTILO APPLE ---
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black p-4 md:p-8 flex flex-col items-center justify-center font-sans relative">
      
      {/* NUEVO: TOAST FLOTANTE PARA ERRORES Y CARGA */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl border font-bold text-sm
              ${toastMessage.type === 'error' 
                ? 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-600 dark:text-red-200' 
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-black dark:text-white'
              }
            `}
          >
            {toastMessage.type === 'loading' ? (
              <Loader2 className="animate-spin text-blue-500" size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md w-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/50 dark:border-zinc-800 overflow-hidden">
        
        {/* Cabecera Clean */}
        <div className="pt-10 pb-6 px-8 text-center relative">
          <div className="w-16 h-16 bg-black dark:bg-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 shadow-lg rotate-3">
              <Gift size={32} className="text-white dark:text-black -rotate-3" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white mb-3">Registro</h1>
          <div className="flex items-center justify-center gap-1.5 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 inline-flex px-4 py-1.5 rounded-full text-sm font-medium">
            <MapPin size={14} />
            <span className="truncate max-w-[200px]">{storeName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-10 space-y-5">
          
          {/* ELIMINADO: Bloque de error estático rojo (Reemplazado por el Toast) */}

          {/* INPUTS ESTILO IOS */}
          <div className="space-y-4">
              <div>
                <input 
                  type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-[#F5F5F7] dark:bg-black/50 text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 outline-none transition-all font-medium text-lg border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700"
                  placeholder="Nombres Completos"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input 
                    type="text" inputMode="numeric" required maxLength={9} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-5 py-4 rounded-2xl bg-[#F5F5F7] dark:bg-black/50 text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 outline-none transition-all font-medium text-lg border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700"
                    placeholder="DNI"
                  />
                </div>
                <div>
                  <input 
                    type="tel" inputMode="numeric" maxLength={9} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-5 py-4 rounded-2xl bg-[#F5F5F7] dark:bg-black/50 text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 outline-none transition-all font-medium text-lg border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700"
                    placeholder="Teléfono"
                  />
                </div>
              </div>

              <div>
                <input 
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-[#F5F5F7] dark:bg-black/50 text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 outline-none transition-all font-medium text-lg border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700"
                  placeholder="Correo (Opcional)"
                />
              </div>
          </div>

          {/* UPLOAD ÁREA MEJORADA CON VALIDACIÓN Y CAPTURA MÓVIL */}
          <div className="pt-2">
            <label className={`
              flex flex-col items-center justify-center w-full h-32 rounded-[2rem] cursor-pointer transition-all border-2
              ${voucherFile ? 'border-transparent bg-zinc-900 text-white dark:bg-white dark:text-black' : 'border-dashed border-zinc-300 dark:border-zinc-700 bg-[#F5F5F7] dark:bg-black/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500'}
            `}>
              <div className="flex flex-col items-center justify-center text-center px-6">
                {voucherFile ? (
                  <>
                    <CheckCircle2 size={32} className="mb-2 opacity-80" />
                    <p className="text-sm font-bold truncate w-full">{voucherFile.name}</p>
                  </>
                ) : (
                  <>
                    <Camera size={32} className="mb-2 opacity-50" />
                    <p className="text-sm font-semibold">Tomar foto de tu voucher</p>
                  </>
                )}
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/jpeg, image/png, image/webp, image/heic, image/heif" 
                capture="environment" 
                required 
                onChange={handleFileChange} 
              />
            </label>
          </div>

          {/* BOTÓN FINAL */}
          <button 
            type="submit" disabled={loading}
            className="w-full mt-8 bg-blue-600 text-white font-bold text-xl py-4 rounded-full hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Enviar y Participar'}
          </button>

        </form>
      </div>
    </div>
  )
}