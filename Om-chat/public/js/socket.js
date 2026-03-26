let socket;

function getRuntimeConfig() {
  return window.__OMCHAT_RUNTIME__ && typeof window.__OMCHAT_RUNTIME__ === 'object'
    ? window.__OMCHAT_RUNTIME__
    : {};
}

export function connectSocket(handlers = {}) {
  if (!socket) {
    const runtime = getRuntimeConfig();
    socket = window.io({
      path: runtime.socketPath || '/socket.io',
      auth: {
        deviceToken: typeof window.getDeviceToken === 'function' ? window.getDeviceToken() : null,
        csrfToken: runtime.csrfToken || ''
      },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
  }

  for (const [event, handler] of Object.entries(handlers)) {
    if (typeof handler === 'function') {
      socket.off(event);
      socket.on(event, handler);
    }
  }

  return socket;
}

export const socketActions = {
  joinServer(payload) {
    socket?.emit('join_server', payload);
  },
  joinChannel(payload) {
    socket?.emit('join_channel', payload);
  },
  sendMessage(payload) {
    socket?.emit('send_message', payload);
  },
  editMessage(payload) {
    socket?.emit('edit_message', payload);
  },
  deleteMessage(payload) {
    socket?.emit('delete_message', payload);
  },
  addReaction(payload) {
    socket?.emit('add_reaction', payload);
  },
  removeReaction(payload) {
    socket?.emit('remove_reaction', payload);
  },
  pinMessage(payload) {
    socket?.emit('pin_message', payload);
  },
  unpinMessage(payload) {
    socket?.emit('unpin_message', payload);
  },
  typingStart(payload) {
    socket?.emit('typing_start', payload);
  },
  typingStop(payload) {
    socket?.emit('typing_stop', payload);
  },
  requestOlderMessages(payload) {
    socket?.emit('request_older_messages', payload);
  },
  updateStatus(payload) {
    socket?.emit('update_status', payload);
  },
  callStart(payload) {
    socket?.emit('call_start', payload);
  },
  callJoin(payload) {
    socket?.emit('call_join', payload);
  },
  callSignal(payload) {
    socket?.emit('call_signal', payload);
  },
  callLeave(payload) {
    socket?.emit('call_leave', payload);
  },
  callMuteToggle(payload) {
    socket?.emit('call_mute_toggle', payload);
  }
};

export function getSocket() {
  return socket;
}
