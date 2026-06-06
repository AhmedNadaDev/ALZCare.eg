import torch
import sounddevice as sd
import numpy as np
import time
import os
from collections import deque, Counter

from model import EmotionModel, feature_extractor, extract_mfcc


# ======================
# CONFIG
# ======================
device = torch.device("cpu")
SR = 16000

labels = ["neutral", "happy", "sad", "angry", "fear", "disgust", "surprise", "bored"]

# short-term + long-term memory
live_history = deque(maxlen=9)
final_history = []


# ======================
# LOAD MODEL (SAFE)
# ======================
def load_model():
    print("🔄 Loading model...")

    model = EmotionModel().to(device)

    paths = [
        "models/best.pt",
        "models/last.pt",
        "models/emotion_model.pt"
    ]

    model_path = next((p for p in paths if os.path.exists(p)), None)

    if model_path is None:
        raise FileNotFoundError("❌ No model found in models folder")

    print(f"📦 Using: {model_path}")

    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state, strict=True)

    model.eval()
    print("✅ Model ready\n")

    return model


model = load_model()


# ======================
# RECORD AUDIO
# ======================
def record_audio(duration=3):
    print("🎤 Listening... (3 sec window)")

    audio = sd.rec(int(duration * SR),
                   samplerate=SR,
                   channels=1,
                   dtype="float32")

    sd.wait()
    audio = audio.flatten()

    # silence check (better version)
    if np.mean(np.abs(audio)) < 0.002:
        print("🔇 Silence detected")
        return None

    audio = audio / (np.max(np.abs(audio)) + 1e-6)

    return audio


# ======================
# PREDICT
# ======================
def predict(audio):
    audio = np.ascontiguousarray(audio, dtype=np.float32)

    inputs = feature_extractor(
        audio,
        sampling_rate=SR,
        return_tensors="pt",
        padding=True
    )

    mfcc = extract_mfcc(audio, SR)
    mfcc = torch.tensor(mfcc).float().unsqueeze(0)

    with torch.inference_mode():
        out = model(inputs["input_values"], mfcc)
        probs = torch.softmax(out / 1.7, dim=1)[0]

    idx = torch.argmax(probs).item()

    # live smoothing
    live_history.append(idx)

    live_final = Counter(live_history).most_common(1)[0][0]

    return live_final, probs[live_final].item(), probs


# ======================
# FINAL DECISION (HYBRID)
# ======================
def final_decision():
    if len(final_history) == 0:
        return None

    # weighted voting (advanced)
    score = np.zeros(len(labels))

    for idx, conf in final_history:
        score[idx] += conf

    final = int(np.argmax(score))
    confidence = float(score[final] / len(final_history))

    return final, confidence


# ======================
# MAIN LOOP
# ======================
if __name__ == "__main__":

    print("🎧 HYBRID Emotion Detection Started")
    print("Live + Final Decision System")
    print("CTRL + C to stop\n")

    start_time = time.time()

    try:
        while True:

            audio = record_audio(duration=3)
            if audio is None:
                continue

            idx, conf, probs = predict(audio)

            final_history.append((idx, conf))

            # LIVE OUTPUT
            print(f"🎯 LIVE: {labels[idx]} | Conf: {conf:.2f}")

            # FINAL OUTPUT every 12 sec
            if time.time() - start_time >= 12:

                result = final_decision()

                if result:
                    f_idx, f_conf = result

                    print("\n🏁 FINAL RESULT")
                    print(f"🎯 Emotion: {labels[f_idx]}")
                    print(f"📊 Confidence: {f_conf:.2f}")
                    print("-" * 50)

                # reset for next window
                final_history.clear()
                live_history.clear()
                start_time = time.time()

            time.sleep(0.2)

    except KeyboardInterrupt:
        print("\n🛑 Stopped safely")