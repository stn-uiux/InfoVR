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
        console.error("Failed to inline image, removing to prevent hanging:", href, err);
        // Remove the image element completely so the browser doesn't try to load it and hang
        img.remove();
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
      try {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL("image/webp", 0.9);
        resolve(dataUrl);
      } catch (err) {
        console.error("Canvas toDataURL failed:", err);
        // Fallback to resolving with the SVG data URL if canvas fails
        resolve(svgDataUrl);
      }
    };
    
    img.onerror = (e) => {
      console.error("SVG Image load failed:", e);
      // Fallback to the SVG itself so the UI doesn't break
      resolve(svgDataUrl);
    };
    
    img.src = svgDataUrl;
  });
}
