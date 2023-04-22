#!/usr/bin/env node

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { question } from "readline-sync";
import { Request } from "zeromq"
import { join } from "path";

import Config from "./config";

interface Message {
  author: string; // The author of the message
  content: string; // The content of the message
}

interface Chat {
  initializer: Message; // The initial message that initializes the chat
  messages: Message[]; // An array of messages in the chat
}

const pythonScriptPath = join(__dirname, "model.py");
let modelProcess: ChildProcessWithoutNullStreams;
let chat: Chat = { initializer: { author: "", content: "" }, messages: [] };

// tokenizing variables
let initializerLength = 0;

async function main() {
  // Load the config file
  Config.load();

  // Create the chat object
  chat.messages = [];
  chat.initializer = { author: "Initial Prompt: ", content: Config.Data.initializer };
  initializerLength = chat.initializer.author.length + chat.initializer.content.length + 1; // +1 for the newline

  // Start the model process
  modelProcess = spawn("python", [
    pythonScriptPath,
    Config.Data.modelPath,
    Config.Data.modelProcessPort.toString(),
    Config.Data.maxInputLength.toString(),
    Config.Data.maxOutputLength.toString(),
    Config.Data.temperature.toString(),
  ]);

  // log the model process output and errors
  modelProcess.stdout.on("data", (data) => {
    console.log(data.toString());
  });
  modelProcess.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  // wait 5 seconds
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Create a new request socket and connect to the model process
  const request = new Request();
  request.connect(`tcp://localhost:${Config.Data.modelProcessPort}`);

  // Send a message to load the model
  console.log("Loading model, this may take a few minutes...");
  await request.send("LOAD,uwu");

  // Wait for the model to load
  const responseRaw = await request.receive();
  const parsedResponse = JSON.parse(responseRaw.toString());

  if (parsedResponse.type === "status" && parsedResponse.message === "loaded") {
    console.log("Successfully loaded model.");
  } else {
    throw new Error("Failed to load model.");
  }

  // Get input from the user
  while (true) {
    const prompt = question('Enter a message ("exit" to quit): ');

    // check if the user wants to exit
    if (prompt === "exit") {
      // send the exit message to the model
      await request.send("exit,uwu");
      return;
    }

    // add the prompt to the chat
    chat.messages.push({ author: Config.Data.userName, content: prompt });

    // serialize the chat
    let lastCounted = "";
    let currentMessageIndex = chat.messages.length;
    let currentCounted =
      `${chat.initializer.author}${chat.initializer.content}
      ${chat.messages[currentMessageIndex - 1].author}${chat.messages[currentMessageIndex - 1].content}
      ${Config.Data.modelName}`;
    while (currentMessageIndex >= -1) {
      // send the message to the model
      await request.send(`TOKENIZE,${currentCounted}`);
      const responseRaw = await request.receive();
      const parsedResponse = JSON.parse(responseRaw.toString());

      // if the message type is an error, throw an error
      if (parsedResponse.type === "error") {
        throw new Error(parsedResponse.message);
      }

      // if the message is too long, break out of the loop and start generation with lastCounted
      if (parsedResponse.maxLengthExceeded === true) { break; }
      // decrement the currentMessageIndex
      currentMessageIndex--;
      // else insert the next message and continue
      if (currentMessageIndex !== -1) {
        lastCounted = currentCounted;
        let nextMessage = `${chat.messages[currentMessageIndex].author}${chat.messages[currentMessageIndex].content}`;
        // insert the next message into the currentCounted string at the correct position (after the initializer)
        currentCounted = `${currentCounted.slice(0, initializerLength)}${nextMessage}${currentCounted.slice(initializerLength)}`;
      } else {
        lastCounted = currentCounted;
        break;
      }
    }

    // check if lastCounted is empty
    if (lastCounted === "") {
      console.log("Message too long, please try again.");
      continue;
    }

    // send the message to the model
    await request.send(`GENERATE,${lastCounted}`);
    const responseRaw = await request.receive();
    const parsedResponse = JSON.parse(responseRaw.toString());

    // if the message type is an error, throw an error
    if (parsedResponse.type === "error") {
      throw new Error(parsedResponse.message);
    }

    // add the generated message to the chat
    chat.messages.push({ author: Config.Data.modelName, content: parsedResponse.message });
    console.log(`${Config.Data.modelName}: ${parsedResponse.message}`);
  }
}

// Terminate the child process when the Node.js process exits or encounters an error
function cleanUp() {
  if (modelProcess) {
    modelProcess.kill();
  }
}

// Handle process exit events
process.on("exit", cleanUp);
process.on("SIGINT", cleanUp);
process.on("SIGUSR1", cleanUp);
process.on("SIGUSR2", cleanUp);
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  cleanUp();
  process.exit(1);
});

async function run() {
  try {
    await main();
    cleanUp();
  } catch (error) {
    console.error(error);
    cleanUp();
    process.exit(1);
  }
}

run();
