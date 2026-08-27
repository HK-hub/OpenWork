export type ChatSendAck = {
  ok: boolean;
  error?: { code: string; message: string };
};

type ChatSocket = {
  emit: (event: 'chat.send', payload: unknown, callback: (ack: ChatSendAck) => void) => void;
};

export function sendChat(socket: ChatSocket, payload: unknown) {
  return new Promise<ChatSendAck>((resolve) => socket.emit('chat.send', payload, resolve));
}
