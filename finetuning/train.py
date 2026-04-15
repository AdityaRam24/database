import torch
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
import os

print("1. Loading Qwen2.5-Coder Model...")
# Load the model in 4-bit to save massive amounts of VRAM!
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/Qwen2.5-Coder-7B-Instruct",
    max_seq_length = 2048,
    dtype = None,
    load_in_4bit = True,
)

print("2. Adding LoRA Adapters...")
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, # Rank of adaptation
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                      "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

print("3. Formatting Dataset...")
# Ensure your dataset.jsonl is in the same directory
dataset = load_dataset("json", data_files="dataset.jsonl", split="train")

def format_prompts(examples):
    instructions = examples["instruction"]
    inputs       = examples["input"]
    outputs      = examples["output"]
    texts = []
    
    # Qwen uses <|im_start|> and <|im_end|> for its chat template
    for instruction, input, output in zip(instructions, inputs, outputs):
        text = f"<|im_start|>system\n{instruction}<|im_end|>\n<|im_start|>user\n{input}<|im_end|>\n<|im_start|>assistant\n{output}<|im_end|>"
        texts.append(text)
    return { "text" : texts }

dataset = dataset.map(format_prompts, batched = True)

print("4. Starting SFT Trainer...")
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = 2048,
    dataset_num_proc = 2,
    packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60, # Change to num_train_epochs = 1 for a full real run!
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

trainer.train()

print("5. Exporting to GGUF for Ollama...")
# This automatically merges the adapter and outputs a Q4_K_M GGUF file!
model.save_pretrained_gguf("dblighthouse", tokenizer, quantization_method = "q4_k_m")

print("Training & Export Complete! You will find your .gguf file in this directory.")
