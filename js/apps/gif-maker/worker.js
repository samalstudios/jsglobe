import { encodeGif } from '../../lib/gif.js';

// Each picture arrives once; the order says which to show when and for how
// long, so playing forwards then backwards does not send every picture twice.
self.onmessage = ({ data: { images, order, width, height, options } }) => {
  try {
    const frames = order.map(({ index, delay }) => ({ data: images[index], delay }));
    let told = 0;
    const bytes = encodeGif(frames, width, height, {
      ...options,
      onProgress: (share) => {
        if (share - told < 0.02 && share < 1) return;
        told = share;
        self.postMessage({ progress: share });
      },
    });
    self.postMessage({ bytes }, [bytes.buffer]);
  } catch (failure) {
    self.postMessage({ error: failure.message });
  }
};
