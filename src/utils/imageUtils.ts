async function inlineImagesInSvg(svgRaw: string): Promise<string> {
  // If there are no images in the SVG, skip DOM parsing entirely to save CPU
  if (!svgRaw.includes('<image')) return svgRaw;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgRaw, "image/svg+xml");
  const images = doc.querySelectorAll("image");
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const href = img.getAttribute("href") || img.getAttribute("xlink:href");
    if (href && !href.startsWith("data:")) {
      try {
        const response = await fetch(href);
        const blob = await response.blob();
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute("href", base64Url);
        img.removeAttribute("xlink:href");
      } catch (err) {
        console.error("Failed to inline image:", href, err);
      }
    }
  }
  
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

export async function convertSvgToPngAsync(svgRaw: string, width: number, height: number): Promise<string> {
  const inlinedSvg = await inlineImagesInSvg(svgRaw);
  return new Promise((resolve, reject) => {
    // Avoid btoa and encodeURIComponent, which block the main thread for large strings
    const blob = new Blob([inlinedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const svgDataUrl = URL.createObjectURL(blob);
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      // Clean up blob URL immediately
      URL.revokeObjectURL(svgDataUrl);
      
      const targetWidth = Math.max(1, Math.round(width / 2));
      const targetHeight = Math.max(1, Math.round(height / 2));

      const canvas = document.createElement("canvas");
      // Reduce the canvas resolution by half to reduce memory and storage
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        return reject(new Error("Failed to get 2D context"));
      }
      
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      try {
        const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
        resolve(webpDataUrl);
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(svgDataUrl);
      reject(err);
    };
    
    img.src = svgDataUrl;
  });
}
