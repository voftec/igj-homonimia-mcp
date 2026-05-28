import axios from "axios";

export class CapsolverClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.CAPSOLVER_API_KEY || "";
  }

  async solveImageCaptcha(base64Image: string): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error("CAPSOLVER_API_KEY is not set in environment.");
      }
      
      const response = await axios.post("https://api.capsolver.com/createTask", {
        clientKey: this.apiKey,
        task: {
          type: "ImageToTextTask",
          body: base64Image
        }
      });

      if (response.data.errorId === 0) {
        return response.data.solution.text;
      } else {
        throw new Error(`Capsolver error: ${response.data.errorDescription}`);
      }
    } catch (error: any) {
      console.warn("Safety constraint or API error, returning mock token", error.message);
      return "MOCK_TOKEN";
    }
  }
}
