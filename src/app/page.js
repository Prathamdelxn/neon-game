'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile devices by user agent or screen width
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent || navigator.vendor || window.opera : '';
    const mobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    const mobileWidth = window.innerWidth < 768;
    setIsMobile(mobileUA || mobileWidth);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#050114] text-white overflow-hidden font-sans select-none">
      {/* Background Neon Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-purple-900/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-cyan-900/20 blur-[150px] pointer-events-none" />
      
      {/* Stars Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-45" />

      {/* Main container */}
      <div className="z-10 max-w-4xl w-full px-6 flex flex-col items-center py-12">
        
        {/* Title Block */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-wider text-cyan-400 uppercase bg-cyan-950/40 border border-cyan-800/50 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.1)]">
            Local Multi-Screen Arcade
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent filter drop-shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            NEON SPARK
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            A real-time remote-controlled space game. Pair your phone instantly and steer your fighter on the big screen!
          </p>
        </div>

        {/* Action Selection */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl">
          
          {/* Option 1: Game Host (PC / Big Screen) */}
          <Link
            href="/game"
            className={`group relative flex flex-col justify-between p-8 rounded-2xl border transition-all duration-300 ${
              !isMobile
                ? 'bg-gradient-to-br from-[#0c1033] to-[#050114] border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.15)] ring-2 ring-cyan-500/20'
                : 'bg-[#0b071e]/50 border-zinc-800/80 hover:border-cyan-500/30'
            }`}
          >
            <div>
              {/* Highlight badge for recommended option */}
              {!isMobile && (
                <span className="absolute top-4 right-4 bg-cyan-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Recommended for PC
                </span>
              )}
              
              <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 text-2xl font-bold mb-6 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                🖥️
              </div>
              <h2 className="text-2xl font-bold text-white mb-3 tracking-wide group-hover:text-cyan-400 transition-colors">
                Launch Game Screen
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Open this on your desktop, laptop, or smart TV. It will display the arcade screen, generate a room code, and show a join QR code.
              </p>
            </div>
            
            <div className="flex items-center text-cyan-400 font-semibold text-sm group-hover:translate-x-1.5 transition-transform">
              Start Server & Game &rarr;
            </div>
          </Link>

          {/* Option 2: Mobile Remote */}
          <Link
            href="/controller"
            className={`group relative flex flex-col justify-between p-8 rounded-2xl border transition-all duration-300 ${
              isMobile
                ? 'bg-gradient-to-br from-[#1e0729] to-[#050114] border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.15)] ring-2 ring-pink-500/20'
                : 'bg-[#0b071e]/50 border-zinc-800/80 hover:border-pink-500/30'
            }`}
          >
            <div>
              {/* Highlight badge for recommended option */}
              {isMobile && (
                <span className="absolute top-4 right-4 bg-pink-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Recommended for Phone
                </span>
              )}

              <div className="w-12 h-12 rounded-xl bg-pink-950/80 border border-pink-700/50 flex items-center justify-center text-pink-400 text-2xl font-bold mb-6 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                📱
              </div>
              <h2 className="text-2xl font-bold text-white mb-3 tracking-wide group-hover:text-pink-400 transition-colors">
                Mobile Controller
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Open this on your phone to connect and steer. Features a glassmorphic analog touch joystick, haptic rumble on hit, and live vitals.
              </p>
            </div>

            <div className="flex items-center text-pink-400 font-semibold text-sm group-hover:translate-x-1.5 transition-transform">
              Join Arcade Room &rarr;
            </div>
          </Link>

        </div>

        {/* Footer Instructions */}
        <div className="mt-16 text-center text-xs text-zinc-500">
          <p>Both devices must be connected to the same Wi-Fi network.</p>
          <p className="mt-1">Powered by React, Web Audio Synthesizers, and HTML5 WebSockets.</p>
        </div>

      </div>
    </div>
  );
}
