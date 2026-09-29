import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: (import.meta.env.VITE_GEMINI_API_KEY || "").trim().replace(/[^\x20-\x7E]/g, ""),
});

export async function analyzeHardwareImage(image: string, maxRetries = 5, abortSignal?: AbortSignal) {
  if (!image) throw new Error("No image provided");

  const base64Data = image.split(",")[1];
  let result: any;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (abortSignal?.aborted) {
      throw new Error("Analysis aborted by user");
    }
    try {
      if (import.meta.env.VITE_GEMINI_API_KEY) {
        const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim().replace(/[^\x20-\x7E]/g, "");
        const mimeType = image.split(";")[0].split(":")[1] || "image/png";
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `System: You are an expert hardware engineer specializing in network device mapping.
          
Task: Analyze the attached image and identify EVERY physical port (Ethernet/RJ45, SFP, SFP+, Console, USB, Management, etc.).

Precision Requirements:
1. Systematic Scanning: Scan the device systematically from LEFT to RIGHT, taking note of vertical columns. Do not skip any functional ports.
2. Bounding Boxes: Provide the tightest possible [ymin, xmin, ymax, xmax] coordinates (0-1000 scale). The box must strictly encompass the physical rectangular/square opening of the port itself, NOT the space between ports and NOT the printed label.
3. Label Matching: Look for numbers printed directly above, below, or between ports. Separate the port into a "portName" and a "portNumber". The "portName" MUST ALWAYS be in lowercase (e.g., "ethernet", "sfp", "mgmt", "console"). If a port only has a number, use "port" as the name.
4. STRICT IN/OUT (TX/RX) Separation: Many optical ports (like SFP transceivers) consist of two physical connector holes (one for OUT/TX, one for IN/RX) within a single plug or cage. YOU ARE STRICTLY FORBIDDEN from drawing a single large bounding box around the entire transceiver/cage. You MUST draw exactly TWO separate bounding boxes: one strictly around the OUT hole, and one strictly around the IN hole. For the OUT box, set "portName" to the module/slot identifier (e.g., "sfp1", "a1", "sig1" - lowercase) and "portNumber" to "OUT". For the IN box, set "portName" to the same identifier and "portNumber" to "IN".
5. Grid & Stack Logic: Network ports are almost always arranged in stacked blocks (e.g., 2 rows of 12 ports). Commonly, the TOP port in a column is an ODD number (1, 3, 5) and the BOTTOM port is an EVEN number (2, 4, 6). Carefully follow this logical numerical progression to avoid mislabeling.
6. Verification: Double-check that boxes do not heavily overlap unless they are stacked. Ensure the total number of ports matches standard configurations (e.g., 8, 16, 24, 48 ports).

Return the data in this JSON format:
{
  "analysis": "Brief technical description of the device (MUST be written in natural Korean language. Do NOT add spaces between every letter. Use standard word spacing 띄어쓰기.)",
  "modelName": "Identified device model name (e.g. Cisco Catalyst 9300)",
  "ports": [
    { "portName": "string", "portNumber": "string", "box_2d": [ymin, xmin, ymax, xmax] }
  ]
}`
                  },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  analysis: { type: "STRING" },
                  modelName: { type: "STRING" },
                  ports: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        portName: { type: "STRING" },
                        portNumber: { type: "STRING" },
                        box_2d: { type: "ARRAY", items: { type: "NUMBER" } }
                      },
                      required: ["portName", "portNumber", "box_2d"]
                    }
                  }
                },
                required: ["analysis", "modelName", "ports"]
              }
            }
          }),
          signal: abortSignal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error("No text response from model");
        }

        if (abortSignal?.aborted) throw new Error("Analysis aborted by user");
        let cleanJson = data.candidates[0].content.parts[0].text;
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanJson = jsonMatch[0];
        try {
          result = JSON.parse(cleanJson);
        } catch (e) {
          console.error("Failed to parse JSON:", cleanJson);
          throw new Error("Invalid JSON format from model");
        }
      } else {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image }),
          signal: abortSignal
        });

        if (abortSignal?.aborted) throw new Error("Analysis aborted by user");

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `Server returned error (${response.status}). Please check server configuration.`
          );
        }

        result = await response.json();
      }

      if (abortSignal?.aborted) throw new Error("Analysis aborted by user");
      return result;

    } catch (err: any) {
      lastError = err;
      const isRateLimit = err.message?.toLowerCase().includes("too many requests") || 
                          err.message?.includes("429") ||
                          err.message?.includes("500") ||
                          err.message?.toLowerCase().includes("quota");
                          
      if (attempt < maxRetries) {
        // Wait longer if it's a rate limit error (exponential backoff)
        const delay = isRateLimit ? 10000 * attempt : 2000 * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
