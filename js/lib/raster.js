const load = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That picture could not be read'));
    image.src = source;
  });

export const drawTo = (image, width, height, background) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export async function toJpeg(source, options = {}) {
  const image = typeof source === 'string' ? await load(source) : source;
  const natural = { width: image.naturalWidth ?? image.width, height: image.naturalHeight ?? image.height };
  if (!natural.width || !natural.height) throw new Error('That picture has no size');

  const cap = options.maxWidth ?? 1600;
  const scale = Math.min(1, cap / natural.width);
  const canvas = drawTo(image, natural.width * scale, natural.height * scale, options.background ?? '#ffffff');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', options.quality ?? 0.86));
  if (!blob) throw new Error('That picture could not be encoded');

  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
    ratio: natural.height / natural.width,
  };
}

export async function toPng(source, options = {}) {
  const image = typeof source === 'string' ? await load(source) : source;
  const natural = { width: image.naturalWidth ?? image.width, height: image.naturalHeight ?? image.height };
  const cap = options.maxWidth ?? 1600;
  const scale = Math.min(1, cap / natural.width);
  const canvas = drawTo(image, natural.width * scale, natural.height * scale, options.background);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

export const measure = async (source) => {
  const image = await load(source);
  return { width: image.naturalWidth, height: image.naturalHeight };
};
