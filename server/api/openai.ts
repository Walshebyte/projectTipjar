// OpenAI API implementation - much cheaper alternative to Gemini
interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface OpenAIError {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  }
}

/**
 * Analyze an image using OpenAI GPT-4o-mini to extract text
 * Cost comparison: GPT-4o-mini is ~10x cheaper than Gemini for vision tasks
 * @param imageBase64 The base64-encoded image data
 * @returns An object with extracted text or error details
 */
export async function analyzeImage(imageBase64: string): Promise<{text: string | null; error?: string}> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || "";
    
    if (!apiKey) {
      console.error("No OpenAI API key provided");
      return { 
        text: null,
        error: "API key missing. Please configure the OpenAI API key." 
      };
    }
    
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    
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
      model: "gpt-4o-mini", // Much cheaper than gpt-4-vision-preview
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "low" // Use low detail for even cheaper processing
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.2
    };
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to call OpenAI API";
      
      try {
        const errorData = JSON.parse(errorText) as OpenAIError;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
          // Hide the API key if it's in the error message
          errorMessage = errorMessage.replace(/sk-[a-zA-Z0-9-_]+/, "sk-[REDACTED]");
        }
      } catch (e) {
        // If error parsing fails, use the generic message
      }
      
      console.error("OpenAI API error:", response.status, errorText);
      return { 
        text: null, 
        error: `API Error (${response.status}): ${errorMessage}`
      };
    }
    
    const data = await response.json() as OpenAIResponse;
    
    if (!data.choices || data.choices.length === 0) {
      console.error("No choices in OpenAI response");
      return { 
        text: null,
        error: "No text extracted from the image. Try a clearer image or manual entry."
      };
    }
    
    const extractedText = data.choices[0].message.content;
    
    if (!extractedText) {
      return { 
        text: null,
        error: "No text extracted from the image. Try a clearer image or manual entry."
      };
    }
    
    return { text: extractedText };
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return { 
      text: null,
      error: "An unexpected error occurred while processing the image."
    };
  }
}