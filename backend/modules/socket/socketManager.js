/**
 * socketManager.js
 *
 * Single-instance holder for the Socket.IO server.
 * Import { getIO, initIO, emitToPatientRoom } wherever you need sockets.
 *
 * Room convention:
 *   patient:{patientId}  — joined by both the patient client and their family client
 */

import { Server } from 'socket.io';

let _io = null;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
];

/**
 * Initialise Socket.IO on an existing http.Server.
 * Must be called ONCE from server.js before any emits.
 */
export const initIO = (httpServer) => {
  _io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  _io.on('connection', (socket) => {
    console.log(`[Socket] client connected: ${socket.id}`);

    // Client sends { patientId } immediately after connecting
    socket.on('join:patient-room', ({ patientId } = {}) => {
      if (!patientId) return;
      const room = `patient:${patientId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room ${room}`);
      socket.emit('room:joined', { room, patientId });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ${socket.id} disconnected — ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket] error on ${socket.id}:`, err);
    });
  });

  console.log('[Socket] Socket.IO server initialised');
  return _io;
};

/** Return the io instance. Returns null if not yet initialised (safe to call). */
export const getIO = () => _io;

/**
 * Emit a named event to everyone in a patient's room.
 * Silently no-ops if socket server is not yet ready.
 *
 * @param {string} patientId
 * @param {string} eventName  e.g. 'dailyPlan:updated', 'event:trigger'
 * @param {object} payload    merged with { patientId } automatically
 */
export const emitToPatientRoom = (patientId, eventName, payload = {}) => {
  if (!_io || !patientId) return;
  const room = `patient:${patientId}`;
  _io.to(room).emit(eventName, { patientId: patientId.toString(), ...payload });
  console.log(`[Socket] emit "${eventName}" → room ${room}`);
};

/**
 * Push a notification document to the patient room in real-time.
 * The family dashboard listens for 'notification:new' and updates its badge.
 *
 * @param {string} patientId  ObjectId of the patient (room key)
 * @param {object} notification  Plain Notification document (toObject() result)
 */
export const emitNotification = (patientId, notification) => {
  emitToPatientRoom(patientId, 'notification:new', { notification });
};
