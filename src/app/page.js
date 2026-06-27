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

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white overflow-x-hidden font-sans select-none flex flex-col">
      {/* Background Cyber-Dark Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-950/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-zinc-900/10 blur-[150px] pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      {/* 1. HEADER SECTION */}
      <header className="sticky top-0 z-50 w-full bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-900/80 py-4 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <Link href="/" className="text-base md:text-lg font-black tracking-widest bg-gradient-to-r from-zinc-100 to-cyan-400 bg-clip-text text-transparent filter drop-shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            NEON SPARK ARCADE
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-zinc-400">
          <Link href="/game" className="hover:text-cyan-400 transition-colors">
            Game Catalog
          </Link>
          <Link href="/controller" className="hover:text-cyan-400 transition-colors">
            Pair Controller
          </Link>
          <button onClick={() => scrollToSection('setup')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            How It Works
          </button>
          <button onClick={() => scrollToSection('features')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            Console Specs
          </button>
        </nav>

        {/* Quick Play CTA */}
        <Link
          href="/game"
          className="px-4 py-2 border border-cyan-500/40 hover:border-cyan-400 text-cyan-400 hover:bg-cyan-950/20 active:scale-95 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)]"
        >
          Get Started
        </Link>
      </header>

      {/* 2. HERO AREA (LEFT-RIGHT SPLIT) */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-6 md:px-12 py-16 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-50" />

        <div className="max-w-6xl w-full grid md:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Heading and CTAs */}
          <div className="md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left gap-6 animate-fade-in">
            <div className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest text-cyan-400 uppercase bg-cyan-950/20 border border-cyan-800/40 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.05)]">
              🚀 Best Remote Multiplayer Game
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent filter drop-shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              PLAY FREE MULTIPLAYER GAME
            </h1>
            <h2 className="text-2xl mt-2 text-cyan-400 font-bold uppercase tracking-widest drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
              ON NEON SPARK ARCADE
            </h2>
            
            <p className="text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed">
              Looking for a <strong>free remote game</strong> to play? Steer space cruisers and battle tanks on the big screen using your phone as a flight stick. Enjoy this ultimate <strong>free multiplayer game</strong> instantly with your friends. Sync your phone controller, fire lasers, and conquer missions at no cost!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4 z-20">
              <Link
                href="/game"
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-zinc-950 font-black uppercase tracking-widest rounded-xl text-sm transition-all shadow-[0_0_25px_rgba(6,182,212,0.25)] text-center cursor-pointer"
              >
                GET STARTED &rarr;
              </Link>
              
              <Link
                href="/controller"
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 hover:text-cyan-400 text-zinc-300 font-bold uppercase tracking-widest rounded-xl text-sm transition-all text-center cursor-pointer"
              >
                Pair Phone Controller
              </Link>
            </div>
          </div>

          {/* Right Column: Game Image Showcase */}
          <div className="md:col-span-5 grid grid-cols-2 gap-4 relative animate-fade-in z-10">
            {/* Background Glow under images */}
            <div className="absolute inset-0 bg-cyan-500/5 blur-[60px] pointer-events-none rounded-full" />
            
            {/* Game 1 Image Card */}
            <Link 
              href="/game"
              className="group relative flex flex-col rounded-2xl border border-zinc-800/80 hover:border-cyan-500/40 bg-zinc-900/20 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] cursor-pointer"
            >
              <div className="aspect-[3/4] relative w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/neon_shift_cover.png" 
                  alt="Neon Shift Space Shooter" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
              </div>
              <div className="p-4 absolute bottom-0 left-0 right-0">
                <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800">Space Shooter</span>
                <h3 className="text-sm font-black text-white tracking-wide mt-2 group-hover:text-cyan-400 transition-colors">NEON SHIFT</h3>
              </div>
            </Link>

            {/* Game 2 Image Card */}
            <Link 
              href="/game"
              className="group relative flex flex-col rounded-2xl border border-zinc-800/80 hover:border-cyan-500/40 bg-zinc-900/20 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] mt-6 md:mt-12 cursor-pointer"
            >
              <div className="aspect-[3/4] relative w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/grid_defender_cover.png" 
                  alt="Grid Defender Tank Battle" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
              </div>
              <div className="p-4 absolute bottom-0 left-0 right-0">
                <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800">Tank Arena</span>
                <h3 className="text-sm font-black text-white tracking-wide mt-2 group-hover:text-cyan-400 transition-colors">GRID DEFENDER</h3>
              </div>
            </Link>

          </div>

        </div>
      </section>

      {/* 3. HOW IT WORKS / PAIRING STEPS */}
      <section id="setup" className="w-full bg-[#0c0c0e]/60 border-t border-zinc-900/80 py-20 z-10">
        <div className="max-w-5xl mx-auto px-6">
          
          <div className="text-center mb-16">
            <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.25em] mb-2">SETUP PROTOCOLS</div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-wide">PLAY THIS FREE GAME IN 3 STEPS</h2>
            <div className="w-12 h-1 bg-cyan-500 mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            {/* Step 1 */}
            <div className="flex flex-col items-center p-6 bg-zinc-900/20 border border-zinc-800/80 rounded-2xl">
              <span className="w-10 h-10 rounded-full bg-cyan-950/30 border border-cyan-800/60 text-cyan-400 font-black flex items-center justify-center mb-6 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                1
              </span>
              <h4 className="text-lg font-bold text-white mb-2">Host Arcade</h4>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Launch the **Game Screen** on a desktop, TV, or laptop browser. Choose your game and open the lobby to generate a unique room code.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center p-6 bg-zinc-900/20 border border-zinc-800/80 rounded-2xl">
              <span className="w-10 h-10 rounded-full bg-cyan-950/30 border border-cyan-800/60 text-cyan-400 font-black flex items-center justify-center mb-6 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                2
              </span>
              <h4 className="text-lg font-bold text-white mb-2">Sync Controller</h4>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Scan the on-screen QR code or go to the manual link on your phone. Enter the code to sync your mobile browser as a pilot console.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center p-6 bg-zinc-900/20 border border-zinc-800/80 rounded-2xl">
              <span className="w-10 h-10 rounded-full bg-cyan-950/30 border border-cyan-800/60 text-cyan-400 font-black flex items-center justify-center mb-6 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                3
              </span>
              <h4 className="text-lg font-bold text-white mb-2">Launch Mission</h4>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Hold your phone in landscape layout. Glide the joystick to steer, tap Fire to blast targets, and cooperate with up to 4 squad members!
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. CONSOLE SPECIFICATIONS / TECHNICAL Highlights */}
      <section id="features" className="w-full max-w-5xl mx-auto px-6 py-20 border-t border-zinc-900/80 z-10">
        <div className="text-center mb-16">
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.25em] mb-2">CONSOLE SPECIFICATIONS</div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-wide">SYSTEM HARDWARE HIGHLIGHTS</h2>
          <div className="w-12 h-1 bg-cyan-500 mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="p-5 rounded-2xl bg-zinc-900/20 border border-zinc-800/80 text-center flex flex-col items-center">
            <div className="text-2xl mb-3">⚡</div>
            <h5 className="text-sm font-bold text-white mb-1">Ultra-Low Latency</h5>
            <p className="text-zinc-500 text-[10px] leading-relaxed">
              Powered by raw WebSocket tunnels for sub-50ms controller joystick tracking.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-5 rounded-2xl bg-zinc-900/20 border border-zinc-800/80 text-center flex flex-col items-center">
            <div className="text-2xl mb-3">🔊</div>
            <h5 className="text-sm font-bold text-white mb-1">Web Synth Audio</h5>
            <p className="text-zinc-500 text-[10px] leading-relaxed">
              Synthesized sound effects generated live using standard Web Audio oscillator gates.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-5 rounded-2xl bg-zinc-900/20 border border-zinc-800/80 text-center flex flex-col items-center">
            <div className="text-2xl mb-3">📳</div>
            <h5 className="text-sm font-bold text-cyan-400 mb-1">Haptic Rumble</h5>
            <p className="text-zinc-500 text-[10px] leading-relaxed">
              Vibration patterns triggered on mobile controllers during hit and fire impulses.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-5 rounded-2xl bg-zinc-900/20 border border-zinc-800/80 text-center flex flex-col items-center">
            <div className="text-2xl mb-3">👥</div>
            <h5 className="text-sm font-bold text-white mb-1">4-Player Squadron</h5>
            <p className="text-zinc-500 text-[10px] leading-relaxed">
              Connect up to 4 mobile flight sticks simultaneously for local cooperative squads.
            </p>
          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="w-full bg-[#060608] border-t border-zinc-900/80 py-16 px-6 md:px-12 text-zinc-400 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col gap-12">
          
          {/* Top detailed grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Column 1: Logo and details */}
            <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-white">
                <span>✨</span> NEON SPARK ARCADE
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                A real-time, multi-screen cooperative browser game platform. Turn your smartphone into a tactical console flight stick.
              </p>
              <div className="flex gap-3 text-xs mt-2 text-zinc-500">
                <Link href="/" className="hover:text-cyan-400 cursor-pointer transition-colors">👾 Discord</Link>
                <Link href="/" className="hover:text-cyan-400 cursor-pointer transition-colors">🐙 GitHub</Link>
                <Link href="/" className="hover:text-cyan-400 cursor-pointer transition-colors">🐦 Twitter</Link>
              </div>
            </div>

            {/* Column 2: Game Catalogue */}
            <div className="flex flex-col gap-3 text-xs">
              <span className="font-extrabold uppercase tracking-widest text-zinc-200">Programs</span>
              <Link href="/game" className="hover:text-cyan-400 transition-colors text-left cursor-pointer">NEON SHIFT Space Shooter</Link>
              <Link href="/game" className="hover:text-cyan-400 transition-colors text-left cursor-pointer">GRID DEFENDER Tank Battle</Link>
              <Link href="/game" className="hover:text-cyan-400 transition-colors text-left cursor-pointer">Arcade Setup Dashboard</Link>
              <Link href="/controller" className="hover:text-cyan-400 transition-colors">Join Active Room</Link>
            </div>

            {/* Column 3: Setup Protocols */}
            <div className="flex flex-col gap-3 text-xs">
              <span className="font-extrabold uppercase tracking-widest text-zinc-200">Protocols</span>
              <button onClick={() => scrollToSection('setup')} className="hover:text-cyan-400 transition-colors text-left cursor-pointer">1. Start Big Screen Host</button>
              <button onClick={() => scrollToSection('setup')} className="hover:text-cyan-400 transition-colors text-left cursor-pointer">2. Scan Pairing QR Code</button>
              <button onClick={() => scrollToSection('setup')} className="hover:text-cyan-400 transition-colors text-left cursor-pointer">3. Sync Landscape Layout</button>
              <button onClick={() => scrollToSection('features')} className="hover:text-cyan-400 transition-colors text-left cursor-pointer">Connection Diagnostics</button>
            </div>

            {/* Column 4: Architecture Tech */}
            <div className="flex flex-col gap-3 text-xs">
              <span className="font-extrabold uppercase tracking-widest text-zinc-200">System Specs</span>
              <span className="text-zinc-500">⚡ WebSocket Tunneling (&lt;50ms)</span>
              <span className="text-zinc-500">🔊 Web Audio Oscillator Synthesis</span>
              <span className="text-zinc-500">📳 Mobile Haptics API Engine</span>
              <span className="text-zinc-500">👥 4-Player Local Squad Sync</span>
            </div>
          </div>

          <div className="border-t border-zinc-900/80 my-2" />

          {/* Bottom Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] text-zinc-600">
            <p className="max-w-md text-center md:text-left leading-relaxed">
              Desktop screen handles the 2D canvas simulation. Mobile browser relays coordinates over secure WebSocket ports. Both screens must be active.
            </p>
            <div className="flex gap-4">
              <Link href="/" className="hover:text-zinc-500 cursor-pointer transition-colors">Terms of Operation</Link>
              <Link href="/" className="hover:text-zinc-500 cursor-pointer transition-colors">Security Protocol</Link>
            </div>
            <p className="text-zinc-700 font-mono">
              &copy; 2026 Neon Spark Arcade. All systems nominal.
            </p>
          </div>

        </div>
      </footer>
    </div>
  );
}
