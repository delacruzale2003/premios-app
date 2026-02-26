'use client' // Importante para usar useEffect y el cliente de supabase

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            App de Entrega de Premios 🎁
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            La base de datos está conectada. Abre la consola (F12) para verificar el estado de la conexión con Supabase.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <button
            onClick={() => console.log("Próximamente: Formulario de registro")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-white px-5 transition-colors hover:bg-[#383838] dark:bg-white dark:text-black md:w-[200px]"
          >
            Comenzar Registro
          </button>
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
  Acceso Admin
</Link>
        </div>
      </main>
    </div>
  );
}