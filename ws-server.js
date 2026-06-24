const { WebSocketServer } = require('ws');

const port = process.env.PORT || 3001;

const wss = new WebSocketServer({ port }, () => {
  console.log(`🚀 WebSocket server running on port ${port}`);
});

// Store rooms: roomId -> { hostSocket, guestSocket }
const rooms = new Map();

// Generate a random 4-digit numeric room code that doesn't conflict
function generateRoomId() {
  let roomId;
  do {
    roomId = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(roomId));
  return roomId;
}

wss.on('connection', (ws) => {
  let userRole = null; // 'host' or 'guest'
  let userRoomId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'host':
          // Set up a new game session
          userRoomId = generateRoomId();
          userRole = 'host';
          rooms.set(userRoomId, { hostSocket: ws, guestSocket: null });
          
          ws.send(JSON.stringify({ type: 'room_created', roomId: userRoomId }));
          console.log(`🎮 Game Host created room: ${userRoomId}`);
          break;

        case 'join':
          // Mobile controller joins a game session
          const targetRoomId = data.roomId?.toString();
          const room = rooms.get(targetRoomId);

          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found. Check the code!' }));
            console.log(`❌ Join failed: Room ${targetRoomId} not found`);
            break;
          }

          if (room.guestSocket) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room already has a controller paired.' }));
            console.log(`❌ Join failed: Room ${targetRoomId} already occupied`);
            break;
          }

          // Pair them
          userRole = 'guest';
          userRoomId = targetRoomId;
          room.guestSocket = ws;

          // Notify both parties that they are paired
          room.hostSocket.send(JSON.stringify({ type: 'paired' }));
          ws.send(JSON.stringify({ type: 'paired', roomId: userRoomId }));
          console.log(`📱 Mobile Controller paired to room: ${userRoomId}`);
          break;

        default:
          // Relay message to the partner
          const activeRoom = rooms.get(userRoomId);
          if (!activeRoom) break;

          if (userRole === 'host' && activeRoom.guestSocket) {
            // Forward state/status updates from the PC game to the mobile controller
            activeRoom.guestSocket.send(message.toString());
          } else if (userRole === 'guest' && activeRoom.hostSocket) {
            // Forward touch/joystick inputs from the mobile controller to the PC game
            activeRoom.hostSocket.send(message.toString());
          }
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (userRoomId && rooms.has(userRoomId)) {
      const room = rooms.get(userRoomId);

      if (userRole === 'host') {
        // Host disconnected: notify controller and shut down room
        console.log(`🎮 Game Host disconnected from room: ${userRoomId}`);
        if (room.guestSocket) {
          room.guestSocket.send(JSON.stringify({ type: 'host_disconnected' }));
        }
        rooms.delete(userRoomId);
      } else if (userRole === 'guest') {
        // Guest disconnected: notify host and empty guest slot
        console.log(`📱 Mobile Controller disconnected from room: ${userRoomId}`);
        room.guestSocket = null;
        if (room.hostSocket) {
          room.hostSocket.send(JSON.stringify({ type: 'guest_disconnected' }));
        }
      }
    }
  });
});
