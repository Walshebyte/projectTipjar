// Gemini API implementation
import fetch from 'node-fetch';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text?: string;
      }[];
    };
  }[];
}

interface GeminiError {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  }
}

/**
 * Analyze an image using Google Gemini API to extract text
 * @param imageBase64 The base64-encoded image data
 * @returns An object with extracted text or error details
 */
export async function analyzeImage(imageBase64: string): Promise<{text: string | null; error?: string}> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    
    if (!apiKey) {
      console.error("No Gemini API key provided");
      return { 
        text: null,
        error: "API key missing. Please configure the Gemini API key." 
      };
    }
    
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    
    const promptText = `
      Extract ALL TEXT from this image first. Then identify and extract ALL partner names and their tippable hours from the text.
      
      Look for patterns indicating partner names followed by hours, such as:
      - "Name: X hours" or "Name: Xh"
      - "Name - X hours"
      - "Name (X hours)"
      - Any text that includes names with numeric values that could represent hours
      
      Return EACH partner's full name followed by their hours, with one partner per line.
      Format the output exactly like this:
      John Smith: 32
      Maria Garcia: 24.5
      Alex Johnson: 18.75
      
      Make sure to include ALL partners mentioned in the image, not just the first one.
      If hours are not explicitly labeled, look for numeric values near names that could represent hours.
    `;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: promptText
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
      }
    };
    
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to call Gemini API";
      
      try {
        const errorData = JSON.parse(errorText) as GeminiError;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
          // Hide the API key if it's in the error message
          errorMessage = errorMessage.replace(/api_key:[a-zA-Z0-9-_]+/, "api_key:[REDACTED]");
        }
      } catch (e) {
        // If error parsing fails, use the generic message
      }
      
      console.error("Gemini API error:", response.status, errorText);
      return { 
        text: null, 
        error: `API Error (${response.status}): ${errorMessage}`
      };
    }
    
    const data = await response.json() as GeminiResponse;
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error("No candidates in Gemini response");
      return { 
        text: null,
        error: "No text extracted from the image. Try a clearer image or manual entry."
      };
    }
    
    const extractedText = data.candidates[0].content.parts
      .map(part => part.text)
      .filter(Boolean)
      .join("\n");
    
    if (!extractedText) {
      return { 
        text: null,
        error: "No text extracted from the image. Try a clearer image or manual entry."
      };
    }
    
    return { text: extractedText };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { 
      text: null,
      error: "An unexpected error occurred while processing the image."
    };
  }
}
