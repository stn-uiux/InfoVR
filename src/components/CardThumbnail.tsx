import React, { useEffect, useState } from "react";

interface CardThumbnailProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  svgUrl?: string;
  svgRaw?: string;
}

const cache = new Map<string, string>();

export const CardThumbnail: React.FC<CardThumbnailProps> = ({ svgUrl, svgRaw, ...props }) => {
  const [dataUrl, setDataUrl] = useState<string>(svgUrl || "");
  const [rawHtml, setRawHtml] = useState<string>("");

  useEffect(() => {
    if (svgRaw) {
      const styleTag = "<style>#ports-layer { display: none !important; }</style>";
      const injected = svgRaw.replace("</svg>", `${styleTag}</svg>`);
      setRawHtml(injected);
      return;
    }

    if (!svgUrl) return;

    if (cache.has(svgUrl)) {
      setDataUrl(cache.get(svgUrl)!);
      return;
    }

    let active = true;
    fetch(svgUrl)
      .then(r => r.text())
      .then(text => {
        if (!active) return;
        const styleTag = "<style>#ports-layer { display: none !important; }</style>";
        const injected = text.replace("</svg>", `${styleTag}</svg>`);
        const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(injected)))}`;
        cache.set(svgUrl, url);
        setDataUrl(url);
      })
      .catch(err => {
        console.error("Failed to inject style into SVG:", err);
        if (active) setDataUrl(svgUrl); // fallback
      });

    return () => { active = false; };
  }, [svgUrl, svgRaw]);

  if (svgRaw) {
    return (
      <div
        style={props.style}
        className={props.className}
        dangerouslySetInnerHTML={{
          __html: rawHtml
            .replace(/width="[^"]*"/, 'width="100%"')
            .replace(/height="[^"]*"/, 'height="100%"')
        }}
      />
    );
  }

  return <img src={dataUrl} {...props} />;
};
