async function inlineImagesInSvg(svgRaw: string): Promise<string> {
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
    // Create a data URL from the SVG string
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(inlinedSvg)))}`;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale up the canvas for higher resolution if needed, but we stick to original size for now
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        return reject(new Error("Failed to get 2D context"));
      }
      
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      try {
        const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
        resolve(webpDataUrl);
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = (err) => {
      reject(err);
    };
    
    img.src = svgDataUrl;
  });
}
