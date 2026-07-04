const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_JPEG_QUALITY = 0.92;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không thể đọc file ảnh'));
    };
    image.src = url;
  });
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  mimeType: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không thể xử lý ảnh'));
          return;
        }
        resolve(new File([blob], fileName, { type: mimeType }));
      },
      mimeType,
      mimeType === 'image/jpeg' ? AVATAR_JPEG_QUALITY : undefined,
    );
  });
}

/** Center-crop vuông và resize về 512px để avatar hiển thị sắc trên màn Retina. */
export async function prepareAvatarFile(file: File): Promise<File> {
  const image = await loadImageFromFile(file);
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = Math.floor((image.naturalWidth - cropSize) / 2);
  const sy = Math.floor((image.naturalHeight - cropSize) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Không thể xử lý ảnh');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    sx,
    sy,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const extension = outputType === 'image/png' ? '.png' : '.jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';

  return canvasToFile(canvas, `${baseName}${extension}`, outputType);
}
