import zmq
import json
import argparse
from transformers import AutoModelForCausalLM, AutoTokenizer

# Parse command line arguments
parser = argparse.ArgumentParser()
parser.add_argument("model_path", help="Path to the pretrained model")
parser.add_argument("port", type=int, help="Port to listen on")
parser.add_argument("max_input_tokens", type=int, help="Maximum number of tokens in the input")
parser.add_argument("max_new_tokens", type=int, help="Maximum number of new tokens to generate")
parser.add_argument("temperature", type=float, help="Sampling temperature")
args = parser.parse_args()

# Initialize ZeroMQ context and sockets
context = zmq.Context()
socket = context.socket(zmq.REP)
socket.bind(f"tcp://*:{args.port}")

# Create the model and tokenizer variables
loaded = False
tokenizer = None
model = None
max_input_length = None

def generate(prompt):
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
    tokens = model.generate(
        **inputs,
        max_new_tokens=args.max_new_tokens,
        temperature=args.temperature,
        do_sample=True,
    )
    generated_text = tokenizer.decode(tokens[0], skip_special_tokens=True)
    return generated_text

while True:
    command_string = socket.recv_string()

    # Parse the command and payload
    if not command_string:
        continue
    command, payload = command_string.split(',', 1)
    if command == "exit":
        break
    
    elif command == "LOAD":
        tokenizer = AutoTokenizer.from_pretrained(args.model_path)
        model = AutoModelForCausalLM.from_pretrained(args.model_path)
        model.half().cuda()
        max_input_length = min(args.max_input_tokens, model.config.max_position_embeddings)
        loaded = True
        response = { "type": "status", "message": "loaded" }

    elif command == "TOKENIZE":
        token_count = len(tokenizer(payload, return_tensors="pt").input_ids[0])
        response = { "type": "tokenize", "maxLengthExceeded": token_count > max_input_length }

    elif command == "GENERATE":
        generated_text = generate(payload)
        response = { "type": "generate", "message": generated_text }

    else:
        response = { "type": "error", "message": f"Unknown command: {command}" }

    socket.send_string(json.dumps(response))
