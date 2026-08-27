type SessionSocket = {
  connected: boolean;
  connect: () => void;
  emit: (event: string, payload: unknown) => void;
};

export function joinSessionOrConnect(socket: SessionSocket, sessionId: string, onConnected: () => void) {
  if (socket.connected) {
    socket.emit('session.join', { sessionId });
    onConnected();
    return;
  }
  socket.connect();
}
