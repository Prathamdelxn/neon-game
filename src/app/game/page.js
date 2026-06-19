'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function GamePage() {
  const [roomId, setRoomId] = useState(null);
  const [ipAddress, setIpAddress] = useState('127.0.0.1');
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameState, setGameState] = useState('pairing'); // pairing, playing, gameover
  const [score, setScore] = useState(0);
  
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  
  // Game loop and variables references to avoid react stale state in requestAnimationFrame
  const gameRef = useRef({
    status: 'pairing',
    score: 0,
    health: 100,
    shield: 100,
    ship: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 18,
      boostActive: false,
      lastFired: 0,
      invulnerable: 0,
    },
    joystick: { x: 0, y: 0 },
    isFiring: false,
    lasers: [],
    asteroids: [],
    particles: [],
    powerups: [],
    spawnTimer: 0,
    powerupTimer: 0,
  });

  // Sound synthesis utility
  const playSynthSound = (type) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const now = ctx.currentTime;
      
      if (type === 'laser') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'explosion') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.4);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        
        // Add a bandpass filter to make it rumble
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 100;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'powerup') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.15);
        osc.frequency.linearRampToValueAtTime(900, now + 0.3);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.setValueAtTime(50, now + 0.08);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  };

  // Fetch server IP and connect WebSockets
  useEffect(() => {
    const initConnection = async () => {
      try {
        const res = await fetch('/api/ip');
        const data = await res.json();
        setIpAddress(data.ip);

        // Connect to WebSocket Server on port 3001
        const wsUrl = `ws://${data.ip}:3001`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'host' }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          
          switch (msg.type) {
            case 'room_created':
              setRoomId(msg.roomId);
              break;
              
            case 'paired':
              setPaired(true);
              setGameState('playing');
              gameRef.current.status = 'playing';
              gameRef.current.health = 100;
              gameRef.current.shield = 100;
              gameRef.current.score = 0;
              setScore(0);
              // Trigger vibration to signal mobile paired successfully
              sendToController({ type: 'vibrate', pattern: 'paired' });
              // Initialize Audio Context on first interaction/pairing
              if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
              }
              break;

            case 'guest_disconnected':
              setPaired(false);
              setGameState('pairing');
              gameRef.current.status = 'pairing';
              break;

            case 'joystick':
              // Store latest inputs from controller
              gameRef.current.joystick.x = msg.x || 0;
              gameRef.current.joystick.y = msg.y || 0;
              break;

            case 'fire':
              gameRef.current.isFiring = msg.pressed;
              break;

            case 'boost':
              gameRef.current.ship.boostActive = msg.pressed;
              break;

            case 'restart':
              if (gameRef.current.status === 'gameover') {
                restartGame();
              }
              break;

            default:
              break;
          }
        };

        ws.onerror = (e) => {
          setError('Could not connect to WebSocket server. Make sure "npm run dev" and WebSocket servers are running.');
        };

        ws.onclose = () => {
          setError('WebSocket server disconnected.');
        };
      } catch (err) {
        setError('Failed to fetch host IP address.');
      }
    };

    initConnection();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const sendToController = (data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  };

  const restartGame = () => {
    const game = gameRef.current;
    game.status = 'playing';
    game.health = 100;
    game.shield = 100;
    game.score = 0;
    game.asteroids = [];
    game.lasers = [];
    game.particles = [];
    game.powerups = [];
    game.ship.x = canvasRef.current ? canvasRef.current.width / 2 : 0;
    game.ship.y = canvasRef.current ? canvasRef.current.height / 2 : 0;
    game.ship.vx = 0;
    game.ship.vy = 0;
    game.ship.invulnerable = 60; // 1s invulnerability
    setScore(0);
    setGameState('playing');
    sendToController({ type: 'status', health: 100, score: 0, shield: 100 });
    sendToController({ type: 'vibrate', pattern: 'paired' });
  };

  // Canvas Game Loops
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set fixed viewport bounds
    canvas.width = 1024;
    canvas.height = 576;

    // Set initial ship position
    gameRef.current.ship.x = canvas.width / 2;
    gameRef.current.ship.y = canvas.height / 2;

    let animationFrameId;

    // Helper functions for drawing
    const drawSpaceBackground = () => {
      // Dark nebula backdrop
      ctx.fillStyle = '#050114';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Grid pattern
      ctx.strokeStyle = 'rgba(64, 56, 110, 0.15)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    const spawnExplosion = (x, y, color, count = 15, baseSpeed = 3) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.5 + Math.random() * 0.8) * baseSpeed;
        gameRef.current.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: Math.random() * 3 + 1,
          alpha: 1,
          life: 0,
          maxLife: 20 + Math.random() * 20,
        });
      }
      playSynthSound('explosion');
    };

    const updateGame = () => {
      const game = gameRef.current;
      if (game.status !== 'playing') return;

      const ship = game.ship;

      // 1. Update Ship Physics
      const drag = 0.97;
      const acceleration = ship.boostActive ? 0.35 : 0.18;
      const maxSpeed = ship.boostActive ? 8 : 4.5;

      // Accelerate via joystick values
      ship.vx += game.joystick.x * acceleration;
      ship.vy += game.joystick.y * acceleration;

      // Apply drag
      ship.vx *= drag;
      ship.vy *= drag;

      // Cap speed
      const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (speed > maxSpeed) {
        ship.vx = (ship.vx / speed) * maxSpeed;
        ship.vy = (ship.vy / speed) * maxSpeed;
      }

      // Update positions
      ship.x += ship.vx;
      ship.y += ship.vy;

      // Invulnerability tick
      if (ship.invulnerable > 0) ship.invulnerable--;

      // Screen edge wrapping
      if (ship.x < 0) ship.x = canvas.width;
      if (ship.x > canvas.width) ship.x = 0;
      if (ship.y < 0) ship.y = canvas.height;
      if (ship.y > canvas.height) ship.y = 0;

      // Update angle based on velocity or joystick direction
      if (game.joystick.x !== 0 || game.joystick.y !== 0) {
        ship.angle = Math.atan2(game.joystick.y, game.joystick.x);
      }

      // Spawn propulsion exhaust particles
      if (Math.abs(game.joystick.x) > 0.1 || Math.abs(game.joystick.y) > 0.1 || ship.boostActive) {
        const oppositeAngle = ship.angle + Math.PI + (Math.random() - 0.5) * 0.5;
        const particleSpeed = ship.boostActive ? 4 : 2;
        game.particles.push({
          x: ship.x - Math.cos(ship.angle) * ship.radius,
          y: ship.y - Math.sin(ship.angle) * ship.radius,
          vx: Math.cos(oppositeAngle) * particleSpeed + ship.vx * 0.5,
          vy: Math.sin(oppositeAngle) * particleSpeed + ship.vy * 0.5,
          color: ship.boostActive ? '#06b6d4' : '#a855f7',
          size: Math.random() * 3 + 1,
          alpha: 0.8,
          life: 0,
          maxLife: 15 + Math.random() * 10,
        });
      }

      // 2. Firing Lasers
      const now = Date.now();
      const fireInterval = 180; // cooldown ms
      if (game.isFiring && now - ship.lastFired > fireInterval) {
        // Play synthesizer fire sound
        playSynthSound('laser');
        
        const laserSpeed = 12;
        game.lasers.push({
          x: ship.x + Math.cos(ship.angle) * ship.radius,
          y: ship.y + Math.sin(ship.angle) * ship.radius,
          vx: Math.cos(ship.angle) * laserSpeed + ship.vx * 0.4,
          vy: Math.sin(ship.angle) * laserSpeed + ship.vy * 0.4,
          age: 0,
          color: '#ec4899', // pink laser
        });
        ship.lastFired = now;

        // Soft controller trigger vibration
        sendToController({ type: 'vibrate', pattern: 'fire' });
      }

      // Update Lasers
      game.lasers = game.lasers.filter((laser) => {
        laser.x += laser.vx;
        laser.y += laser.vy;
        laser.age++;
        return laser.x >= 0 && laser.x <= canvas.width && laser.y >= 0 && laser.y <= canvas.height && laser.age < 60;
      });

      // 3. Spawning Asteroids
      game.spawnTimer++;
      const baseSpawnInterval = Math.max(40, 100 - Math.floor(game.score / 200));
      if (game.spawnTimer > baseSpawnInterval) {
        game.spawnTimer = 0;
        
        // Spawn from a random boundary
        let x, y;
        if (Math.random() < 0.5) {
          x = Math.random() < 0.5 ? -30 : canvas.width + 30;
          y = Math.random() * canvas.height;
        } else {
          x = Math.random() * canvas.width;
          y = Math.random() < 0.5 ? -30 : canvas.height + 30;
        }

        const angleToCenter = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x) + (Math.random() - 0.5) * 0.5;
        const speed = 1.2 + Math.random() * 2;
        const size = Math.random() * 25 + 15; // Asteroid size

        game.asteroids.push({
          id: Date.now() + Math.random(),
          x,
          y,
          vx: Math.cos(angleToCenter) * speed,
          vy: Math.sin(angleToCenter) * speed,
          radius: size,
          health: Math.ceil(size / 10),
          maxHealth: Math.ceil(size / 10),
          rotation: Math.random() * Math.PI,
          rotationSpeed: (Math.random() - 0.5) * 0.03,
        });
      }

      // Update Asteroids
      game.asteroids.forEach((ast) => {
        ast.x += ast.vx;
        ast.y += ast.vy;
        ast.rotation += ast.rotationSpeed;
      });

      // Clean up out of bounds asteroids
      game.asteroids = game.asteroids.filter((ast) => {
        const pad = 100;
        return ast.x >= -pad && ast.x <= canvas.width + pad && ast.y >= -pad && ast.y <= canvas.height + pad;
      });

      // 4. Power-ups spawn logic
      game.powerupTimer++;
      if (game.powerupTimer > 600) { // every 10 seconds
        game.powerupTimer = 0;
        if (game.powerups.length < 2) {
          game.powerups.push({
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50,
            type: Math.random() < 0.6 ? 'shield' : 'boost', // shield repair or temporary boost
            radius: 12,
            pulse: 0,
          });
        }
      }

      // Update power-up pulse effects
      game.powerups.forEach(p => p.pulse += 0.05);

      // Power-up collisions with ship
      game.powerups = game.powerups.filter((pu) => {
        const dx = pu.x - ship.x;
        const dy = pu.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < ship.radius + pu.radius) {
          // Trigger powerup
          playSynthSound('powerup');
          if (pu.type === 'shield') {
            game.shield = Math.min(100, game.shield + 40);
          } else if (pu.type === 'boost') {
            game.score += 50;
            // Short visual flashing of score
            setScore(game.score);
          }
          sendToController({ type: 'status', health: game.health, score: game.score, shield: game.shield });
          sendToController({ type: 'vibrate', pattern: 'powerup' });
          return false;
        }
        return true;
      });

      // 5. Collision Detections
      // Lasers with Asteroids
      game.lasers = game.lasers.filter((laser) => {
        let hit = false;
        game.asteroids = game.asteroids.filter((ast) => {
          if (hit) return true; // keep asteroid if already hit by another laser

          const dx = laser.x - ast.x;
          const dy = laser.y - ast.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < ast.radius) {
            // Hit!
            hit = true;
            ast.health -= 1;
            spawnExplosion(laser.x, laser.y, '#f43f5e', 5, 1.5);
            
            if (ast.health <= 0) {
              // Destroyed!
              spawnExplosion(ast.x, ast.y, '#fbbf24', Math.floor(ast.radius / 1.5), 3);
              game.score += Math.floor(ast.radius);
              setScore(game.score);
              
              // Sync score to mobile controller
              sendToController({ type: 'status', health: game.health, score: game.score, shield: game.shield });
              return false; // remove asteroid
            }
            return true; // keep asteroid
          }
          return true; // keep asteroid
        });
        return !hit; // remove laser if hit
      });

      // Ship with Asteroids
      if (ship.invulnerable <= 0) {
        game.asteroids = game.asteroids.filter((ast) => {
          const dx = ship.x - ast.x;
          const dy = ship.y - ast.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < ship.radius + ast.radius) {
            // Explode the asteroid
            spawnExplosion(ast.x, ast.y, '#ef4444', 15, 3.5);
            playSynthSound('hit');

            // Apply damage
            const damage = Math.ceil(ast.radius / 2.5);
            if (game.shield > 0) {
              game.shield = Math.max(0, game.shield - damage * 1.5);
            } else {
              game.health = Math.max(0, game.health - damage);
            }

            // Sync stats to phone controller + trigger phone vibration
            sendToController({
              type: 'status',
              health: game.health,
              score: game.score,
              shield: game.shield
            });
            sendToController({ type: 'vibrate', pattern: 'hurt' });

            ship.invulnerable = 60; // 1 second immunity
            
            // Check for gameover
            if (game.health <= 0) {
              game.status = 'gameover';
              setGameState('gameover');
              spawnExplosion(ship.x, ship.y, '#e11d48', 40, 5); // Huge ship explosion
              sendToController({ type: 'gameover', finalScore: game.score });
            }
            return false; // remove asteroid
          }
          return true;
        });
      }

      // 6. Update Particles
      game.particles.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
        part.alpha = 1 - part.life / part.maxLife;
      });

      game.particles = game.particles.filter((part) => part.life < part.maxLife);
    };

    const drawGame = () => {
      const game = gameRef.current;
      const ship = game.ship;

      // Clear screen & draw grid
      drawSpaceBackground();

      // 1. Draw Powerups
      if (game.status === 'playing') {
        game.powerups.forEach((pu) => {
          const size = pu.radius + Math.sin(pu.pulse) * 2;
          ctx.beginPath();
          ctx.arc(pu.x, pu.y, size, 0, Math.PI * 2);
          ctx.shadowBlur = 15;
          
          if (pu.type === 'shield') {
            ctx.fillStyle = '#06b6d4';
            ctx.shadowColor = '#06b6d4';
            ctx.fill();
            // Draw cross icon in shield
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pu.x - 4, pu.y); ctx.lineTo(pu.x + 4, pu.y);
            ctx.moveTo(pu.x, pu.y - 4); ctx.lineTo(pu.x, pu.y + 4);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.fill();
            // Star/lightning symbol
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', pu.x, pu.y);
          }
          ctx.shadowBlur = 0;
        });
      }

      // 2. Draw Particles
      game.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 3. Draw Lasers
      game.lasers.forEach((laser) => {
        ctx.beginPath();
        ctx.strokeStyle = laser.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.shadowColor = laser.color;
        ctx.moveTo(laser.x - laser.vx * 0.8, laser.y - laser.vy * 0.8);
        ctx.lineTo(laser.x, laser.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // 4. Draw Asteroids
      game.asteroids.forEach((ast) => {
        ctx.save();
        ctx.translate(ast.x, ast.y);
        ctx.rotate(ast.rotation);
        
        ctx.beginPath();
        // Draw jagged circle for asteroid
        const points = 10;
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const radiusOffset = (i % 2 === 0 ? 0.85 : 1.1) + (Math.random() - 0.5) * 0.05;
          const dist = ast.radius * radiusOffset;
          const px = Math.cos(angle) * dist;
          const py = Math.sin(angle) * dist;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        
        ctx.fillStyle = '#1c192d';
        ctx.fill();
        
        // Neon boundary showing current asteroid health
        ctx.strokeStyle = ast.health > 1 ? '#e2e8f0' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
      });

      // 5. Draw Player Ship
      if (game.status === 'playing') {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);

        // Invulnerable flash
        if (ship.invulnerable > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
          ctx.globalAlpha = 0.3;
        }

        // Draw Ship Body
        ctx.beginPath();
        ctx.moveTo(ship.radius, 0); // Nose
        ctx.lineTo(-ship.radius, -ship.radius * 0.8); // Left Wing
        ctx.lineTo(-ship.radius * 0.5, 0); // Center Engine back
        ctx.lineTo(-ship.radius, ship.radius * 0.8); // Right Wing
        ctx.closePath();
        
        ctx.fillStyle = '#0f052d';
        ctx.fill();

        ctx.strokeStyle = ship.boostActive ? '#06b6d4' : '#a855f7';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.stroke();

        // Draw cockpit dome
        ctx.beginPath();
        ctx.arc(ship.radius * 0.1, 0, ship.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();

        // Draw Shield Bubble if active
        if (game.shield > 0) {
          ctx.beginPath();
          ctx.arc(0, 0, ship.radius * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + (game.shield / 200)})`;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#22d3ee';
          ctx.stroke();
        }

        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    };

    const runFrame = () => {
      updateGame();
      drawGame();
      animationFrameId = requestAnimationFrame(runFrame);
    };

    runFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, soundEnabled]);

  // Controller Pairing URL
  const controllerUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${ipAddress}:3000/controller?room=${roomId}`
    : '';

  return (
    <div className="relative min-h-screen bg-[#050114] text-white flex flex-col overflow-hidden font-sans select-none">
      
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-cyan-950/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-purple-950/20 blur-[150px] pointer-events-none" />

      {/* Top Header Panel */}
      <header className="z-10 px-6 py-4 flex items-center justify-between border-b border-zinc-900/50 bg-[#07021c]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm">
            &larr; Home
          </Link>
          <span className="text-zinc-600">|</span>
          <h2 className="text-lg font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NEON SPARK ARCADE
          </h2>
        </div>

        {/* HUD Stats */}
        {paired && gameState === 'playing' && (
          <div className="flex items-center gap-8 bg-zinc-950/50 px-6 py-2 rounded-xl border border-zinc-800/40">
            {/* Score */}
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Score</span>
              <span className="text-xl font-black text-amber-400 tracking-wider">
                {score.toLocaleString()}
              </span>
            </div>

            {/* Shield */}
            <div className="flex flex-col w-28">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold flex justify-between">
                <span>Shield</span>
                <span className="text-cyan-400 font-bold">{Math.round(gameRef.current.shield)}%</span>
              </span>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-all duration-150"
                  style={{ width: `${gameRef.current.shield}%` }}
                />
              </div>
            </div>

            {/* Health */}
            <div className="flex flex-col w-28">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold flex justify-between">
                <span>Hull Vitals</span>
                <span className="text-pink-400 font-bold">{Math.round(gameRef.current.health)}%</span>
              </span>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] transition-all duration-150"
                  style={{ width: `${gameRef.current.health}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-xs text-zinc-400 hover:text-white transition-all"
          >
            {soundEnabled ? '🔊 Synth Sound' : '🔇 Muted'}
          </button>
          
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">
              WS Host Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-8 z-10">
        
        {error && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-50">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-500 mb-2">Connection Error</h2>
            <p className="text-zinc-400 max-w-md mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Pairing Mode Layout */}
        {gameState === 'pairing' && !paired && roomId && (
          <div className="flex flex-col lg:flex-row items-center justify-center bg-zinc-950/80 p-8 rounded-3xl border border-zinc-800/80 shadow-[0_0_50px_rgba(168,85,247,0.15)] max-w-4xl w-full mx-auto gap-12 animate-fade-in">
            
            {/* Left Side: Instructions */}
            <div className="flex-1 flex flex-col text-center lg:text-left">
              <h1 className="text-3xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Connect Remote Controller
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                To steer your spacecraft, scan the QR code using your smartphone camera or open the URL directly. This screen will start the game automatically once paired.
              </p>
              
              {/* Instructions list */}
              <div className="space-y-4 text-sm mb-8 text-left max-w-md mx-auto lg:mx-0">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0">1</span>
                  <p className="text-zinc-300">Connect your smartphone to the <strong>same Wi-Fi network</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0">2</span>
                  <p className="text-zinc-300">Scan the QR code or enter code <strong>{roomId}</strong> on the controller page.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0">3</span>
                  <p className="text-zinc-300">Your phone screen turns into a virtual joystick controller!</p>
                </div>
              </div>

              {/* Text URL Option */}
              <div className="bg-[#0b071e] p-4 rounded-xl border border-zinc-800 text-center lg:text-left">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Manual Link</div>
                <div className="text-sm font-mono text-cyan-400 mt-1 select-all break-all">
                  {controllerUrl}
                </div>
              </div>
            </div>

            {/* Right Side: QR Code Display */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0a061c] rounded-2xl border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.05)] w-72 shrink-0">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-3">Scan with Camera</div>
              
              {/* QR Code Container */}
              <div className="bg-white p-3 rounded-xl shadow-lg shadow-black/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=050114&data=${encodeURIComponent(controllerUrl)}`} 
                  alt="Pairing QR Code" 
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <div className="text-center mt-6">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Room Code</div>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-amber-400 tracking-widest mt-1">
                  {roomId}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Playing & Game Over Modes */}
        {paired && (
          <div className="relative w-full max-w-5xl aspect-[16/9] bg-black rounded-2xl border-2 border-zinc-800 overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full block" 
            />

            {/* Game Over Screen Overlay */}
            {gameState === 'gameover' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in z-20">
                <div className="text-xs font-bold uppercase tracking-widest text-pink-500 mb-2">Simulation Terminated</div>
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 tracking-wider mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                  GAME OVER
                </h1>
                
                <div className="bg-[#12041a] border border-pink-500/20 px-8 py-4 rounded-xl mb-8 flex gap-8">
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Final Score</div>
                    <div className="text-3xl font-black text-amber-400 mt-1">{score.toLocaleString()}</div>
                  </div>
                  <div className="border-l border-zinc-800" />
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Threats Destroyed</div>
                    <div className="text-3xl font-black text-zinc-300 mt-1">
                      {Math.floor(score / 35)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-zinc-400 text-sm">
                    Press <strong className="text-cyan-400">RESTART</strong> on your mobile controller to retry.
                  </p>
                  
                  {/* Keyboard fallback if testing locally without phone */}
                  <button
                    onClick={restartGame}
                    className="mt-4 px-4 py-2 border border-zinc-800 rounded-lg hover:border-zinc-700 bg-zinc-950/40 text-xs text-zinc-400 hover:text-white transition-all"
                  >
                    Click to Restart from PC
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
