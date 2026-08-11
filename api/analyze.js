import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ai) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in the Vercel dashboard environment variables.",
    });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Data = image.split(",")[1];

    // Call Gemini API server-side
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `System: You are an expert hardware engineer specializing in network device mapping.
              
Task: Analyze the attached image and identify EVERY physical port (Ethernet/RJ45, SFP, SFP+, Console, USB, Management, etc.).

Precision Requirements:
1. Bounding Boxes: Provide the tightest possible [ymin, xmin, ymax, xmax] coordinates (0-1000 scale). The box must strictly encompass the physical opening of the port and nothing else.
2. Label Matching: Separate the port into a "portName" and a "portNumber". The "portName" MUST ALWAYS be in lowercase (e.g., "ethernet", "sfp", "mgmt", "console"). If a port only has a number, use "port" as the name. If it only has a name, use "1" as the number or leave it blank if not applicable.
3. Grid Logic: If ports are grouped in a grid (e.g., 24 ports in 2 rows), ensure each individual port is identified. If labels are hard to read, follow the logical progression of the surrounding labels.
4. Completeness: Do not miss any ports. Every functional connector port must be mapped.

Return the data in this JSON format:
{
  "analysis": "Brief technical description of the device",
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
              description: "Brief technical summary of detected hardware",
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
          required: ["analysis", "ports"],
        },
      },
    });

    if (!response.text) {
      return res.status(500).json({ error: "The model did not return a response." });
    }

    const cleanJson = response.text.replace(/```json\n?|```/g, "").trim();
    const result = JSON.parse(cleanJson);
    return res.status(200).json(result);
  } catch (error) {
    console.error("API error during analysis:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
