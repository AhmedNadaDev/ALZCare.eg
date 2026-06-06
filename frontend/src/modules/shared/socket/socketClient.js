/**
 * socketClient.js
 *
 * Singleton Socket.IO client.
 * Import { getSocket, joinPatientRoom, leavePatientRoom } wherever needed.
 *
 * The socket is created lazily on first call to getSocket() and reused.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

let _socket = null;

/** Return (and lazily create) the shared socket instance. */
export const getSocket = () => {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    _socket.on('connect', () => {
      console.log('[Socket] connected:', _socket.id);
    });

    _socket.on('disconnect', (reason) => {
      console.log('[Socket] disconnected:', reason);
    });

    _socket.on('connect_error', (err) => {
      console.warn('[Socket] connection error:', err.message);
    });
  }

  return _socket;
};

/** Join the patient-specific room on the server. */
export const joinPatientRoom = (patientId) => {
  if (!patientId) return;
  const socket = getSocket();
  socket.emit('join:patient-room', { patientId });
  console.log('[Socket] joining room for patient:', patientId);
};

/** Disconnect the socket entirely (call on logout). */
export const disconnectSocket = () => {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
};
