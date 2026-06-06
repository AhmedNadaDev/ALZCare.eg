import torch
from datasets import load_dataset
import os

from model import EmotionModel, feature_extractor, extract_mfcc

# ======================
# DATASET (SAFE + FAST)
# ======================
dataset = load_dataset("anton-l/superb_demo", "er", split="session1")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = EmotionModel().to(device)
model.train()

optimizer = torch.optim.AdamW(model.parameters(), lr=3e-5, weight_decay=1e-2)
loss_fn = torch.nn.CrossEntropyLoss(label_smoothing=0.1)

EPOCHS = 30

best_loss = float("inf")

os.makedirs("models", exist_ok=True)

# ======================
# TRAIN LOOP
# ======================
for epoch in range(EPOCHS):
    total_loss = 0

    for sample in dataset:

        audio = sample["audio"]["array"]
        sr = sample["audio"]["sampling_rate"]
        label = torch.tensor(sample["label"]).to(device)

        inputs = feature_extractor(
            audio,
            sampling_rate=sr,
            return_tensors="pt"
        )

        wav = inputs["input_values"].to(device)

        mfcc = torch.tensor(
            extract_mfcc(audio, sr)
        ).float().unsqueeze(0).to(device)

        out = model(wav, mfcc)

        loss = loss_fn(out, label.unsqueeze(0))

        optimizer.zero_grad()
        loss.backward()

        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)

        optimizer.step()

        total_loss += loss.item()

    avg_loss = total_loss / len(dataset)

    print(f"Epoch {epoch+1}/{EPOCHS} | Loss: {avg_loss:.4f}")

    # SAVE BEST ONLY
    if avg_loss < best_loss:
        best_loss = avg_loss
        torch.save(model.state_dict(), "models/best.pt")
        print("🔥 BEST MODEL SAVED")

torch.save(model.state_dict(), "models/last.pt")

print("✅ Training Done")