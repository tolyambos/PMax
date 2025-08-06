import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// Define Zod schemas for strict type validation
const SceneSchema = z.object({
  sceneNumber: z.number(),
  description: z.string(),
  duration: z.number(),
});

const ScenesResponseSchema = z.object({
  scenes: z.array(SceneSchema),
});

export class OpenAIService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "chatgpt-4o-latest", // Use the latest model
      temperature: 0.7,
    });
  }

  /**
   * Create a completion using the OpenAI API
   * @param options Options for the completion request
   * @returns The completion response
   */
  async createCompletion(options: {
    model?: string;
    prompt: string;
    temperature?: number;
    max_tokens?: number;
  }) {
    try {
      const { prompt, temperature = 0.7, max_tokens = 1000 } = options;

      // Call OpenAI with the prompt
      const response = await this.model.invoke(prompt);

      // Return in a format similar to OpenAI's completions API
      return {
        choices: [
          {
            text: response.content.toString(),
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: prompt.length / 4,
          completion_tokens: response.content.toString().length / 4,
          total_tokens:
            (prompt.length + response.content.toString().length) / 4,
        },
      };
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      throw error;
    }
  }

  async generateSceneDescriptions(prompt: string, numScenes: number = 3) {
    try {
      // Ensure number of scenes is within valid range
      numScenes = Math.max(1, Math.min(5, numScenes));

      // Create a parser based on the Zod schema
      const parser = StructuredOutputParser.fromZodSchema(ScenesResponseSchema);

      // Get the format instructions
      const formatInstructions = parser.getFormatInstructions();

      // Create prompt template with more specific instructions
      const promptTemplate = PromptTemplate.fromTemplate(`
        You are an AI assistant that helps create detailed scene descriptions for video production.
        For each scene, provide a clear, vivid description focusing on visual elements, camera angles, and mood.
        
        Create exactly {num_scenes} distinct scene descriptions for a short promotional video with the following concept:
        "{concept}"
        
        Each scene should be visually stunning and work well as a frame in a video.
        Vary the scenes to show different aspects and perspectives.
        
        For each scene, suggest a duration between 2-10 seconds that would work well for that visual.
        
        {format_instructions}
      `);

      // Format the prompt with our variables
      const formattedPrompt = await promptTemplate.format({
        num_scenes: numScenes,
        concept: prompt,
        format_instructions: formatInstructions,
      });

      // Call the LLM
      const result = await this.model.invoke(formattedPrompt);

      // Parse the structured output
      try {
        const parsedOutput = await parser.parse(result.content.toString());
        return parsedOutput.scenes;
      } catch (parseError) {
        console.error("Error parsing scene descriptions:", parseError);

        // If parsing fails, try to extract JSON from the response
        const responseText = result.content.toString();
        if (responseText.includes("{") && responseText.includes("}")) {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const jsonData = JSON.parse(jsonMatch[0]);
              if (jsonData.scenes && Array.isArray(jsonData.scenes)) {
                return jsonData.scenes;
              }
            } catch (err) {
              console.error("Failed to extract JSON:", err);
            }
          }
        }

        // Return empty array if all parsing fails
        return [];
      }
    } catch (error) {
      console.error("Error generating scene descriptions:", error);
      return [];
    }
  }

  async generateVoiceoverScript(prompt: string, duration: number) {
    try {
      // Create prompt template
      const promptTemplate = PromptTemplate.fromTemplate(`
        You are an AI assistant that creates professional voiceover scripts for marketing videos.
        Create a concise, engaging script that fits within the specified duration.
        
        Write a {duration}-second voiceover script for a video about: "{concept}".
        The script should be approximately {word_count} words long (about 150 words per minute).
        Format the response as plain text, ready to be read by a voice actor.
      `);

      // Format the prompt with our variables
      const formattedPrompt = await promptTemplate.format({
        duration: duration,
        concept: prompt,
        word_count: Math.round(duration * 2.5),
      });

      // Call the LLM
      const result = await this.model.invoke(formattedPrompt);

      return result.content.toString();
    } catch (error) {
      console.error("Error generating voiceover script:", error);
      return "";
    }
  }

  async analyzeVideoContent(videoPrompt: string, analysisPrompt?: string) {
    try {
      // Use provided analysis prompt if available, otherwise create a default one
      let formattedPrompt;

      if (analysisPrompt) {
        formattedPrompt = analysisPrompt;
      } else {
        // Create prompt template
        const promptTemplate = PromptTemplate.fromTemplate(`
          You are an AI video content expert. Analyze the video prompt and suggest improvements.
          
          Video prompt: {prompt}
          
          Provide a concise analysis with specific suggestions for improvement.
        `);

        // Format the prompt
        formattedPrompt = await promptTemplate.format({
          prompt: videoPrompt,
        });
      }

      // Call the LLM with a lower temperature for more factual responses
      const analyzeModel = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "gpt-4o", // Use the latest model
        temperature: 0.3,
        maxTokens: 500,
      });

      const result = await analyzeModel.invoke(formattedPrompt);

      return result.content.toString();
    } catch (error) {
      console.error("Error analyzing video content:", error);
      return "Unable to analyze video content at this time.";
    }
  }
}

export const openAIService = new OpenAIService();
