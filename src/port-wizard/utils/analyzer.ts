import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: (import.meta.env.VITE_GEMINI_API_KEY || "").trim().replace(/[^\x20-\x7E]/g, ""),
});

export async function analyzeHardwareImage(image: string) {
  if (!image) throw new Error("No image provided");

  const base64Data = image.split(",")[1];
  let result: any;

  if (import.meta.env.VITE_GEMINI_API_KEY) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
4. Grid & Stack Logic: Network ports are almost always arranged in stacked blocks (e.g., 2 rows of 12 ports). Commonly, the TOP port in a column is an ODD number (1, 3, 5) and the BOTTOM port is an EVEN number (2, 4, 6). Carefully follow this logical numerical progression to avoid mislabeling.
5. Verification: Double-check that boxes do not heavily overlap unless they are stacked. Ensure the total number of ports matches standard configurations (e.g., 8, 16, 24, 48 ports).

Return the data in this JSON format:
{
  "analysis": "Brief technical description of the device (MUST be written in natural Korean language. Do NOT add spaces between every letter. Use standard word spacing 띄어쓰기.)",
  "modelName": "Identified device model name (e.g. Cisco Catalyst 9300)",
  "ports": [
    { "portName": "string", "portNumber": "string", "box_2d": [ymin, xmin, ymax, xmax] }
  ]
}`,
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: {
              type: Type.STRING,
              description: "Brief technical summary of detected hardware. MUST be written in natural Korean language. Use standard Korean word spacing (띄어쓰기) and do NOT insert spaces between every single character.",
            },
            modelName: {
              type: Type.STRING,
              description: "The specific hardware model name (e.g. Cisco Catalyst 9300)",
            },
            ports: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  portName: { type: Type.STRING },
                  portNumber: { type: Type.STRING },
                  box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                },
                required: ["portName", "portNumber", "box_2d"],
              },
            },
          },
          required: ["analysis", "modelName", "ports"],
        },
      },
    });

    if (!response.text) {
      throw new Error(
        "The model did not return a response. Please check your connection or try a different image.",
      );
    }

    const cleanJson = response.text.replace(/```json\n?|```/g, "").trim();
    result = JSON.parse(cleanJson);
  } else {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error || `Server returned error (${response.status}). Please check server configuration.`
      );
    }

    result = await response.json();
  }

  return result;
}
