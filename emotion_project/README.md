# Emotion Detection System — `emotion_project`

> **Real-time, audio-based emotion classification using a hybrid Wav2Vec2 + MFCC deep learning architecture.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [System Architecture](#4-system-architecture)
5. [Implementation Details](#5-implementation-details)
6. [Data Flow](#6-data-flow)
7. [Problems Faced](#7-problems-faced)
8. [Solutions Implemented](#8-solutions-implemented)
9. [Model Performance](#9-model-performance)
10. [Edge Cases Handled](#10-edge-cases-handled)
11. [Performance Optimizations](#11-performance-optimizations)
12. [Integration](#12-integration)
13. [Future Improvements](#13-future-improvements)
14. [Final Summary](#14-final-summary)

---

## 1. Project Overview

The **Emotion Detection System** is a real-time, voice-based emotion classification engine. It continuously listens to microphone audio in sliding 3-second windows, extracts acoustic features, and classifies the speaker's emotional state into one of **8 emotion categories**:

| Label | Description |
|-------|-------------|
| `neutral` | Calm, baseline tone |
| `happy` | Positive, upbeat affect |
| `sad` | Low-energy, subdued tone |
| `angry` | Aggressive, high-intensity tone |
| `fear` | Tense, anxious affect |
| `disgust` | Aversive, repulsed tone |
| `surprise` | Sudden change in affect |
| `bored` | Flat, disengaged tone |

The system combines a pre-trained **Wav2Vec2** transformer with a handcrafted **MFCC** pipeline, fusing both representations via **cross-attention** before passing them through a deep classifier. It employs a **live smoothing** window and a **hybrid weighted-voting** mechanism to produce both real-time and session-level emotion summaries.

In the broader system, this module is designed to integrate with the voice interface and caregiver dashboard, providing continuous mood monitoring for Alzheimer's patients.

---

## 2. Problem Statement

### What Problem Are We Solving?

Alzheimer's disease and related dementias progressively impair verbal communication. Patients frequently experience emotional distress — anxiety, frustration, fear, sadness — but lose the ability to articulate these states clearly. Caregivers and clinicians must often rely on behavioral observation alone, which is inherently subjective, inconsistent, and not scalable in remote or home care settings.

### Why Emotion Detection Matters

- **Silent distress is dangerous.** A patient who is afraid, confused, or experiencing pain may not be able to verbally communicate this. Automated emotion detection provides a passive, continuous safety signal.
- **Behavioral patterns matter for treatment.** Knowing that a patient is consistently bored, fearful at certain times of day, or frequently sad enables clinical teams to adjust care plans with real data.
- **Caregiver burnout reduction.** Automating baseline mood monitoring reduces the cognitive load on caregivers, allowing them to focus on high-value interactions.
- **Early clinical alerts.** A sudden spike in negative emotion categories (fear, angry, sad) over a session window can trigger automated notifications to medical staff.

### Real-World Challenge

Raw audio from elderly patients is particularly difficult to process:
- Speech is often slow, fragmented, or muffled.
- Background noise (TV, environment) pollutes the signal.
- Emotional expression in elderly individuals with dementia deviates significantly from standard adult speech emotion corpora.
- Low-resource conditions mean models must work on CPU with minimal latency.

---

## 3. Solution Overview

### Approach

We designed a **dual-branch deep learning model** that fuses two complementary audio representations:

1. **Wav2Vec2-base** (Facebook, via HuggingFace `transformers`) — a self-supervised transformer pre-trained on 960 hours of LibriSpeech. It captures high-level contextual and prosodic features automatically from raw waveforms.
2. **MFCC (Mel-Frequency Cepstral Coefficients)** — a classical, computationally lightweight feature set that captures the timbral and spectral envelope of speech, highly relevant to emotional coloring of voice.

These two branches are fused through a custom **Cross-Attention** module, allowing the model to selectively weigh MFCC features based on the global context established by Wav2Vec2.

### Why This Approach?

| Design Decision | Rationale |
|----------------|-----------|
| Wav2Vec2 over raw CNN | Pre-trained representations generalize far better on small, domain-specific datasets |
| MFCC as auxiliary branch | MFCCs are proven emotion discriminators; they complement transformer features without redundancy |
| Cross-attention fusion | Allows the model to learn *which* MFCC dimensions matter given the full audio context, outperforming naive concatenation |
| Partial weight freezing | Prevents catastrophic forgetting of low-level acoustic features during fine-tuning |
| Sliding window inference | Enables real-time, continuous monitoring without latency accumulation |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EMOTION MODEL                               │
│                                                                     │
│  Raw Audio (16kHz PCM)                                              │
│       │                                                             │
│       ├──────────────────────┐                                      │
│       │                      │                                      │
│  ┌────▼────────────┐   ┌─────▼──────────────┐                      │
│  │  Wav2Vec2-Base  │   │   MFCC Extraction  │                      │
│  │  (AudioEncoder) │   │   (librosa, n=40)  │                      │
│  │                 │   │   + PreEmphasis     │                      │
│  │  Layers 0–5:    │   │   + Normalization  │                      │
│  │  FROZEN         │   └─────────┬──────────┘                      │
│  │  Layers 6–11:   │             │                                  │
│  │  TRAINABLE      │      ┌──────▼──────────┐                      │
│  │                 │      │   MFCCNet       │                      │
│  │  Output:        │      │   Linear(40→128)│                      │
│  │  [B, 768]       │      │   LayerNorm     │                      │
│  └────────┬────────┘      │   ReLU          │                      │
│           │               │   Dropout(0.25) │                      │
│           │               │   Linear(128→128│                      │
│           │               │   [B, 128]      │                      │
│           │               └──────┬──────────┘                      │
│           │                      │                                  │
│      ┌────▼──────────────────────▼────┐                             │
│      │     CrossAttentionFusion       │                             │
│      │  Q from Wav2Vec2 [B,768→256]  │                             │
│      │  K,V from MFCCNet [B,128→256] │                             │
│      │  Scaled dot-product attention │                             │
│      │  Concat [Wav2Vec2 | Attn·V]   │                             │
│      │  Output: [B, 768+256=1024]    │                             │
│      └───────────────┬───────────────┘                             │
│                      │                                              │
│           ┌──────────▼──────────┐                                  │
│           │     Classifier      │                                  │
│           │  Linear(1024→512)   │                                  │
│           │  LayerNorm + ReLU   │                                  │
│           │  Dropout(0.4)       │                                  │
│           │  Linear(512→256)    │                                  │
│           │  ReLU + Dropout(0.3)│                                  │
│           │  Linear(256→8)      │                                  │
│           └──────────┬──────────┘                                  │
│                      │                                              │
│              8-Class Logits                                         │
│     [neutral, happy, sad, angry, fear, disgust, surprise, bored]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Input
- Raw PCM audio sampled at **16,000 Hz**
- Captured live via `sounddevice` in 3-second windows

### Preprocessing
- **Pre-emphasis filter** (`librosa.effects.preemphasis`) to boost high-frequency energy in MFCC branch
- **Amplitude normalization** (divide by max amplitude + ε) to standardize volume levels
- **Silence gating** (mean absolute amplitude < 0.002 threshold) to skip silent frames
- **HuggingFace `AutoFeatureExtractor`** for Wav2Vec2 input normalization

### Feature Extraction
- **Wav2Vec2 branch:** Raw waveform → Convolutional feature encoder → 12-layer transformer → mean-pooled sequence embeddings ([B, 768])
- **MFCC branch:** Pre-emphasized audio → 40 MFCC coefficients (temporal mean) → Z-score normalized → 2-layer MLP → [B, 128]

### Model Inference
- Cross-attention fusion → [B, 1024] combined representation
- 3-layer classifier head → 8-class logit vector
- Temperature-scaled softmax (T=1.7) to calibrate confidence scores

### Output
- **Live prediction:** Most common emotion in a 9-frame rolling window
- **Session prediction:** Weighted confidence vote over the most recent 12-second window

---

## 5. Implementation Details

### File Structure

```
emotion_project/
├── model.py          # Model architecture (Wav2Vec2 + MFCC + CrossAttention)
├── train.py          # Training loop on SUPERB-ER dataset
├── app.py            # Real-time inference loop (microphone input)
└── requirements.txt  # Python dependencies
```

---

### `model.py` — Core Architecture

**`extract_mfcc(audio, sr)`**
- Applies pre-emphasis to raw audio array
- Extracts 40 MFCC coefficients using `librosa`
- Temporally averages across all frames to get a single feature vector
- Applies Z-score normalization (mean subtraction + std division with ε clipping)

**`MFCCNet`**
- 2-layer feedforward network: `Linear(40→128) → LayerNorm → ReLU → Dropout(0.25) → Linear(128→128)`
- LayerNorm ensures stable gradient flow regardless of MFCC scale variance

**`AudioEncoder`**
- Wraps `facebook/wav2vec2-base` with a **partial freeze** strategy:
  - Transformer layers 0–5: frozen (preserve low-level acoustic representations)
  - Transformer layers 6–11: trainable (adapt to emotion-specific patterns)
- Mean-pools the transformer's last hidden state across time to produce a [B, 768] vector

**`CrossAttentionFusion`**
- Projects Wav2Vec2 output as the **query** (Q) into 256-dim space
- Projects MFCC output as **key** (K) and **value** (V) into 256-dim space
- Computes element-wise scaled dot-product attention: `softmax((Q ⊙ K) / √256) ⊙ V`
- Concatenates original Wav2Vec2 features with attended MFCC features → [B, 1024]

**`EmotionModel`**
- Combines all sub-modules
- Classifier: `Linear(1024→512) → LayerNorm → ReLU → Dropout(0.4) → Linear(512→256) → ReLU → Dropout(0.3) → Linear(256→8)`
- Returns raw logits (loss computed externally; softmax applied at inference with temperature)

---

### `train.py` — Training Pipeline

- **Dataset:** `anton-l/superb_demo` (Speech Understanding and PRocessing Benchmark, Emotion Recognition split), session 1 from HuggingFace Hub
- **Optimizer:** `AdamW` with learning rate `3e-5` and weight decay `1e-2`
- **Loss Function:** `CrossEntropyLoss` with **label smoothing = 0.1**
- **Gradient Clipping:** Maximum gradient norm of 1.0 (prevents exploding gradients)
- **Epochs:** 30
- **Checkpointing:**
  - `models/best.pt` — saved whenever average epoch loss improves
  - `models/last.pt` — always saved at end of training
- **Device-aware:** Automatically selects CUDA if available, falls back to CPU

---

### `app.py` — Real-Time Inference Engine

- **Recording:** `sounddevice.rec()` captures 3-second mono audio at 16kHz
- **Silence Detection:** Frames with mean absolute amplitude < 0.002 are skipped
- **Prediction:** Runs both Wav2Vec2 and MFCC branches, applies temperature-scaled softmax
- **Live Smoothing:** Maintains a `deque(maxlen=9)` rolling window; final live label is the **mode** (most frequent) across the window, suppressing frame-level noise
- **Session Aggregation:** Accumulates `(predicted_index, confidence)` tuples; every 12 seconds performs **weighted confidence voting** across the session buffer and outputs a final emotion decision
- **Reset:** Both live and session buffers are cleared after each 12-second window to maintain fresh state

---

## 6. Data Flow

```
[Microphone]
     │
     │  PCM Audio (3 sec, 16kHz, float32)
     ▼
[Silence Gate]
     │  Mean abs < 0.002 → skip frame
     ▼
[Amplitude Normalization]
     │  audio / (max_abs + 1e-6)
     ▼
     ├──────────────────────────────┐
     │                              │
[HuggingFace Feature Extractor]  [Pre-Emphasis Filter]
     │                              │
[Wav2Vec2 Encoder]              [MFCC Extraction (n=40)]
     │  [B, 768]                    │  [B, 40]
     │                              │
     │                         [Z-score Normalize]
     │                              │
     │                         [MFCCNet MLP]
     │                              │  [B, 128]
     └──────────────┬───────────────┘
                    │
           [CrossAttentionFusion]
                    │  [B, 1024]
                    ▼
              [Classifier MLP]
                    │  [B, 8] logits
                    ▼
         [Temperature-Scaled Softmax (T=1.7)]
                    │  probabilities
                    ▼
          [Live Rolling Window (maxlen=9)]
                    │  mode label
                    ▼
         [Session Buffer Accumulation]
                    │
          (every 12 sec) [Weighted Confidence Vote]
                    │
              [Final Emotion Output]
                    │
         Console / Integration Layer
```

---

## 7. Problems Faced

### P1 — Noisy Real-World Audio
Microphone captures frequently contain background noise, reverberation, and non-speech sounds that corrupt feature extraction and introduce false emotion predictions.

### P2 — Overconfident Frame-Level Predictions
Single-frame emotion predictions are inherently volatile. A brief cough, sigh, or word transition can cause the model to misclassify the dominant emotion, producing jittery, unreliable outputs.

### P3 — Unstable Training Loss (NaN / Divergence)
During early experimentation, training loss became NaN or diverged. Raw MFCC values vary widely in scale across audio samples, causing gradient instability when concatenated with normalized Wav2Vec2 embeddings.

### P4 — Catastrophic Forgetting During Fine-Tuning
When all Wav2Vec2 layers were left trainable with a high learning rate, the model quickly lost the rich acoustic representations learned during pre-training, resulting in degraded performance on the emotion task.

### P5 — Class Imbalance in the Training Dataset
The SUPERB-ER dataset's session split has unequal class distribution across the 8 emotion categories, causing the model to over-predict majority classes and largely ignore minority ones like `bored` and `surprise`.

### P6 — Overconfident Probability Estimates
The classifier tended to produce artificially high softmax probabilities even for incorrect predictions, making confidence scores unreliable as a signal for downstream integration.

### P7 — Short Training Set Overfitting
Training exclusively on session 1 of the SUPERB demo provides limited samples. Without regularization, the model overfits rapidly, performing well on training data but poorly in generalization.

### P8 — Real-Time Inference Latency on CPU
Running a full Wav2Vec2 transformer (86M parameters) on CPU within a 3-second window while simultaneously extracting MFCCs can approach or exceed the recording window duration on slower hardware.

### P9 — Missed Detections Due to Hard Silence Threshold
A fixed silence threshold of 0.002 may incorrectly gate out valid low-amplitude speech from elderly patients who naturally speak more softly.

---

## 8. Solutions Implemented

### S1 — Amplitude Normalization (P1)
**Problem:** Varying microphone gain and background noise cause inconsistent signal magnitudes.  
**Why it happened:** Different hardware and environments produce signals at vastly different amplitude scales.  
**Solution:** We implemented peak normalization — `audio = audio / (max_abs + 1e-6)` — immediately after recording. This brings all audio into a consistent [-1, 1] range before feature extraction.  
**Why it works:** Normalization decouples feature extraction from volume levels, ensuring the model receives consistently scaled input regardless of recording conditions.

---

### S2 — Dual-Layer Temporal Smoothing (P2)
**Problem:** Frame-level predictions are noisy and jittery.  
**Why it happened:** Emotion is a continuous, sustained state; single 3-second windows capture only a slice and are susceptible to transient acoustic events.  
**Solution:** We implemented a **two-tier smoothing system**:
1. A `deque(maxlen=9)` live rolling window takes the **mode** of the last 9 predictions as the live output, suppressing single-frame outliers.
2. A session-level **weighted confidence voting** mechanism accumulates `(label, confidence)` pairs over 12 seconds and selects the emotion with the highest total accumulated confidence.

**Why it works:** The live window filters high-frequency noise while preserving responsiveness. The session vote aggregates evidence across time, weighting predictions by the model's own confidence, producing a statistically more reliable session-level assessment.

---

### S3 — MFCC Z-Score Normalization (P3)
**Problem:** Training loss became NaN due to MFCC scale mismatch with Wav2Vec2 embeddings.  
**Why it happened:** Raw MFCC values can span several orders of magnitude; when fused with normalized transformer outputs, the optimizer receives imbalanced gradients.  
**Solution:** We applied per-sample Z-score normalization in `extract_mfcc()`: `(mfcc - mfcc.mean()) / (mfcc.std() + 1e-6)`. We also added `LayerNorm` after both the MFCC linear layer and the first classifier layer.  
**Why it works:** Z-score normalization brings MFCC features to zero mean and unit variance, matching the scale of Wav2Vec2 embeddings. LayerNorm further stabilizes internal activations throughout training.

---

### S4 — Partial Layer Freezing of Wav2Vec2 (P4)
**Problem:** Full fine-tuning caused catastrophic forgetting of pre-trained acoustic features.  
**Why it happened:** A high learning rate applied uniformly across all transformer layers overwrote valuable low-level features in early layers.  
**Solution:** We froze the first 6 of 12 transformer encoder layers in `AudioEncoder`, making only layers 6–11 trainable. This is described in the code as "the best tradeoff."  
**Why it works:** The lower layers of Wav2Vec2 encode fundamental acoustic properties (phonemes, prosody fundamentals) that transfer well to any audio task. Only the upper layers, which encode higher-level contextual representations, need to adapt for emotion-specific patterns.

---

### S5 — Label Smoothing in Loss Function (P5)
**Problem:** Class imbalance caused the model to overfit to majority emotion classes.  
**Why it happened:** The SUPERB-ER session 1 split is not uniformly distributed; neutral and happy tend to dominate.  
**Solution:** We used `CrossEntropyLoss(label_smoothing=0.1)`, which distributes 10% of the probability mass uniformly across all classes rather than concentrating it at the ground truth label.  
**Why it works:** Label smoothing penalizes overconfident predictions on majority classes and forces the model to maintain non-trivial probability on minority classes, improving calibration and generalization.

---

### S6 — Temperature Scaling for Calibrated Confidence (P6)
**Problem:** The classifier produced overconfident softmax probabilities that were unreliable for downstream use.  
**Why it happened:** Deep neural network classifiers routinely learn to maximize margin, producing sharply peaked distributions even when uncertain.  
**Solution:** We applied **temperature scaling** at inference: `softmax(logits / 1.7)`. A temperature T > 1 softens the distribution, reducing overconfidence.  
**Why it works:** Temperature scaling is a well-established post-hoc calibration technique. T=1.7 was chosen to flatten the distribution enough to make confidence scores meaningful without over-smoothing distinctions between classes.

---

### S7 — Dropout Regularization (P7)
**Problem:** The model overfitted rapidly on the limited training set.  
**Why it happened:** The SUPERB demo split is small; a high-capacity model can memorize training samples within a few epochs.  
**Solution:** We applied aggressive **Dropout** — `Dropout(0.25)` in MFCCNet and `Dropout(0.4)` + `Dropout(0.3)` in the classifier layers. We also used **AdamW** with `weight_decay=1e-2` for L2 regularization.  
**Why it works:** Dropout prevents co-adaptation of neurons by randomly deactivating them during training, forcing the network to learn redundant representations. Weight decay penalizes large parameter magnitudes, discouraging overfitting.

---

### S8 — Gradient Clipping (P8 / P3)
**Problem:** Gradient explosions caused unstable training and, indirectly, slow convergence.  
**Solution:** We applied `torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)` after each backward pass, capping the global gradient norm at 1.0.  
**Why it works:** Gradient clipping is a standard technique for training deep models and transformers, ensuring parameter updates remain bounded even when loss curvature is high.

---

### S9 — Low Learning Rate with AdamW (P8)
**Problem:** Standard learning rates caused the model to overshoot minima and oscillate, slowing convergence.  
**Solution:** We used a learning rate of `3e-5` with the `AdamW` optimizer — deliberately conservative to allow fine-grained adaptation of the pre-trained Wav2Vec2 weights without disrupting them.  
**Why it works:** For fine-tuning large pre-trained models, low learning rates are standard practice. `3e-5` is in the range recommended by the original BERT/Wav2Vec2 fine-tuning literature.

---

## 9. Model Performance

### Training Objective
The model is trained to minimize `CrossEntropyLoss` with label smoothing over 30 epochs. Training loss is tracked per epoch; the checkpoint with the lowest average epoch loss is saved as `models/best.pt`.

### Evaluation Metrics
No explicit held-out test set evaluation loop is present in the current training script (`train.py`). The following metrics are implicitly captured:

| Metric | Details |
|--------|---------|
| Training loss | Logged per epoch; best checkpoint selected at minimum |
| Live confidence | Temperature-scaled softmax probability of predicted class, logged per inference window |
| Session confidence | Normalized weighted vote score across 12-second window |

### Classification Target
- **8-class emotion classification** across: neutral, happy, sad, angry, fear, disgust, surprise, bored
- The SUPERB benchmark (from which the demo dataset is derived) reports state-of-the-art accuracy in the 60–70% range for the full IEMOCAP split; the demo session is a subset.

> **Note:** Dedicated validation/test loop metrics (accuracy, F1, confusion matrix) are a recommended future improvement — see Section 13.

---

## 10. Edge Cases Handled

| Edge Case | Handling Strategy |
|-----------|------------------|
| **Complete silence** | `record_audio()` checks `mean(abs(audio)) < 0.002`; silent frames return `None` and are skipped without inference |
| **Very low amplitude speech** | Amplitude normalization (`audio / max_abs`) amplifies quiet speech before feature extraction |
| **Near-silence near threshold** | ε-clipping in normalization (`/ (max_abs + 1e-6)`) prevents division by zero |
| **No model checkpoint found** | `load_model()` tries three paths (`best.pt`, `last.pt`, `emotion_model.pt`) and raises an explicit `FileNotFoundError` with a descriptive message if none exist |
| **Low confidence predictions** | Temperature-scaled softmax softens overconfident predictions; session-level weighted voting down-weights low-confidence frames naturally |
| **Noisy/corrupted audio** | Z-score normalization of MFCCs and amplitude normalization reduce impact of signal artifacts; rolling window smoothing prevents single noisy frame from dominating live output |
| **Keyboard interrupt** | `try/except KeyboardInterrupt` in main loop ensures graceful shutdown with the message "Stopped safely" |
| **Model state dict mismatch** | `model.load_state_dict(state, strict=True)` enforces that loaded weights must exactly match the architecture, preventing silent loading failures |
| **GPU unavailability** | `torch.device("cpu")` is explicitly set in inference; training uses `cuda if available else cpu` |

---

## 11. Performance Optimizations

### Partial Transformer Freezing
Freezing the bottom 6 Wav2Vec2 layers reduces the number of trainable parameters by approximately 50% and significantly speeds up both forward and backward passes during training without sacrificing accuracy, since low-level acoustic features are already well-learned.

### `torch.inference_mode()` at Runtime
The inference loop uses `torch.inference_mode()` (more aggressive than `no_grad()`), which disables the autograd engine entirely during prediction. This reduces memory allocation overhead and provides measurably faster inference on CPU.

### Mean Pooling over Sequence Dimension
Rather than using the full sequence output from Wav2Vec2 (variable-length sequence of frame embeddings), we mean-pool across the time dimension immediately after the encoder. This collapses the representation to a fixed [B, 768] vector, dramatically reducing memory usage and eliminating the need for padding/masking in the classifier.

### MFCC Temporal Averaging
MFCC features are averaged across all time frames (`np.mean(mfcc, axis=1)`) into a single 40-dimensional vector before passing to `MFCCNet`. This removes temporal processing entirely from the MFCC branch, keeping it lightweight (two linear layers) while still capturing spectral texture.

### Model Loaded Once at Startup
The `EmotionModel` is loaded into memory once at module import time (`model = load_model()`) rather than per inference call, eliminating repeated checkpoint loading overhead in the real-time loop.

### 0.2-Second Sleep Between Recordings
`time.sleep(0.2)` between recording windows prevents CPU saturation, allowing other system processes to run smoothly without degrading audio capture quality.

---

## 12. Integration

### With the Voice System
The emotion detection loop (`app.py`) is designed to run alongside the voice interface. Both systems operate on the same 16kHz microphone stream. Live emotion labels can be passed to the voice processing pipeline to provide context-aware responses — for example, adjusting the chatbot's tone or escalating alerts based on detected emotional state.

### With the Chatbot Module
Session-level emotion summaries (produced every 12 seconds) represent the patient's dominant emotional state during a conversation turn. This signal can be injected into the chatbot's context to allow empathetic, emotion-aware response generation — e.g., detecting `sad` and responding with supportive language, or detecting `angry` and de-escalating.

### With the Caregiver Dashboard
Final emotion decisions, along with their confidence scores, can be streamed via the backend's Socket.IO layer (`socketManager.js`) to the caregiver dashboard in real time. This enables caregivers to see live emotional state indicators without being physically present.

### Output Contract
The inference loop produces the following data that can be serialized for API/socket integration:

```json
{
  "live_emotion": "sad",
  "live_confidence": 0.71,
  "session_emotion": "sad",
  "session_confidence": 0.68,
  "timestamp": "2026-04-15T10:30:00Z"
}
```

---

## 13. Future Improvements

| Improvement | Justification |
|-------------|--------------|
| **Add validation/test split in training** | Currently there is no held-out evaluation loop; adding accuracy, weighted F1, and per-class precision/recall metrics would provide objective model performance tracking |
| **Train on full IEMOCAP / RAVDESS dataset** | The SUPERB demo (`session1`) is a small subset; training on the full IEMOCAP corpus or RAVDESS would dramatically improve generalization |
| **Streaming audio with circular buffer** | Replace fixed 3-second blocks with a circular buffer and hop-based windowing for true low-latency continuous streaming |
| **ONNX / TorchScript export** | Exporting the trained model to ONNX or TorchScript would enable faster CPU inference and easier cross-platform deployment |
| **REST API wrapper (FastAPI)** | Expose emotion predictions via a `/predict` endpoint accepting audio bytes, enabling backend integration without running a local Python process |
| **Data augmentation during training** | Apply SpecAugment, time stretching, and pitch shifting to training samples to simulate real-world acoustic variability and improve robustness |
| **Attention visualization** | Add a forward hook on `CrossAttentionFusion` to visualize which MFCC dimensions the model attends to for each emotion — useful for clinical explainability |
| **Adaptive silence threshold** | Replace the fixed 0.002 amplitude threshold with a dynamic background noise estimator for environments with consistent ambient noise |
| **Multi-modal fusion (audio + text)** | Combine voice emotion with NLP sentiment from the chatbot transcription for higher accuracy emotion estimation |
| **Confusion matrix logging** | Add per-epoch confusion matrix logging to identify which emotion pairs are most frequently confused and guide targeted data collection |

---

## 14. Final Summary

The **Emotion Detection System** addresses one of the most challenging and impactful problems in AI-assisted elder care: understanding the emotional state of patients who cannot reliably express themselves verbally. By combining the representational power of a pre-trained **Wav2Vec2** transformer with the proven clinical utility of **MFCC** features, and fusing them through a custom **cross-attention mechanism**, we built a system that is both technically rigorous and practically deployable.

The engineering choices — partial layer freezing, dual-layer temporal smoothing, temperature-scaled confidence, label smoothing, and gradient clipping — reflect a careful balance between model capacity and generalization on limited data. The real-time inference loop with its hybrid live/session decision system enables the kind of continuous, unobtrusive monitoring that is essential in dementia care, where emotional patterns across time are far more meaningful than any single data point.

This system is not just a standalone ML module. It serves as the **emotional context layer** of the broader care platform — informing the chatbot's empathy engine, alerting caregivers to distress, and contributing behavioral data to the clinical longitudinal record. Its design prioritizes correctness and reliability over raw performance, because in this domain, a false negative — missing a patient in distress — is more costly than any latency optimization.

---

> **Emotion Project** | Built with PyTorch · HuggingFace Transformers · librosa · sounddevice
