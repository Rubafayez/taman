/**
 * Client-side canvas masking utility for Privacy Guardian.
 * Obscures sensitive readable details (names, phone numbers, labels)
 * on a canvas before uploading.
 */
export async function maskSensitivePhoto(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Define sensitive text band (middle area where badges, text labels, contact stickers usually appear)
      const bandY = Math.round(height * 0.35);
      const bandHeight = Math.round(height * 0.38);

      // Step 1: Pixelate/blur the sensitive region
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCanvas.width = 16;
        tempCanvas.height = 10;
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.drawImage(img, 0, bandY, width, bandHeight, 0, 0, 16, 10);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, 16, 10, 0, bandY, width, bandHeight);
      }

      // Step 2: Overlay a dark frosted privacy block
      ctx.fillStyle = 'rgba(16, 18, 22, 0.78)';
      ctx.fillRect(0, bandY, width, bandHeight);

      // Step 3: Draw amber privacy border
      ctx.strokeStyle = 'rgba(255, 184, 77, 0.45)';
      ctx.lineWidth = Math.max(2, Math.round(width / 260));
      ctx.strokeRect(0, bandY, width, bandHeight);

      // Step 4: Draw privacy badge text
      const fontSize = Math.max(14, Math.round(width / 26));
      ctx.font = `bold ${fontSize}px "IBM Plex Sans Arabic", "Cairo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFB84D';
      ctx.fillText('🔒 تم حجب التفاصيل الحساسة', width / 2, bandY + bandHeight / 2);

      const maskedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(maskedDataUrl);
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}

/**
 * Converts a dataURL string back to a File object.
 */
export function dataUrlToFile(dataUrl: string, filename = 'masked_photo.jpg'): File {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
