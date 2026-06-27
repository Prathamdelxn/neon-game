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
  const [players, setPlayers] = useState([]);
  const [qrLoaded, setQrLoaded] = useState(false);
  
  // Game modes: 'menu', 'solo_remote', 'lobby'
  const [gameMode, setGameMode] = useState('menu');
  const gameModeRef = useRef('menu');
  const [selectedGame, setSelectedGame] = useState(null); // null, 'neon_shift', 'grid_defender'

  const changeGameMode = (mode) => {
    setGameMode(mode);
    gameModeRef.current = mode;
  };

  const resetToMenu = () => {
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
    }
    const game = gameRef.current;
    game.status = 'pairing';
    game.score = 0;
    game.players = [];
    game.ships = {};
    game.asteroids = [];
    game.lasers = [];
    game.particles = [];
    game.powerups = [];
    
    setScore(0);
    setPlayers([]);
    setPaired(false);
    setGameState('pairing');
    changeGameMode('menu');
    setSelectedGame(null);
  };
  
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  
  // Game loop and variables references to avoid react stale state in requestAnimationFrame
  const gameRef = useRef({
    status: 'pairing',
    score: 0,
    players: [],
    ships: {}, // playerId -> ship details
    lasers: [],
    asteroids: [],
    particles: [],
    powerups: [],
    spawnTimer: 0,
    powerupTimer: 0,
  });

  const getPlayerColor = (id) => {
    switch (id) {
      case 1: return '#22d3ee'; // Cyan
      case 2: return '#ec4899'; // Magenta
      case 3: return '#22c55e'; // Lime
      case 4: return '#f97316'; // Orange
      default: return '#a855f7'; // Purple
    }
  };

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

  // Fetch server IP and connect WebSockets (Only for remote modes)
  useEffect(() => {
    if (gameMode !== 'solo_remote' && gameMode !== 'lobby') return;

    const initConnection = async () => {
      try {
        // Fetch local IP address for localhost replacement
        try {
          const res = await fetch('/api/ip');
          const data = await res.json();
          setIpAddress(data.ip);
        } catch (e) {
          console.warn('Failed to fetch local IP API', e);
        }

        const nextPublicWsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_WS_SERVER;
        const host = window.location.hostname;
        let wsUrl = nextPublicWsUrl || `ws://${host}:3001`;
        
        // Auto-sanitize protocols if http/https is specified
        if (wsUrl.startsWith('https://')) {
          wsUrl = wsUrl.replace('https://', 'wss://');
        } else if (wsUrl.startsWith('http://')) {
          wsUrl = wsUrl.replace('http://', 'ws://');
        }
        
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'host', gameMode: gameModeRef.current }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          
          switch (msg.type) {
            case 'room_created':
              setRoomId(msg.roomId);
              break;

            case 'players_update':
              setPlayers(msg.players || []);
              gameRef.current.players = msg.players || [];
              if (msg.players && msg.players.length > 0) {
                setPaired(true);
                // AUTO-START immediately in Solo Remote Mode if we're not already playing
                if (gameModeRef.current === 'solo_remote' && gameRef.current.status === 'pairing') {
                  startGame();
                }
              } else {
                setPaired(false);
              }
              // Initialize Audio Context
              if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
              }
              break;

            case 'guest_disconnected':
              // If a guest disconnects mid-game, mark their ship as dead/spectating
              if (gameRef.current.status === 'playing') {
                if (gameRef.current.ships[msg.playerId]) {
                  gameRef.current.ships[msg.playerId].health = 0;
                  
                  // Check if everyone is dead now
                  const allDead = Object.values(gameRef.current.ships).every(s => s.health <= 0);
                  if (allDead) {
                    gameRef.current.status = 'gameover';
                    setGameState('gameover');
                    sendToController({ type: 'gameover', finalScore: gameRef.current.score });
                  }
                }
              }
              break;

            case 'joystick':
              if (gameRef.current.ships[msg.playerId]) {
                gameRef.current.ships[msg.playerId].joystick.x = msg.x || 0;
                gameRef.current.ships[msg.playerId].joystick.y = msg.y || 0;
              }
              break;

            case 'fire':
              if (gameRef.current.ships[msg.playerId]) {
                gameRef.current.ships[msg.playerId].isFiring = msg.pressed;
              }
              break;

            case 'boost':
              if (gameRef.current.ships[msg.playerId]) {
                gameRef.current.ships[msg.playerId].boostActive = msg.pressed;
              }
              break;

            case 'start_game_request':
              if (gameRef.current.status === 'pairing' && gameRef.current.players.length > 0) {
                startGame();
              }
              break;

            case 'restart':
              if (gameRef.current.status === 'gameover') {
                startGame();
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
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, [gameMode]);



  const sendToController = (data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  };

  const broadcastScoreToAll = () => {
    const game = gameRef.current;
    game.players.forEach(p => {
      const ship = game.ships[p.id];
      if (ship) {
        sendToController({
          type: 'status',
          playerId: p.id,
          health: ship.health,
          shield: ship.shield,
          score: game.score
        });
      }
    });
  };

  const startGame = () => {
    const game = gameRef.current;
    game.status = 'playing';
    game.score = 0;
    game.asteroids = [];
    game.lasers = [];
    game.particles = [];
    game.powerups = [];
    game.wave = 1;
    game.waveSpawned = 0;
    game.waveSpawnTimer = 0;
    game.waveTotalToSpawn = 4;
    setScore(0);
    
    // Instantiate ships
    game.ships = {};
    game.players.forEach((player, index) => {
      const offset = (index - (game.players.length - 1) / 2) * 80;
      game.ships[player.id] = {
        id: player.id,
        nickname: player.nickname,
        x: canvasRef.current ? canvasRef.current.width / 2 + offset : 200 + index * 100,
        y: canvasRef.current ? canvasRef.current.height * 0.75 : 400,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        radius: 18,
        boostActive: false,
        lastFired: 0,
        invulnerable: 60, // 1s immunity
        health: 100,
        shield: 100,
        joystick: { x: 0, y: 0 },
        isFiring: false,
        color: getPlayerColor(player.id),
      };
    });
    
    setGameState('playing');
    
    // Broadcast start and initial stats if using controllers
    if (gameModeRef.current === 'solo_remote' || gameModeRef.current === 'lobby') {
      sendToController({ type: 'start_game' });
      game.players.forEach(p => {
        sendToController({
          type: 'status',
          playerId: p.id,
          health: 100,
          shield: 100,
          score: 0
        });
        sendToController({ type: 'vibrate', playerId: p.id, pattern: 'paired' });
      });
    }
  };

  // Canvas Game Loops
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set fixed viewport bounds
    canvas.width = 1024;
    canvas.height = 576;

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

    const walls = [
      { x: 180, y: 120, w: 40, h: 336, color: '#ec4899' }, // Left vertical barrier (Pink)
      { x: 804, y: 120, w: 40, h: 336, color: '#ec4899' }, // Right vertical barrier (Pink)
      { x: 412, y: 120, w: 200, h: 40, color: '#06b6d4' }, // Top center horizontal barrier (Cyan)
      { x: 412, y: 416, w: 200, h: 40, color: '#06b6d4' }, // Bottom center horizontal barrier (Cyan)
    ];

    const updateGridDefender = () => {
      const game = gameRef.current;
      const now = Date.now();
      const laserSpeed = 9;

      // Spawn Drones in waves
      if (game.asteroids.length === 0 && game.waveSpawned >= game.waveTotalToSpawn) {
        game.wave++;
        game.waveSpawned = 0;
        game.waveSpawnTimer = 0;
        game.waveTotalToSpawn = 2 + game.wave * 2;
      }

      if (game.waveSpawned < game.waveTotalToSpawn) {
        game.waveSpawnTimer++;
        if (game.waveSpawnTimer > 90) { // spawn every 1.5 seconds
          game.waveSpawnTimer = 0;

          const spawnPoints = [
            { x: 60, y: 60 },
            { x: 964, y: 60 },
            { x: 60, y: 516 },
            { x: 964, y: 516 }
          ];
          const spawnPos = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

          game.asteroids.push({
            id: Date.now() + Math.random(),
            x: spawnPos.x,
            y: spawnPos.y,
            vx: 0,
            vy: 0,
            radius: 15,
            health: Math.ceil(game.wave / 2),
            maxHealth: Math.ceil(game.wave / 2),
            angle: 0,
            lastFired: Date.now() + Math.random() * 1000,
            color: '#ef4444'
          });
          game.waveSpawned++;
        }
      }

      // Update Player Tanks & Collision
      Object.values(game.ships).forEach((ship) => {
        if (ship.health <= 0) return;

        const acceleration = ship.boostActive ? 0.35 : 0.18;
        const maxSpeed = ship.boostActive ? 7.5 : 4.2;

        ship.vx += ship.joystick.x * acceleration;
        ship.vy += ship.joystick.y * acceleration;

        ship.vx *= 0.95;
        ship.vy *= 0.95;

        const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
        if (speed > maxSpeed) {
          ship.vx = (ship.vx / speed) * maxSpeed;
          ship.vy = (ship.vy / speed) * maxSpeed;
        }

        let newX = ship.x + ship.vx;
        let newY = ship.y + ship.vy;

        // Boundary constraint
        const margin = ship.radius + 5;
        if (newX < margin) { newX = margin; ship.vx = 0; }
        if (newX > canvas.width - margin) { newX = canvas.width - margin; ship.vx = 0; }
        if (newY < margin) { newY = margin; ship.vy = 0; }
        if (newY > canvas.height - margin) { newY = canvas.height - margin; ship.vy = 0; }

        // Wall collisions
        walls.forEach((wall) => {
          const closestX = Math.max(wall.x, Math.min(newX, wall.x + wall.w));
          const closestY = Math.max(wall.y, Math.min(newY, wall.y + wall.h));

          const dx = newX - closestX;
          const dy = newY - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < ship.radius) {
            const overlap = ship.radius - dist;
            if (dist > 0) {
              newX += (dx / dist) * overlap;
              newY += (dy / dist) * overlap;
              const nx = dx / dist;
              const ny = dy / dist;
              const dot = ship.vx * nx + ship.vy * ny;
              if (dot < 0) {
                ship.vx -= dot * nx;
                ship.vy -= dot * ny;
              }
            } else {
              newX += ship.radius;
            }
          }
        });

        ship.x = newX;
        ship.y = newY;

        if (ship.joystick.x !== 0 || ship.joystick.y !== 0) {
          ship.angle = Math.atan2(ship.joystick.y, ship.joystick.x);
        }

        // Exhaust particles on boost
        if (ship.boostActive && Math.random() < 0.4) {
          const oppositeAngle = ship.angle + Math.PI + (Math.random() - 0.5) * 0.4;
          game.particles.push({
            x: ship.x - Math.cos(ship.angle) * ship.radius,
            y: ship.y - Math.sin(ship.angle) * ship.radius,
            vx: Math.cos(oppositeAngle) * 3 + ship.vx * 0.3,
            vy: Math.sin(oppositeAngle) * 3 + ship.vy * 0.3,
            color: '#38bdf8',
            size: Math.random() * 2.5 + 1,
            alpha: 0.8,
            life: 0,
            maxLife: 15 + Math.random() * 10
          });
        }

        if (ship.invulnerable > 0) ship.invulnerable--;

        // Firing lasers
        const fireInterval = 250;
        if (ship.isFiring && now - ship.lastFired > fireInterval) {
          playSynthSound('laser');
          game.lasers.push({
            x: ship.x + Math.cos(ship.angle) * (ship.radius + 2),
            y: ship.y + Math.sin(ship.angle) * (ship.radius + 2),
            vx: Math.cos(ship.angle) * laserSpeed,
            vy: Math.sin(ship.angle) * laserSpeed,
            age: 0,
            bounces: 0,
            color: ship.color,
            playerId: ship.id
          });
          ship.lastFired = now;

          if (gameModeRef.current !== 'solo_keyboard') {
            sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'fire' });
          }
        }
      });

      // Update Drone Enemy pathing and shooting
      game.asteroids.forEach((drone) => {
        let closestPlayer = null;
        let minDist = Infinity;
        Object.values(game.ships).forEach((pShip) => {
          if (pShip.health <= 0) return;
          const d = Math.sqrt((pShip.x - drone.x) ** 2 + (pShip.y - drone.y) ** 2);
          if (d < minDist) {
            minDist = d;
            closestPlayer = pShip;
          }
        });

        if (closestPlayer) {
          const targetAngle = Math.atan2(closestPlayer.y - drone.y, closestPlayer.x - drone.x);
          drone.angle = targetAngle;
          drone.vx = Math.cos(targetAngle) * 1.3;
          drone.vy = Math.sin(targetAngle) * 1.3;
        } else {
          drone.vx *= 0.95;
          drone.vy *= 0.95;
        }

        let newX = drone.x + drone.vx;
        let newY = drone.y + drone.vy;

        // Boundary constraint
        const margin = drone.radius + 5;
        if (newX < margin) { newX = margin; drone.vx = -drone.vx; }
        if (newX > canvas.width - margin) { newX = canvas.width - margin; drone.vx = -drone.vx; }
        if (newY < margin) { newY = margin; drone.vy = -drone.vy; }
        if (newY > canvas.height - margin) { newY = canvas.height - margin; drone.vy = -drone.vy; }

        // Wall collision
        walls.forEach((wall) => {
          const closestX = Math.max(wall.x, Math.min(newX, wall.x + wall.w));
          const closestY = Math.max(wall.y, Math.min(newY, wall.y + wall.h));

          const dx = newX - closestX;
          const dy = newY - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < drone.radius) {
            const overlap = drone.radius - dist;
            if (dist > 0) {
              newX += (dx / dist) * overlap;
              newY += (dy / dist) * overlap;
              const nx = dx / dist;
              const ny = dy / dist;
              const dot = drone.vx * nx + drone.vy * ny;
              if (dot < 0) {
                drone.vx -= dot * nx;
                drone.vy -= dot * ny;
              }
            }
          }
        });

        drone.x = newX;
        drone.y = newY;

        // Fire back at player
        if (closestPlayer && now - drone.lastFired > (2200 + Math.random() * 1200)) {
          game.lasers.push({
            x: drone.x + Math.cos(drone.angle) * (drone.radius + 2),
            y: drone.y + Math.sin(drone.angle) * (drone.radius + 2),
            vx: Math.cos(drone.angle) * 6,
            vy: Math.sin(drone.angle) * 6,
            age: 0,
            bounces: 0,
            color: '#ef4444',
            isEnemy: true
          });
          drone.lastFired = now;
        }
      });

      // Bouncing Laser updates
      game.lasers = game.lasers.filter((laser) => {
        let nextX = laser.x + laser.vx;
        let nextY = laser.y + laser.vy;

        const bMargin = 5;
        if (nextX < bMargin) {
          laser.vx = Math.abs(laser.vx);
          laser.x = bMargin;
          laser.bounces = (laser.bounces || 0) + 1;
          spawnExplosion(laser.x, laser.y, laser.color, 3, 1.0);
        } else if (nextX > canvas.width - bMargin) {
          laser.vx = -Math.abs(laser.vx);
          laser.x = canvas.width - bMargin;
          laser.bounces = (laser.bounces || 0) + 1;
          spawnExplosion(laser.x, laser.y, laser.color, 3, 1.0);
        }

        if (nextY < bMargin) {
          laser.vy = Math.abs(laser.vy);
          laser.y = bMargin;
          laser.bounces = (laser.bounces || 0) + 1;
          spawnExplosion(laser.x, laser.y, laser.color, 3, 1.0);
        } else if (nextY > canvas.height - bMargin) {
          laser.vy = -Math.abs(laser.vy);
          laser.y = canvas.height - bMargin;
          laser.bounces = (laser.bounces || 0) + 1;
          spawnExplosion(laser.x, laser.y, laser.color, 3, 1.0);
        }

        nextX = laser.x + laser.vx;
        nextY = laser.y + laser.vy;

        walls.forEach((wall) => {
          if (nextX >= wall.x && nextX <= wall.x + wall.w &&
              nextY >= wall.y && nextY <= wall.y + wall.h) {
            
            const fromLeft = nextX - wall.x;
            const fromRight = (wall.x + wall.w) - nextX;
            const fromTop = nextY - wall.y;
            const fromBottom = (wall.y + wall.h) - nextY;

            const minDepth = Math.min(fromLeft, fromRight, fromTop, fromBottom);

            if (minDepth === fromLeft) {
              laser.vx = -Math.abs(laser.vx);
              laser.x = wall.x - 2;
            } else if (minDepth === fromRight) {
              laser.vx = Math.abs(laser.vx);
              laser.x = wall.x + wall.w + 2;
            } else if (minDepth === fromTop) {
              laser.vy = -Math.abs(laser.vy);
              laser.y = wall.y - 2;
            } else if (minDepth === fromBottom) {
              laser.vy = Math.abs(laser.vy);
              laser.y = wall.y + wall.h + 2;
            }

            laser.bounces = (laser.bounces || 0) + 1;
            spawnExplosion(laser.x, laser.y, laser.color, 4, 1.1);
          }
        });

        laser.x = laser.x + laser.vx;
        laser.y = laser.y + laser.vy;
        laser.age++;

        return laser.bounces <= 2 && laser.age < 150;
      });

      // Laser collisions
      game.lasers = game.lasers.filter((laser) => {
        let active = true;

        if (laser.isEnemy) {
          Object.values(game.ships).forEach((ship) => {
            if (ship.health <= 0 || ship.invulnerable > 0 || !active) return;
            const dist = Math.sqrt((laser.x - ship.x)**2 + (laser.y - ship.y)**2);
            if (dist < ship.radius) {
              active = false;
              spawnExplosion(laser.x, laser.y, '#ef4444', 10, 2);
              playSynthSound('hit');
              const damage = 15;
              if (ship.shield > 0) {
                ship.shield = Math.max(0, ship.shield - damage * 1.5);
              } else {
                ship.health = Math.max(0, ship.health - damage);
              }

              if (gameModeRef.current !== 'solo_keyboard') {
                sendToController({
                  type: 'status',
                  playerId: ship.id,
                  health: ship.health,
                  shield: ship.shield,
                  score: game.score
                });
                sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'hurt' });
              }

              ship.invulnerable = 60;

              if (ship.health <= 0) {
                spawnExplosion(ship.x, ship.y, '#e11d48', 40, 5);
                if (gameModeRef.current !== 'solo_keyboard') {
                  sendToController({ type: 'gameover', playerId: ship.id, finalScore: game.score });
                }
                const allDead = Object.values(game.ships).every(s => s.health <= 0);
                if (allDead) {
                  game.status = 'gameover';
                  setGameState('gameover');
                  if (gameModeRef.current !== 'solo_keyboard') {
                    sendToController({ type: 'gameover', finalScore: game.score });
                  }
                }
              }
            }
          });
        } else {
          game.asteroids = game.asteroids.filter((drone) => {
            if (!active) return true;
            const dist = Math.sqrt((laser.x - drone.x)**2 + (laser.y - drone.y)**2);
            if (dist < drone.radius) {
              active = false;
              drone.health -= 1;
              spawnExplosion(laser.x, laser.y, laser.color, 5, 1.2);

              if (drone.health <= 0) {
                spawnExplosion(drone.x, drone.y, '#f59e0b', 20, 3.2);
                game.score += 100;
                setScore(game.score);
                if (gameModeRef.current !== 'solo_keyboard') {
                  broadcastScoreToAll();
                }
                return false;
              }
              return true;
            }
            return true;
          });
        }

        return active;
      });

      // Drone colliding directly with player tank
      game.asteroids = game.asteroids.filter((drone) => {
        let destroyed = false;

        Object.values(game.ships).forEach((ship) => {
          if (ship.health <= 0 || ship.invulnerable > 0 || destroyed) return;

          const dist = Math.sqrt((ship.x - drone.x)**2 + (ship.y - drone.y)**2);
          if (dist < ship.radius + drone.radius) {
            destroyed = true;
            spawnExplosion(drone.x, drone.y, '#ef4444', 20, 3.5);
            playSynthSound('hit');

            const damage = 25;
            if (ship.shield > 0) {
              ship.shield = Math.max(0, ship.shield - damage * 1.2);
            } else {
              ship.health = Math.max(0, ship.health - damage);
            }

            if (gameModeRef.current !== 'solo_keyboard') {
              sendToController({
                type: 'status',
                playerId: ship.id,
                health: ship.health,
                shield: ship.shield,
                score: game.score
              });
              sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'hurt' });
            }

            ship.invulnerable = 60;

            if (ship.health <= 0) {
              spawnExplosion(ship.x, ship.y, '#e11d48', 40, 5);
              if (gameModeRef.current !== 'solo_keyboard') {
                sendToController({ type: 'gameover', playerId: ship.id, finalScore: game.score });
              }
              const allDead = Object.values(game.ships).every(s => s.health <= 0);
              if (allDead) {
                game.status = 'gameover';
                setGameState('gameover');
                if (gameModeRef.current !== 'solo_keyboard') {
                  sendToController({ type: 'gameover', finalScore: game.score });
                }
              }
            }
          }
        });

        return !destroyed;
      });

      // Power-up updates and collisions
      game.powerups.forEach(p => p.pulse += 0.05);

      game.powerups = game.powerups.filter((pu) => {
        let pickedUp = false;
        Object.values(game.ships).forEach((ship) => {
          if (ship.health <= 0 || pickedUp) return;

          const dist = Math.sqrt((pu.x - ship.x)**2 + (pu.y - ship.y)**2);
          if (dist < ship.radius + pu.radius) {
            pickedUp = true;
            playSynthSound('powerup');
            if (pu.type === 'shield') {
              ship.shield = Math.min(100, ship.shield + 40);
            } else if (pu.type === 'boost') {
              game.score += 250;
              setScore(game.score);
            }
            if (gameModeRef.current !== 'solo_keyboard') {
              broadcastScoreToAll();
              sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'powerup' });
            }
          }
        });
        return !pickedUp;
      });

      game.powerupTimer++;
      if (game.powerupTimer > 750) {
        game.powerupTimer = 0;
        if (game.powerups.length < 3) {
          let px = Math.random() * (canvas.width - 150) + 75;
          let py = Math.random() * (canvas.height - 150) + 75;

          let insideWall = false;
          walls.forEach((wall) => {
            if (px >= wall.x - 15 && px <= wall.x + wall.w + 15 &&
                py >= wall.y - 15 && py <= wall.y + wall.h + 15) {
              insideWall = true;
            }
          });

          if (!insideWall) {
            game.powerups.push({
              x: px,
              y: py,
              type: Math.random() < 0.65 ? 'shield' : 'boost',
              radius: 12,
              pulse: 0
            });
          }
        }
      }

      // Particles decay
      game.particles.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
        part.alpha = 1 - part.life / part.maxLife;
      });
      game.particles = game.particles.filter((part) => part.life < part.maxLife);
    };

    const updateNeonShift = () => {
      const game = gameRef.current;
      const drag = 0.97;
      const laserSpeed = 12;
      const now = Date.now();
      const fireInterval = 180; // cooldown ms

      // 1. Update Physics per active ship
      Object.values(game.ships).forEach((ship) => {
        if (ship.health <= 0) return; // skip dead ships

        const acceleration = ship.boostActive ? 0.35 : 0.18;
        const maxSpeed = ship.boostActive ? 8 : 4.5;

        // Accelerate via joystick values
        ship.vx += ship.joystick.x * acceleration;
        ship.vy += ship.joystick.y * acceleration;

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
        if (ship.joystick.x !== 0 || ship.joystick.y !== 0) {
          ship.angle = Math.atan2(ship.joystick.y, ship.joystick.x);
        }

        // Spawn propulsion exhaust particles
        if (Math.abs(ship.joystick.x) > 0.1 || Math.abs(ship.joystick.y) > 0.1 || ship.boostActive) {
          const oppositeAngle = ship.angle + Math.PI + (Math.random() - 0.5) * 0.5;
          const particleSpeed = ship.boostActive ? 4 : 2;
          game.particles.push({
            x: ship.x - Math.cos(ship.angle) * ship.radius,
            y: ship.y - Math.sin(ship.angle) * ship.radius,
            vx: Math.cos(oppositeAngle) * particleSpeed + ship.vx * 0.5,
            vy: Math.sin(oppositeAngle) * particleSpeed + ship.vy * 0.5,
            color: ship.boostActive ? '#06b6d4' : ship.color,
            size: Math.random() * 3 + 1,
            alpha: 0.8,
            life: 0,
            maxLife: 15 + Math.random() * 10,
          });
        }

        // Firing Lasers
        if (ship.isFiring && now - ship.lastFired > fireInterval) {
          playSynthSound('laser');
          
          game.lasers.push({
            x: ship.x + Math.cos(ship.angle) * ship.radius,
            y: ship.y + Math.sin(ship.angle) * ship.radius,
            vx: Math.cos(ship.angle) * laserSpeed + ship.vx * 0.4,
            vy: Math.sin(ship.angle) * laserSpeed + ship.vy * 0.4,
            age: 0,
            color: ship.color,
            playerId: ship.id
          });
          ship.lastFired = now;

          // Soft controller trigger vibration
          if (gameModeRef.current !== 'solo_keyboard') {
            sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'fire' });
          }
        }
      });

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
        const size = Math.random() * 25 + 15;

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
        if (game.powerups.length < 3) {
          game.powerups.push({
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50,
            type: Math.random() < 0.6 ? 'shield' : 'boost',
            radius: 12,
            pulse: 0,
          });
        }
      }

      // Update power-up pulse effects
      game.powerups.forEach(p => p.pulse += 0.05);

      // Power-up collisions with active ships
      game.powerups = game.powerups.filter((pu) => {
        let pickedUp = false;
        Object.values(game.ships).forEach((ship) => {
          if (ship.health <= 0 || pickedUp) return;

          const dx = pu.x - ship.x;
          const dy = pu.y - ship.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < ship.radius + pu.radius) {
            pickedUp = true;
            playSynthSound('powerup');
            if (pu.type === 'shield') {
              ship.shield = Math.min(100, ship.shield + 40);
            } else if (pu.type === 'boost') {
              game.score += 50;
              setScore(game.score);
            }
            if (gameModeRef.current !== 'solo_keyboard') {
              broadcastScoreToAll();
              sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'powerup' });
            }
          }
        });
        return !pickedUp;
      });

      // 5. Collision Detections
      // Lasers with Asteroids
      game.lasers = game.lasers.filter((laser) => {
        let hit = false;
        game.asteroids = game.asteroids.filter((ast) => {
          if (hit) return true;

          const dx = laser.x - ast.x;
          const dy = laser.y - ast.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < ast.radius) {
            hit = true;
            ast.health -= 1;
            spawnExplosion(laser.x, laser.y, '#f43f5e', 5, 1.5);
            
            if (ast.health <= 0) {
              spawnExplosion(ast.x, ast.y, '#fbbf24', Math.floor(ast.radius / 1.5), 3);
              game.score += Math.floor(ast.radius);
              setScore(game.score);
              if (gameModeRef.current !== 'solo_keyboard') {
                broadcastScoreToAll();
              }
              return false; // remove asteroid
            }
            return true;
          }
          return true;
        });
        return !hit; // remove laser
      });

      // Ships with Asteroids
      game.asteroids = game.asteroids.filter((ast) => {
        let destroyedByCollision = false;
        
        Object.values(game.ships).forEach((ship) => {
          if (ship.health <= 0 || ship.invulnerable > 0 || destroyedByCollision) return;

          const dx = ship.x - ast.x;
          const dy = ship.y - ast.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < ship.radius + ast.radius) {
            destroyedByCollision = true;
            spawnExplosion(ast.x, ast.y, '#ef4444', 15, 3.5);
            playSynthSound('hit');

            const damage = Math.ceil(ast.radius / 2.5);
            if (ship.shield > 0) {
              ship.shield = Math.max(0, ship.shield - damage * 1.5);
            } else {
              ship.health = Math.max(0, ship.health - damage);
            }

            // Sync stats if remote mode
            if (gameModeRef.current !== 'solo_keyboard') {
              sendToController({
                type: 'status',
                playerId: ship.id,
                health: ship.health,
                shield: ship.shield,
                score: game.score
              });
              sendToController({ type: 'vibrate', playerId: ship.id, pattern: 'hurt' });
            }

            ship.invulnerable = 60; // 1 second immunity
            
            // Check for ship death
            if (ship.health <= 0) {
              spawnExplosion(ship.x, ship.y, '#e11d48', 40, 5); // Huge ship explosion
              if (gameModeRef.current !== 'solo_keyboard') {
                sendToController({ type: 'gameover', playerId: ship.id, finalScore: game.score });
              }
              
              // Check for all-dead
              const allDead = Object.values(game.ships).every(s => s.health <= 0);
              if (allDead) {
                game.status = 'gameover';
                setGameState('gameover');
                if (gameModeRef.current !== 'solo_keyboard') {
                  sendToController({ type: 'gameover', finalScore: game.score });
                }
              }
            }
          }
        });

        return !destroyedByCollision;
      });

      // 6. Update Particles
      game.particles.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
        part.alpha = 1 - part.life / part.maxLife;
      });

      game.particles = game.particles.filter((part) => part.life < part.maxLife);
    };

    const updateGame = () => {
      const game = gameRef.current;
      if (game.status !== 'playing') return;

      if (selectedGame === 'grid_defender') {
        updateGridDefender();
      } else {
        updateNeonShift();
      }
    };

    const drawGridDefender = () => {
      // 1. Draw Grid Arena background
      ctx.fillStyle = '#03010b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)'; // Neon pink grid line
      ctx.lineWidth = 1;
      const gridSize = 32;
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

      // 2. Draw Obstacle Walls
      walls.forEach((wall) => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = wall.color;
        ctx.strokeStyle = wall.color;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#0b061c';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.strokeRect(wall.x + 3, wall.y + 3, wall.w - 6, wall.h - 6);
      });

      // 3. Draw Powerups
      if (gameRef.current.status === 'playing') {
        gameRef.current.powerups.forEach((pu) => {
          const size = pu.radius + Math.sin(pu.pulse) * 2;
          ctx.beginPath();
          ctx.arc(pu.x, pu.y, size, 0, Math.PI * 2);
          ctx.shadowBlur = 15;
          
          if (pu.type === 'shield') {
            ctx.fillStyle = '#06b6d4';
            ctx.shadowColor = '#06b6d4';
            ctx.fill();
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
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', pu.x, pu.y);
          }
          ctx.shadowBlur = 0;
        });
      }

      // 4. Draw Particles
      gameRef.current.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 5. Draw Bouncing Lasers
      gameRef.current.lasers.forEach((laser) => {
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

      // 6. Draw Drone Enemies (triangles)
      gameRef.current.asteroids.forEach((drone) => {
        ctx.save();
        ctx.translate(drone.x, drone.y);
        ctx.rotate(drone.angle);
        
        ctx.beginPath();
        ctx.moveTo(drone.radius, 0);
        ctx.lineTo(-drone.radius * 0.7, -drone.radius * 0.7);
        ctx.lineTo(-drone.radius * 0.4, 0);
        ctx.lineTo(-drone.radius * 0.7, drone.radius * 0.7);
        ctx.closePath();
        
        ctx.fillStyle = '#14030a';
        ctx.fill();
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        ctx.restore();
        ctx.shadowBlur = 0;
      });

      // 7. Draw Player Tanks
      if (gameRef.current.status === 'playing') {
        Object.values(gameRef.current.ships).forEach((ship) => {
          if (ship.health <= 0) return;

          ctx.save();
          ctx.translate(ship.x, ship.y);
          ctx.rotate(ship.angle);

          if (ship.invulnerable > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.3;
          }

          // Left tread
          ctx.fillStyle = '#0f052d';
          ctx.strokeStyle = ship.color;
          ctx.lineWidth = 1.5;
          ctx.fillRect(-ship.radius, -ship.radius * 0.95, ship.radius * 1.8, ship.radius * 0.35);
          ctx.strokeRect(-ship.radius, -ship.radius * 0.95, ship.radius * 1.8, ship.radius * 0.35);
          // Right tread
          ctx.fillRect(-ship.radius, ship.radius * 0.6, ship.radius * 1.8, ship.radius * 0.35);
          ctx.strokeRect(-ship.radius, ship.radius * 0.6, ship.radius * 1.8, ship.radius * 0.35);

          // Body box
          ctx.beginPath();
          ctx.rect(-ship.radius * 0.7, -ship.radius * 0.6, ship.radius * 1.4, ship.radius * 1.2);
          ctx.fillStyle = '#050114';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = ship.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = ship.color;
          ctx.stroke();

          // Circular turret
          ctx.beginPath();
          ctx.arc(0, 0, ship.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = '#1e1b4b';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.stroke();

          // Gun barrel
          ctx.beginPath();
          ctx.rect(0, -3, ship.radius * 1.1, 6);
          ctx.fillStyle = ship.color;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          if (ship.shield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, ship.radius * 1.4, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + (ship.shield / 200)})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#22d3ee';
            ctx.stroke();
          }

          ctx.restore();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;

          if (gameModeRef.current === 'lobby') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '9px font-sans';
            ctx.textAlign = 'center';
            ctx.fillText(ship.nickname, ship.x, ship.y - ship.radius - 12);
            ctx.restore();
          }
        });
      }

      // 8. Wave Status HUD overlays
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '900 14px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`WAVE: ${gameRef.current.wave}`, canvas.width - 20, 20);
      
      if (gameRef.current.waveSpawned === 0 && gameRef.current.waveSpawnTimer < 150) {
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.95)';
        ctx.font = '900 40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ec4899';
        ctx.fillText(`INCOMING WAVE ${gameRef.current.wave}`, canvas.width / 2, canvas.height / 2);
      }
      ctx.restore();
    };

    const drawNeonShift = () => {
      const game = gameRef.current;

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
            // Dollar/lightning symbol
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
        
        ctx.strokeStyle = ast.health > 1 ? '#e2e8f0' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
      });

      // 5. Draw Player Ships
      if (game.status === 'playing') {
        Object.values(game.ships).forEach((ship) => {
          if (ship.health <= 0) return;

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

          ctx.strokeStyle = ship.boostActive ? '#ffffff' : ship.color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 15;
          ctx.shadowColor = ship.color;
          ctx.stroke();

          // Draw cockpit dome
          ctx.beginPath();
          ctx.arc(ship.radius * 0.1, 0, ship.radius * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = '#22d3ee';
          ctx.fill();

          // Draw Shield Bubble if active
          if (ship.shield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, ship.radius * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + (ship.shield / 200)})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = ship.color;
            ctx.stroke();
          }

          ctx.restore();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;

          // Draw player nickname above ship (only in multiplayer mode)
          if (gameModeRef.current === 'lobby') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '9px font-sans';
            ctx.textAlign = 'center';
            ctx.fillText(ship.nickname, ship.x, ship.y - ship.radius - 12);
            ctx.restore();
          }
        });
      }
    };

    const drawGame = () => {
      if (selectedGame === 'grid_defender') {
        drawGridDefender();
      } else {
        drawNeonShift();
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
  }, [gameState, soundEnabled, gameMode]);

  // Controller Pairing URL
  const controllerUrl = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `${window.location.protocol}//${ipAddress}:${window.location.port || '3000'}/controller?room=${roomId}`
      : `${window.location.origin}/controller?room=${roomId}`
    : '';

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white flex flex-col overflow-hidden font-sans select-none animate-fade-in">
      
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-cyan-950/10 blur-[150px] pointer-events-none" />

      {/* Top Header Panel */}
      <header className="z-10 px-6 py-4 flex items-center justify-between border-b border-zinc-900/80 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={resetToMenu}
            className="text-zinc-400 hover:text-white transition-colors text-sm font-semibold"
          >
            &larr; Menu
          </button>
          <span className="text-zinc-600">|</span>
          <h2 className="text-lg font-bold tracking-wider bg-gradient-to-r from-zinc-100 to-cyan-400 bg-clip-text text-transparent">
            NEON SPARK ARCADE
          </h2>
        </div>

        {/* HUD Stats */}
        {gameState === 'playing' && (
          <div className="flex items-center gap-6 bg-zinc-950/50 px-6 py-2 rounded-xl border border-zinc-800/40 max-w-[65%] overflow-x-auto">
            {/* Score */}
            <div className="flex flex-col shrink-0">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Team Score</span>
              <span className="text-xl font-black text-amber-400 tracking-wider">
                {score.toLocaleString()}
              </span>
            </div>
            
            <div className="h-8 w-px bg-zinc-800 shrink-0" />
            
            {/* Player stats list */}
            <div className="flex items-center gap-4">
              {Object.values(gameRef.current.ships).map((ship) => (
                <div key={ship.id} className="flex items-center gap-3 bg-[#0c0722]/60 px-3 py-1.5 rounded-lg border border-zinc-800/50 text-[10px]">
                  {gameMode === 'lobby' && (
                    <span className="font-extrabold uppercase font-mono tracking-wider shrink-0" style={{ color: ship.color }}>
                      {ship.nickname}
                    </span>
                  )}
                  
                  {ship.health > 0 ? (
                    <div className="flex items-center gap-2">
                      {/* Shield Bar */}
                      <div className="flex flex-col w-12 sm:w-16">
                        <div className="flex justify-between text-[7px] font-black text-zinc-500">
                          <span>SHD</span>
                          <span>{Math.round(ship.shield)}%</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden mt-0.5">
                          <div 
                            className="h-full transition-all duration-150"
                            style={{ width: `${ship.shield}%`, backgroundColor: ship.color }}
                          />
                        </div>
                      </div>
                      
                      {/* Hull Bar */}
                      <div className="flex flex-col w-12 sm:w-16">
                        <div className="flex justify-between text-[7px] font-black text-zinc-500">
                          <span>HUL</span>
                          <span>{Math.round(ship.health)}%</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden mt-0.5">
                          <div 
                            className="h-full bg-pink-500 transition-all duration-150"
                            style={{ width: `${ship.health}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-600 font-bold uppercase tracking-wider text-[8px] flex items-center gap-1 animate-pulse">
                      ☠️ Spectating
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 shrink-0">
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

        {/* 1. STARTUP MENU SELECTION SCREEN */}
        {gameMode === 'menu' && selectedGame === null && (
          <div className="flex flex-col items-center max-w-5xl w-full mx-auto text-center animate-fade-in px-4">
            <div className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-wider text-cyan-400 uppercase bg-cyan-950/20 border border-cyan-800/40 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.05)]">
              Arcade Game Selection
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-12 tracking-wide bg-gradient-to-r from-white via-zinc-200 to-cyan-400 bg-clip-text text-transparent filter drop-shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              SELECT SIMULATION PROGRAM
            </h1>

            <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl mx-auto">
              
              {/* Game 1: Neon Shift */}
              <button
                onClick={() => setSelectedGame('neon_shift')}
                className="group flex flex-col rounded-3xl border border-zinc-800/80 hover:border-cyan-500/40 bg-zinc-900/10 hover:bg-zinc-900/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-all duration-300 overflow-hidden text-left cursor-pointer animate-fade-in"
              >
                {/* Visual Header Image */}
                <div className="w-full aspect-[16/9] relative overflow-hidden bg-zinc-950 border-b border-zinc-800/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/neon_shift_cover.png" 
                    alt="Neon Shift Space Shooter" 
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
                  <span className="absolute top-4 left-4 text-[8px] font-black uppercase tracking-widest text-cyan-400 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800">
                    Space Shooter
                  </span>
                </div>
                
                {/* Content body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white tracking-wide group-hover:text-cyan-400 transition-colors mb-2">NEON SHIFT</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                      Fly a speeder craft through a dense neon asteroid field. Blast obstacles, dodge threats, and collect shield modules to survive.
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-zinc-900">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                      👥 1-4 Players Co-op
                    </span>
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider group-hover:translate-x-1.5 transition-transform">
                      Load Program &rarr;
                    </span>
                  </div>
                </div>
              </button>

              {/* Game 2: Grid Defender */}
              <button
                onClick={() => setSelectedGame('grid_defender')}
                className="group flex flex-col rounded-3xl border border-zinc-800/80 hover:border-cyan-500/40 bg-zinc-900/10 hover:bg-zinc-900/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-all duration-300 overflow-hidden text-left cursor-pointer animate-fade-in"
              >
                {/* Visual Header Image */}
                <div className="w-full aspect-[16/9] relative overflow-hidden bg-zinc-950 border-b border-zinc-800/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/grid_defender_cover.png" 
                    alt="Grid Defender Tank Battle" 
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
                  <span className="absolute top-4 left-4 text-[8px] font-black uppercase tracking-widest text-cyan-400 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800">
                    Tank Arena
                  </span>
                </div>
                
                {/* Content body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white tracking-wide group-hover:text-cyan-400 transition-colors mb-2">GRID DEFENDER</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                      Deploy a neon battle tank. Navigate grid walls and destroy waves of incoming hunter drones using tactical bouncing lasers.
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-zinc-900">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                      👥 1-4 Players Co-op
                    </span>
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider group-hover:translate-x-1.5 transition-transform">
                      Load Program &rarr;
                    </span>
                  </div>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* 2. MODE SETUP SCREEN FOR SELECTED GAME */}
        {gameMode === 'menu' && selectedGame !== null && (
          <div className="flex flex-col items-center max-w-4xl w-full mx-auto text-center animate-fade-in px-4">
            <div className="inline-block px-4 py-1.5 mb-2 text-xs font-semibold tracking-wider text-cyan-400 uppercase bg-cyan-950/20 border border-cyan-800/40 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.05)]">
              Simulation Setup: {selectedGame === 'neon_shift' ? 'NEON SHIFT' : 'GRID DEFENDER'}
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black mb-8 tracking-wide bg-gradient-to-r from-white via-zinc-200 to-cyan-400 bg-clip-text text-transparent filter drop-shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              SELECT PROTOCOL MODE
            </h1>

            <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto mb-10">
              {/* Solo Remote */}
              <button
                onClick={() => changeGameMode('solo_remote')}
                className="group flex flex-col justify-between p-6 rounded-2xl border border-zinc-800/80 hover:border-cyan-500/40 bg-zinc-900/10 hover:bg-zinc-900/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-all duration-300 text-left cursor-pointer"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-950/30 border border-cyan-800/60 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                    📱
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">Solo Remote</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Scan the QR code to pair 1 smartphone controller. The simulation launches automatically as soon as the pilot callsign handshakes.
                  </p>
                </div>
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-6 group-hover:translate-x-1.5 transition-transform">
                  Sync & Play &rarr;
                </div>
              </button>

              {/* Multiplayer Lobby */}
              <button
                onClick={() => changeGameMode('lobby')}
                className="group flex flex-col justify-between p-6 rounded-2xl border border-zinc-800/80 hover:border-cyan-500/40 bg-zinc-900/10 hover:bg-zinc-900/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-all duration-300 text-left cursor-pointer"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-950/30 border border-cyan-800/60 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                    👥
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">Multiplayer Lobby</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Host a party room for up to **4 local players**. Show a connection waiting list, check squad readiness, and play side-by-side.
                  </p>
                </div>
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-6 group-hover:translate-x-1.5 transition-transform">
                  Open Waiting Room &rarr;
                </div>
              </button>
            </div>

            <button
              onClick={() => setSelectedGame(null)}
              className="text-xs text-zinc-500 hover:text-white uppercase font-bold tracking-widest transition-colors flex items-center gap-1 cursor-pointer"
            >
              &larr; Back to Game Selection
            </button>
          </div>
        )}

        {/* Connecting to Server Loading State */}
        {gameMode !== 'menu' && gameMode !== 'solo_keyboard' && gameState === 'pairing' && !roomId && !error && (
          <div className="flex flex-col items-center justify-center p-16 bg-zinc-950/80 rounded-3xl border border-cyan-800/50 shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-pulse w-full max-w-2xl mx-auto z-20">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_25px_rgba(6,182,212,0.6)] mb-6" />
            <h2 className="text-xl font-black text-cyan-400 tracking-[0.2em] uppercase mb-2">Connecting to Server</h2>
            <p className="text-zinc-500 text-xs tracking-widest uppercase">Establishing Secure WebSocket Tunnel...</p>
          </div>
        )}

        {/* 2. PAIRING/LOBBY INTERFACES */}
        {gameMode !== 'menu' && gameMode !== 'solo_keyboard' && gameState === 'pairing' && roomId && (
          <div className="flex flex-col lg:flex-row items-center justify-center bg-zinc-950/80 p-8 rounded-3xl border border-zinc-800/80 shadow-[0_0_50px_rgba(168,85,247,0.15)] max-w-4xl w-full mx-auto gap-12 animate-fade-in">
            
            {/* Left Side: Instructions */}
            <div className="flex-1 flex flex-col text-center lg:text-left">
              <h1 className="text-3xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {gameMode === 'solo_remote' ? 'Sync Solo Controller' : 'Open Squadron Room'}
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                {gameMode === 'solo_remote' 
                  ? 'Scan the QR code below to connect your mobile phone. Once paired, your phone will act as the flight stick and the game will start automatically.' 
                  : 'Scan the QR code to join this squadron lobby. Multiple players can join. When your squad is complete, launch the mission!'}
              </p>
              
              {/* Instructions list */}
              <div className="space-y-4 text-sm mb-8 text-left max-w-md mx-auto lg:mx-0">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0">1</span>
                  <p className="text-zinc-300">Connect smartphones to <strong>same Wi-Fi network</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0">2</span>
                  <p className="text-zinc-300">Scan QR code or enter code <strong>{roomId}</strong> on the portal.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0">3</span>
                  <p className="text-zinc-300">
                    {gameMode === 'solo_remote' ? 'Uplink pairs and starts the game instantly.' : 'Wait for friends, then tap Launch.'}
                  </p>
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

            {/* Right Side: QR Code & Waiting Room List */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0a061c] rounded-2xl border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.05)] w-80 shrink-0">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-3">
                {gameMode === 'solo_remote' ? 'Scan to Play' : 'Squad Roster (Max 4)'}
              </div>
              
              {/* QR Code Container */}
              <div className="bg-white p-3 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] mb-3 relative w-[204px] h-[204px] flex items-center justify-center">
                {!qrLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 rounded-xl z-10 border border-cyan-500/50">
                    <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_15px_rgba(6,182,212,0.6)] mb-2" />
                    <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest animate-pulse">Generating</span>
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=050114&data=${encodeURIComponent(controllerUrl)}`} 
                  alt="Pairing QR Code" 
                  width={180}
                  height={180}
                  className={`rounded-lg transition-opacity duration-300 ${qrLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setQrLoaded(true)}
                />
              </div>

              {/* Styled Room Code Display */}
              <div className="mb-5 text-center">
                <span className="text-[8px] text-zinc-500 uppercase tracking-widest block font-bold mb-0.5">Arcade Code</span>
                <span className="text-2xl font-black font-mono tracking-[0.25em] pl-[0.25em] bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent filter drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                  {roomId}
                </span>
              </div>

              {/* Lobby player list (only shown in multiplayer) */}
              {gameMode === 'lobby' && (
                <div className="w-full bg-zinc-950/80 rounded-xl border border-zinc-800/80 p-4 mb-4">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Connected Pilots ({players.length})</div>
                  {players.length === 0 ? (
                    <div className="text-xs text-zinc-600 italic py-2 text-center">Awaiting connections...</div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {players.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#0d0722]/50 border border-zinc-900">
                          <span className="font-bold font-mono" style={{ color: getPlayerColor(p.id) }}>
                            P{p.id}: {p.nickname}
                          </span>
                          <span className="text-[9px] bg-green-950/50 text-green-400 border border-green-900/50 px-1.5 py-0.5 rounded uppercase font-semibold">
                            Ready
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lobby Start Controls */}
              {gameMode === 'lobby' && (
                players.length > 0 ? (
                  <button
                    onClick={startGame}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-95 text-white font-bold tracking-widest uppercase rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse"
                  >
                    🚀 Launch Mission
                  </button>
                ) : (
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider text-center italic py-2">
                    Waiting for at least 1 pilot...
                  </div>
                )
              )}
              {gameMode === 'solo_remote' && (
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider animate-pulse text-center">
                  Awaiting Handshake Sync...
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. ACTIVE GAME PLAYING SCREEN OR GAME OVER */}
        {gameMode !== 'menu' && paired && gameState !== 'pairing' && (
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
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Final Team Score</div>
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

                <div className="flex flex-col items-center gap-4">
                  <>
                    <p className="text-zinc-400 text-sm">
                      Press <strong className="text-cyan-400">RESTART</strong> on any controller to retry.
                    </p>
                    <button
                      onClick={startGame}
                      className="px-4 py-2 border border-zinc-800 rounded-lg hover:border-zinc-700 bg-zinc-950/40 text-xs text-zinc-400 hover:text-white transition-all animate-pulse"
                    >
                      Force Restart from PC
                    </button>
                  </>
                  
                  <button 
                    onClick={resetToMenu}
                    className="text-xs text-zinc-500 hover:text-white underline transition-colors"
                  >
                    Return to Mode Selection
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


