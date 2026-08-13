const channels = new Map();

export const bus = {
  on(type, handler) {
    if (!channels.has(type)) channels.set(type, new Set());
    channels.get(type).add(handler);
    return () => bus.off(type, handler);
  },

  off(type, handler) {
    channels.get(type)?.delete(handler);
  },

  emit(type, detail) {
    channels.get(type)?.forEach((handler) => handler(detail));
    channels.get('*')?.forEach((handler) => handler({ type, detail }));
  },
};
