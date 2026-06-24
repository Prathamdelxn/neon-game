'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ControllerContent() {
  const searchParams = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

  const [roomId, setRoomId] = useState('');
  const [paired, setPaired] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  // Custom states for orientation and sync lock
  const [synced, setSynced] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Game stats synced in real-time
  const [stats, setStats] = useState({
    health: 100,
    shield: 100,
    score: 0,
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const socketRef = useRef(null);
  const joystickBaseRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const touchIdRef = useRef(null);

  // Trigger mobile vibration safely
  const vibrate = (pattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (pattern === 'hurt') {
        navigator.vibrate([150, 70, 150]);
      } else if (pattern === 'fire') {
        navigator.vibrate([12]);
      } else if (pattern === 'powerup') {
        navigator.vibrate([40, 40, 80]);
      } else if (pattern === 'paired') {
        navigator.vibrate([100, 50, 100, 50, 150]);
      } else if (pattern === 'tap') {
        navigator.vibrate([8]);
      }
    }
  };

  // Check orientation dynamically
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setIsFullscreen(!!document.fullscreenElement);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, []);

  const connectToGame = (codeToJoin) => {
    if (!codeToJoin) return;
    
    setConnecting(true);
    setError(null);

    const nextPublicWsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_WS_SERVER;
    const host = window.location.hostname;
    let wsUrl = nextPublicWsUrl || `ws://${host}:3001`;
    
    // Auto-sanitize protocols if http/https is specified
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    }
    
    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', roomId: codeToJoin }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'paired':
          setPaired(true);
          setConnecting(false);
          setIsGameOver(false);
          vibrate('paired');
          break;

        case 'status':
          setStats({
            health: msg.health ?? 100,
            shield: msg.shield ?? 100,
            score: msg.score ?? 0,
          });
          break;

        case 'vibrate':
          vibrate(msg.pattern);
          break;

        case 'gameover':
          setIsGameOver(true);
          setFinalScore(msg.finalScore || 0);
          vibrate('hurt');
          break;

        case 'host_disconnected':
          setPaired(false);
          setSynced(false);
          setIsGameOver(false);
          setError('Arcade screen disconnected. Go back and relaunch.');
          break;

        case 'error':
          setError(msg.message);
          setConnecting(false);
          if (socketRef.current) {
            socketRef.current.close();
          }
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      setError('Connection failed. Make sure the arcade screen is active.');
      setConnecting(false);
    };

    ws.onclose = () => {
      setPaired(false);
      setConnecting(false);
    };
  };

  // Auto connect if room param is in URL
  useEffect(() => {
    if (initialRoom) {
      setRoomId(initialRoom);
      connectToGame(initialRoom);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [initialRoom]);

  // Keypad Tap Handler
  const handleKeyTap = (key) => {
    if (connecting) return;
    vibrate('tap');
    setError(null);

    if (key === 'CLEAR') {
      setRoomId('');
    } else if (key === 'BACK') {
      setRoomId((prev) => prev.slice(0, -1));
    } else {
      if (roomId.length < 4) {
        const nextRoom = roomId + key;
        setRoomId(nextRoom);
        if (nextRoom.length === 4) {
          connectToGame(nextRoom);
        }
      }
    }
  };

  // Trigger Fullscreen & Orientation lock
  const engageGamepad = async () => {
    vibrate('tap');
    try {
      const docEl = document.documentElement;
      
      // Request Fullscreen
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
      
      // Lock orientation to Landscape
      if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
        await window.screen.orientation.lock('landscape').catch((e) => {
          console.warn('Orientation locking rejected by device settings:', e);
        });
      }
    } catch (err) {
      console.warn('Fullscreen/Orientation request failed:', err);
    }
    setSynced(true);
  };

  // Joystick touch events
  const handleJoystickStart = (e) => {
    if (!paired || isGameOver) return;
    const touch = e.touches[0];
    touchIdRef.current = touch.identifier;
    updateJoystickPos(touch);
  };

  const handleJoystickMove = (e) => {
    if (!paired || isGameOver || touchIdRef.current === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) {
        updateJoystickPos(e.touches[i]);
        break;
      }
    }
  };

  const handleJoystickEnd = () => {
    touchIdRef.current = null;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(-50%, -50%)';
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'joystick', x: 0, y: 0 }));
    }
  };

  const updateJoystickPos = (touch) => {
    const base = joystickBaseRef.current;
    const knob = joystickKnobRef.current;
    if (!base || !knob) return;

    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const maxRadius = rect.width / 2 - 8; 
    let finalX = dx;
    let finalY = dy;

    if (dist > maxRadius) {
      finalX = (dx / dist) * maxRadius;
      finalY = (dy / dist) * maxRadius;
    }

    knob.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`;

    const normX = finalX / maxRadius;
    const normY = finalY / maxRadius;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'joystick', x: normX, y: normY }));
    }
  };

  // Button Action Triggers
  const sendButtonPress = (actionName, isPressed) => {
    if (!paired || isGameOver) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: actionName, pressed: isPressed }));
    }
    if (isPressed) {
      vibrate('fire');
    }
  };

  const triggerRestart = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'restart' }));
    }
  };

  // Toggle browser fullscreen and lock orientation
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        // Force landscape orientation lock on maximize
        if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
          await window.screen.orientation.lock('landscape').catch((e) => {
            console.warn('Orientation lock failed on manual toggle:', e);
          });
        }
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Manual exit fullscreen
  const exitControllerFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => console.warn(err));
    }
  };

  // Listen to fullscreen changes (e.g. user exits using browser UI)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Lock scrolling, refresh, and double-taps on mobile
  useEffect(() => {
    const preventDefault = (e) => {
      if (paired && synced) e.preventDefault();
    };
    document.body.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      document.body.removeEventListener('touchmove', preventDefault);
    };
  }, [paired, synced]);

  const getJoystickGlowClass = () => {
    if (stats.health <= 35) {
      return 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse';
    }
    if (stats.shield > 0) {
      return 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)]';
    }
    return 'border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.25)]';
  };

  // VIEW 1: Connect / Keypad Pairing (Held in portrait usually)
  if (!paired) {
    return (
      <div className="fixed inset-0 bg-[#050114] text-white flex flex-col items-center justify-between p-6 font-sans select-none overflow-hidden touch-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(236,72,153,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(236,72,153,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
        
        <header className="w-full text-center py-4 z-10">
          <h2 className="text-sm font-semibold tracking-[0.25em] text-pink-500 uppercase filter drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]">
            NEON SPARK
          </h2>
          <div className="text-[10px] text-zinc-500 tracking-wider uppercase mt-1">MOBILE CONTROLLER PORTAL</div>
        </header>

        <div className="w-full max-w-xs flex flex-col items-center z-10 my-auto">
          <div className="w-full bg-black/60 backdrop-blur-md border border-zinc-800/80 px-6 py-5 rounded-2xl shadow-inner mb-6 text-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">
              ENTER SYSTEM CODE
            </span>
            <div className="h-12 flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => {
                const char = roomId[idx] || '';
                return (
                  <span 
                    key={idx} 
                    className={`w-9 h-11 flex items-center justify-center font-mono text-2xl font-black rounded-lg border transition-all ${
                      char 
                        ? 'border-pink-500 text-pink-400 bg-pink-950/20 shadow-[0_0_10px_rgba(236,72,153,0.25)]' 
                        : 'border-zinc-800 text-zinc-700 bg-[#0d0722]/50'
                    }`}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
            {error ? (
              <span className="text-[10px] text-red-500 block mt-3 font-semibold bg-red-950/20 py-1 border border-red-900/30 rounded-lg">
                ⚠️ {error}
              </span>
            ) : connecting ? (
              <span className="text-[10px] text-cyan-400 animate-pulse block mt-3 font-bold">
                CONNECTING PROTOCOLS...
              </span>
            ) : (
              <span className="text-[9px] text-zinc-500 block mt-3">
                Scan QR or enter pairing room credentials
              </span>
            )}
          </div>

          <div className="w-full grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyTap(num.toString())}
                disabled={connecting}
                className="h-14 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-lg font-bold hover:bg-zinc-900 active:bg-pink-950/30 active:border-pink-500/50 transition-all text-zinc-200 active:scale-95 cursor-pointer flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleKeyTap('CLEAR')}
              disabled={connecting}
              className="h-14 rounded-xl bg-zinc-950/40 border border-zinc-800/40 text-xs font-semibold text-zinc-500 active:bg-red-950/20 active:border-red-900/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              CLEAR
            </button>
            <button
              onClick={() => handleKeyTap('0')}
              disabled={connecting}
              className="h-14 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-lg font-bold hover:bg-zinc-900 active:bg-pink-950/30 active:border-pink-500/50 transition-all text-zinc-200 active:scale-95 cursor-pointer flex items-center justify-center"
            >
              0
            </button>
            <button
              onClick={() => handleKeyTap('BACK')}
              disabled={connecting}
              className="h-14 rounded-xl bg-zinc-950/40 border border-zinc-800/40 text-xs font-semibold text-zinc-500 active:bg-zinc-900 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              DEL
            </button>
          </div>
        </div>

        <footer className="w-full text-center text-[10px] text-zinc-600 py-3">
          Verifying code handshake in real time
        </footer>
      </div>
    );
  }

  // VIEW 2: Paired but waiting for Fullscreen Sync Tap gesture
  if (!synced) {
    return (
      <div className="fixed inset-0 bg-[#050114] text-white flex flex-col items-center justify-center p-6 font-sans select-none overflow-hidden touch-none text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        
        <div className="z-10 max-w-xs p-6 bg-zinc-950/80 rounded-3xl border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-3xl mb-6 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse">
            🛸
          </div>
          
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            LINK CONFIRMED
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed mt-2 mb-6">
            Pairing completed. Tap below to launch full screen console and steer.
          </p>

          <button
            onClick={engageGamepad}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-95 text-white font-bold tracking-widest uppercase rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)]"
          >
            Engage Controls
          </button>
        </div>
      </div>
    );
  }

  // VIEW 3: Synced but held vertically - Rotate Reminder Sentinal (iOS Safari fallback)
  if (!isLandscape) {
    return (
      <div className="fixed inset-0 bg-[#04010d] text-white flex flex-col items-center justify-center p-6 font-sans select-none overflow-hidden touch-none text-center">
        {/* Glowing stars */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="flex flex-col items-center gap-6">
          {/* Animated SVG Phone Rotation */}
          <svg 
            className="w-20 h-20 text-pink-500 filter drop-shadow-[0_0_10px_rgba(236,72,153,0.4)] animate-[spin_3s_linear_infinite]" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 15h12M6 6h12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5l3-3m0 0l3 3m-3-3v12" className="animate-pulse" />
          </svg>
          
          <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent uppercase tracking-wider">
            Rotate Your Device
          </h2>
          <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
            Please turn your smartphone horizontally (Landscape primary) to load the analog pilot controls.
          </p>

          <button
            onClick={engageGamepad}
            className="px-4 py-2 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white rounded-lg"
          >
            Force Sync Fullscreen
          </button>
        </div>
      </div>
    );
  }

  // VIEW 4: Synced & Held horizontally - Perfect Landscape Console Gamepad UI
  return (
    <div className="fixed inset-0 w-full h-full bg-[#04010e] text-white overflow-hidden touch-none select-none">
      
      {/* Background starlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Floating Center HUD Vitals */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-64 sm:w-80 bg-zinc-950/65 backdrop-blur-md px-4 py-2 border border-zinc-800/40 rounded-xl z-20 shadow-lg flex flex-col gap-1.5 select-none pointer-events-none">
        
        {/* Score & Room Code details */}
        <div className="flex justify-between items-center text-[8px] font-black text-zinc-500 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <span>Score:</span>
            <span className="text-amber-400 text-xs font-black">{stats.score.toLocaleString()}</span>
          </div>
          <span className="text-cyan-400 font-bold">Room: {roomId}</span>
        </div>

        {/* HUD Sliders */}
        <div className="flex gap-3">
          {/* Shields slider */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between text-[7px] font-black text-zinc-400">
              <span>SHIELD</span>
              <span className="text-cyan-400 font-bold">{Math.round(stats.shield)}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden mt-0.5 border border-zinc-800">
              <div 
                className="h-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)] transition-all duration-150"
                style={{ width: `${stats.shield}%` }}
              />
            </div>
          </div>

          {/* Hull slider */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between text-[7px] font-black text-zinc-400">
              <span>HULL</span>
              <span className={stats.health > 35 ? 'text-pink-400' : 'text-red-500 animate-pulse'}>
                {Math.round(stats.health)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden mt-0.5 border border-zinc-800">
              <div 
                className={`h-full transition-all duration-150 ${
                  stats.health > 35 
                    ? 'bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.7)]' 
                    : 'bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.9)] animate-pulse'
                }`}
                style={{ width: `${stats.health}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Left: exit fullscreen trigger */}
      <div className="absolute top-3 left-4 z-20">
        <button
          onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); }}
          className="px-2.5 py-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white"
        >
          Exit Screen
        </button>
      </div>

      {/* Top Right: maximize toggle fullscreen and rotate */}
      <div className="absolute top-3 right-4 z-20">
        <button
          onClick={toggleFullscreen}
          className="px-2.5 py-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 text-[9px] uppercase tracking-wider text-cyan-400 hover:text-white"
        >
          {isFullscreen ? '📺 Minimize' : '📱 Maximize'}
        </button>
      </div>

      {/* LEFT SIDE: Absolute Anchored Joystick (moved closer to edge/bottom for max thumb comfort and gap) */}
      <div 
        ref={joystickBaseRef}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
        className={`absolute left-5 bottom-5 w-32 h-32 sm:w-38 sm:h-38 rounded-full bg-[#07031c]/70 border-2 shadow-inner flex items-center justify-center cursor-pointer select-none touch-none transition-all duration-300 z-10 ${getJoystickGlowClass()}`}
      >
        {/* Base Crosshairs */}
        <div className="absolute inset-x-0 h-px bg-zinc-900/50 pointer-events-none" />
        <div className="absolute inset-y-0 w-px bg-zinc-900/50 pointer-events-none" />
        <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-dashed border-zinc-900/40 pointer-events-none" />

        {/* Floating Knob */}
        <div 
          ref={joystickKnobRef}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 border border-white/20 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(6,182,212,0.4)] pointer-events-none z-10 transition-transform duration-75"
        >
          {/* Center Indentation */}
          <div className="w-6 h-6 rounded-full bg-black/15 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/5 shadow-inner" />
        </div>
      </div>

      {/* RIGHT SIDE: Separated action buttons anchored directly for maximum screen gap */}
      
      {/* Boost Button: Shifted up and left diagonally from the fire button */}
      <button
        onTouchStart={() => sendButtonPress('boost', true)}
        onTouchEnd={() => sendButtonPress('boost', false)}
        onTouchCancel={() => sendButtonPress('boost', false)}
        onMouseDown={() => sendButtonPress('boost', true)}
        onMouseUp={() => sendButtonPress('boost', false)}
        onMouseLeave={() => sendButtonPress('boost', false)}
        className="absolute right-24 bottom-16 sm:right-28 sm:bottom-20 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0a172c]/95 border-2 border-cyan-500 text-cyan-400 text-lg shadow-[0_0_15px_rgba(6,182,212,0.2)] flex flex-col items-center justify-center select-none active:bg-cyan-500 active:text-black active:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all cursor-pointer touch-none z-10"
      >
        🚀
        <span className="text-[7px] font-black uppercase tracking-wider mt-0.5">BOOST</span>
      </button>

      {/* Fire Trigger: Anchored right next to the right-bottom corner */}
      <button
        onTouchStart={() => sendButtonPress('fire', true)}
        onTouchEnd={() => sendButtonPress('fire', false)}
        onTouchCancel={() => sendButtonPress('fire', false)}
        onMouseDown={() => sendButtonPress('fire', true)}
        onMouseUp={() => sendButtonPress('fire', false)}
        onMouseLeave={() => sendButtonPress('fire', false)}
        className="absolute right-5 bottom-5 w-18 h-18 sm:w-22 sm:h-22 rounded-full bg-[#24061a]/95 border-2 border-pink-500 text-pink-400 text-xl shadow-[0_0_20px_rgba(236,72,153,0.25)] flex flex-col items-center justify-center select-none active:bg-pink-500 active:text-black active:shadow-[0_0_30px_rgba(236,72,153,0.6)] transition-all cursor-pointer touch-none z-10"
      >
        🔥
        <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">FIRE</span>
      </button>

      {/* Synchronized Game Over Fullscreen Overlay */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/95 z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="text-4xl mb-3 animate-bounce">💥</div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 mb-2">
            VESSEL DESTROYED
          </h2>
          <p className="text-zinc-400 text-[10px] mb-4 max-w-xs">
            Simulation concluded. Trigger ship respawn.
          </p>

          <div className="bg-[#12041a] px-6 py-2 border border-pink-500/20 rounded-2xl mb-6">
            <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Final Score</span>
            <div className="text-xl font-black text-amber-400">{finalScore.toLocaleString()}</div>
          </div>

          <button
            onClick={triggerRestart}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 active:scale-95 font-bold uppercase rounded-xl tracking-widest text-[10px] transition-all shadow-[0_0_15px_rgba(236,72,153,0.35)] cursor-pointer"
          >
            Restart Game
          </button>
        </div>
      )}

      {/* Sleek bottom alignment bar */}
      <footer className="absolute bottom-2 left-1/2 -translate-x-1/2 text-zinc-700 text-[7px] tracking-wider uppercase pointer-events-none">
        Console Synced • Touch Hold Pilot controls
      </footer>

    </div>
  );
}

export default function ControllerPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#050114] text-white flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-pink-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Syncing Controller Protocols...</p>
        </div>
      </div>
    }>
      <ControllerContent />
    </Suspense>
  );
}
