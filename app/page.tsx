'use client'

import Image from "next/image";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Home() {

  useEffect(() => {
    const checkConnection = async () => {
      // Intentamos una consulta simple para ver si hay conexión
      const { data, error } = await supabase.from('campaigns').select('count');
      
      console.log("--- Supabase Connection Check ---");
      console.log("URL configurada:", process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      if (error) {
        console.error("❌ Error de conexión:", error.message);
      } else {
        console.log("✅ Conexión exitosa. Tablas accesibles.");
      }
    };

    checkConnection();
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-white font-sans dark:bg-black">
      {/* Al quitar max-w-3xl y ajustar el padding, la app fluye por todo el ancho */}
      <main className="flex min-h-screen w-full flex-col justify-center px-6 py-12 sm:px-16 lg:px-32 xl:px-48">
         
         {/* Contenedor interno para que en pantallas gigantes el texto no se estire de forma ilegible */}
         <div className="w-full max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700"> 
            
            <Image
              className="dark:invert mb-4 sm:mb-8"
              src="/next.svg"
              alt="Next.js logo"
              width={140}
              height={28}
              priority
            />
            
            <div className="flex flex-col gap-6 text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.1] tracking-tighter text-zinc-900 dark:text-white">
                App de Entrega <br className="hidden sm:block" />
                <span className="text-blue-600">de Premios 🎁</span>
              </h1>
              <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                La base de datos está conectada. Abre la consola (F12) para verificar el estado de la conexión con Supabase en tiempo real.
              </p>
            </div>

            {/* Botones mejorados y adaptados para móviles (columna) y PC (fila) */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
              <button
                onClick={() => console.log("Próximamente: Formulario de registro")}
                className="flex h-14 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-blue-600 text-white px-8 font-black uppercase tracking-widest text-xs transition-all hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-[0_8px_20px_rgba(37,99,235,0.3)]"
              >
                Comenzar Registro
              </button>
              
              <Link 
                href="/admin" 
                className="flex h-14 w-full sm:w-auto items-center justify-center rounded-full border-2 border-zinc-200 dark:border-zinc-800 bg-transparent px-8 font-black uppercase tracking-widest text-xs text-zinc-600 dark:text-zinc-300 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:scale-95"
              >
                Acceso Admin
              </Link>
            </div>

         </div>
      </main>
    </div>
  );
}