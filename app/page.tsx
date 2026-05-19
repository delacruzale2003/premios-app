'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Megaphone, CalendarDays, Shield } from 'lucide-react'
import Link from 'next/link'

export default function LandingHome() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } as any }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col items-center justify-center p-6 font-sans selection:bg-zinc-200">
      
      {/* Background subtle noise/gradient if desired, kept pure for now */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-white to-[#FAFAFA] -z-10" />

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-4xl mx-auto flex flex-col items-center text-center"
      >
        
        {/* Top Badge */}
        <motion.div variants={itemVariants} className="mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            <Shield size={14} />
            System Control
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1 
          variants={itemVariants}
          className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-900 mb-6 leading-tight"
        >
          Centralized <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-500">
            Platform Hub
          </span>
        </motion.h1>

        {/* Subtitle / Focus Areas */}
        <motion.p 
          variants={itemVariants}
          className="text-lg md:text-xl text-zinc-500 max-w-2xl mb-12 font-medium"
        >
          Streamline your workflow. Access your core modules for <span className="text-zinc-900">Campaign Management</span> and <span className="text-zinc-900">Marketing Events</span> all in one place.
        </motion.p>

        {/* The Two Main Pillars (Visual representation only, clean) */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 mb-16 w-full max-w-2xl">
          <div className="flex-1 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center mb-4 text-zinc-800">
              <Megaphone size={24} />
            </div>
            <h3 className="font-bold text-zinc-900">Campaign Management</h3>
            <p className="text-sm text-zinc-500 mt-2">Oversee active promotions and prizes.</p>
          </div>

          <div className="flex-1 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center mb-4 text-zinc-800">
              <CalendarDays size={24} />
            </div>
            <h3 className="font-bold text-zinc-900">Marketing Events</h3>
            <p className="text-sm text-zinc-500 mt-2">Track real-time branch activations.</p>
          </div>
        </motion.div>

        {/* Only ONE Button: Admin Access */}
        <motion.div variants={itemVariants}>
          {/* Cambia el href a la ruta correcta de tu panel admin, ej: '/admin/login' */}
          <Link href="/admin">
            <button className="group relative inline-flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white rounded-full font-bold text-lg hover:bg-zinc-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
              Admin Access
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </motion.div>

      </motion.main>
    </div>
  )
}