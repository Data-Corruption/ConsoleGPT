import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

interface ConfigInterface {
  modelPath: string; // Path to the model directory
  maxInputLength: number; // Maximum number of tokens to send to the model at once. Will be overridden by model if it's config has a lower one (default: 1024)
  maxOutputLength: number; // Maximum number of tokens to generate for each response (default: 1024)
  temperature: number; // Temperature for the model (default: 0.7)
  initializer: string; // Initial prompt for the model (default is big see file for more info)
  modelProcessPort: number; // Port to use for the model process (default: 5000)
}

const defaultConfig: ConfigInterface = {
  modelPath: "",
  maxInputLength: 1024,
  maxOutputLength: 1024,
  temperature: 0.7,
  initializer: "You are ConsoleGPT. You are an AI that can talk to people through a terminal. You are talking to a user through a terminal.",
  modelProcessPort: 5000,
};

const configPath = join(__dirname, "..", "config.json");

export default class Config {
  public static Data: ConfigInterface;

  public static load() {
    if (existsSync(configPath)) {
      try {
        const loadedConfig = JSON.parse(readFileSync(configPath, "utf-8"));
        this.Data = { ...defaultConfig, ...loadedConfig }; // merge default config with loaded config
      } catch (error) {
        throw new Error(`Issue loading config file: ${error}`);
      }
    } else {
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));
      console.log(`Generated config.json at ${configPath}. Please fill in the required fields before restarting.`);
      process.exit(0);
    }
  }

  public static save() {
    writeFileSync(configPath, JSON.stringify(this.Data, null, 4));
  }
}
