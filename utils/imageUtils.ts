export const compressImage = (file: File, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getDirectDriveUrl = (url?: string) => {
  if (!url || typeof url !== 'string' || url === 'pendente' || url === 'Pendente' || url === '[object Object]') return '';
  if (url.startsWith('data:')) return url;
  
  // Check for common Drive URL patterns
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    // Extract ID (it's usually a string of 25-50 characters including letters, numbers, underscores and hyphens)
    const idMatch = url.match(/[-\w]{25,50}/);
    if (idMatch) {
      // The 'uc' endpoint is the traditional direct link endpoint
      // Added sz=w1000 to encourage high-res thumbnail if available, though uc doesn't support it directly, 
      // sometimes it helps bypassing certain redirect blocks.
      return `https://drive.google.com/uc?id=${idMatch[0]}`;
    }
  }
  
  return url;
};
