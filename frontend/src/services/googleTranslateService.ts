export async function translateText(text: string, from: string = 'en', to: string = 'vi'): Promise<string> {
  try {
    if (!text.trim()) {
      throw new Error("Please enter some text to translate");
    }

    console.log(`[Google Translate] Translating from ${from} to ${to}: "${text}"`);
    
    const encodedText = encodeURIComponent(text);
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${from}|${to}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      const translatedText = data.responseData.translatedText;
      console.log(`[Google Translate] Success: "${translatedText}"`);
      return translatedText;
    } else {
      throw new Error("Translation failed");
    }
  } catch (error) {
    console.error("[Google Translate] Error:", error);
    throw new Error("Failed to translate text. Please check your internet connection and try again.");
  }
}

export async function translateToVietnamese(text: string): Promise<string> {
  return translateText(text, 'en', 'vi');
}

export async function translateToEnglish(text: string): Promise<string> {
  return translateText(text, 'vi', 'en');
}
