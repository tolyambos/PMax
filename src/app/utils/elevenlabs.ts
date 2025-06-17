import { createHash } from "crypto";

interface TextWithTimestampsResponse {
  audio_base64: string;
  alignment: any;
  normalized_alignment: any;
}

interface GenerateSpeechOptions {
  voiceId: string;
  text: string;
  voiceSpeed?: number;
}

export class ElevenLabsService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || "";
  }

  private getTextHash(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  async generateSpeech(options: GenerateSpeechOptions): Promise<{
    audio: string;
    alignment: any;
    normalizedAlignment: any;
    requestId?: string;
  }> {
    const { voiceId, text, voiceSpeed = 1.0 } = options;

    // Ensure the speed is within the valid range
    const normalizedSpeed = Math.max(0.7, Math.min(1.2, voiceSpeed));

    // Generate a unique cache-busting parameter
    const cacheBuster = Date.now().toString();

    // Create a hash of the text content for caching
    const textHash = this.getTextHash(text + normalizedSpeed.toString());

    try {
      // Prepare the request body
      const requestBody = {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
          style: 0.3,
          speed: normalizedSpeed,
          use_speaker_boost: true,
        },
      };

      // Make direct API call to get access to headers
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?cache_buster=${cacheBuster}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
            "X-Text-Hash": textHash,
            "X-Voice-Speed": normalizedSpeed.toString(),
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ElevenLabs API error: ${response.statusText} - ${errorText}`
        );
      }

      const data = (await response.json()) as TextWithTimestampsResponse;
      const requestId = response.headers.get("request-id");

      return {
        audio: data.audio_base64,
        alignment: data.alignment,
        normalizedAlignment: data.normalized_alignment,
        requestId: requestId || undefined,
      };
    } catch (error) {
      console.error("ElevenLabs API Error:", error);
      if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("Unknown error from ElevenLabs API");
      }
    }
  }

  // Get available voices
  async getVoices() {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices;
    } catch (error) {
      console.error("Error fetching voices:", error);
      return [];
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
