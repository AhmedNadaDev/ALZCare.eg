# Speech Mood Detection (WavLM Multi-Task)

A speech-based mood and arousal estimation pipeline built on **WavLM**, trained on merged
acted-emotion corpora (RAVDESS, CREMA-D, TESS, SAVEE) and remapped to a six-class clinical
mood taxonomy. The system is a **clinical decision-support / monitoring prototype** intended
for Alzheimer's and mood-monitoring research contexts. It analyzes *acoustic* speech patterns
(prosody, energy, timbre) — **not the meaning of the words spoken** — and produces
probabilistic estimates, not diagnoses.

> This is research software and an engineering baseline. It is **not** a medical device,
> not a consumer assistant, and not validated for clinical deployment. See
> [Clinical Interpretation](#9-clinical-interpretation) and [Limitations & Risks](#10-limitations--risks).

---

## Table of contents

1. [Project Overview](#1-project-overview)
2. [Problem Definition](#2-problem-definition)
3. [Model Architecture](#3-model-architecture)
4. [Dataset Description](#4-dataset-description)
5. [Training Strategy](#5-training-strategy)
6. [Evaluation Results](#6-evaluation-results)
7. [How to Run Inference](#7-how-to-run-inference)
8. [File Structure](#8-file-structure)
9. [Clinical Interpretation](#9-clinical-interpretation)
10. [Limitations & Risks](#10-limitations--risks)
11. [Future Improvements](#11-future-improvements)

---

## 1. Project Overview

The system takes a raw audio clip of a person speaking freely and returns two things:

- a **mood estimate** over six classes — `Calm`, `Neutral`, `Content`, `Anxious`, `Agitated`, `Low`; and
- a **coarse arousal signal** — `low` or `high` — which is the more stable, more clinically
  meaningful output.

It is a **multi-task** model: a shared WavLM acoustic backbone feeds two prediction heads (mood
and arousal) through an attentive pooling layer. The arousal head exists because fine six-class
mood is intrinsically ambiguous from voice alone, whereas the high/low arousal distinction is
recovered far more reliably and is often what matters for monitoring (e.g. detecting agitation
or distress versus a calm/low-activation state).

The pipeline supports temperature-calibrated probabilities, optional test-time augmentation
(TTA), and optional multi-seed ensembling, all of which trade compute for more stable,
better-calibrated predictions.

---

## 2. Problem Definition

**Goal.** Given an utterance, estimate the speaker's mood state and arousal level from acoustic
cues, as a supporting signal in an Alzheimer's / mood-monitoring workflow.

**Why this is hard.** Publicly available labelled data for this task is *acted* emotional
speech, and the labels are *perceived* emotion categories that human raters themselves disagree
on. Several of the target categories are not acoustically separable from voice alone:

- `Content` (happy) and `Agitated` (anger/disgust) are both **high-arousal**; prosody encodes
  arousal much more strongly than valence, so positive and negative high-arousal states are
  easily confused.
- `Anxious` (fear) and `Low` (sadness) sit close together in the low-to-moderate-arousal
  negative region and overlap acoustically.

As a result, a meaningful share of the six-class error is **irreducible label ambiguity**, not
model underfitting. The model therefore also predicts the coarser arousal axis, which is more
robust. The clinical target population (elderly patients, spontaneous speech) differs
substantially from the acted training data — an **unmeasured domain shift** that further
separates benchmark numbers from real-world performance.

---

## 3. Model Architecture

The model is a custom multi-task network — **not** a standard
`AutoModelForAudioClassification`.

```
raw waveform (16 kHz, mono)
        │
        ▼
WavLM backbone  (microsoft/wavlm-base-plus)
  - CNN feature encoder (frozen)
  - Transformer encoder (fine-tuned)
        │  last_hidden_state  (B, T, H=768)
        ▼
Attentive Masked Pooling
  - learns per-frame attention weights
  - respects the padding mask  →  (B, H)
        │
        ├────────────► Mood head:  Linear(H,H) → GELU → Dropout → Linear(H, 6)
        │
        └────────────► Arousal head:  Linear(H, 2)
```

Components:

- **WavLM backbone** (`microsoft/wavlm-base-plus`): a self-supervised speech encoder. The
  convolutional feature encoder is frozen (standard practice); the transformer layers are
  fine-tuned with a lower learning rate than the heads.
- **Attentive masked pooling**: aggregates the variable-length frame sequence into a single
  utterance embedding using learned attention weights, while ignoring padded frames.
- **Mood head**: a two-layer MLP producing six mood logits.
- **Arousal head**: a linear layer producing two arousal logits (low/high).
- **Temperature scaling**: a single scalar `T`, fit on the validation set after training, used
  at inference to calibrate the softmax probabilities.

The arousal label for each example is derived deterministically from its mood label:

| Arousal | Mood classes |
|---------|--------------|
| `low`   | Calm, Neutral, Low |
| `high`  | Content, Anxious, Agitated |

---

## 4. Dataset Description

Training uses four public **acted** speech-emotion corpora, merged and remapped to the mood
taxonomy:

| Corpus   | Speakers | Notes |
|----------|----------|-------|
| RAVDESS  | 24       | Includes a distinct `calm` category (the only source of `Calm`) |
| CREMA-D  | 91       | Largest corpus; crowd-sourced *perceived*-emotion labels |
| TESS     | 2        | Two female speakers; acoustically easy, can inflate averages |
| SAVEE    | 4        | Four male speakers |

**Emotion → mood mapping:**

```
neutral  → Neutral      fearful  → Anxious
calm     → Calm         angry    → Agitated
happy    → Content      disgust  → Agitated
sad      → Low          surprised → (excluded)
```

**Final mood classes:** `Calm`, `Neutral`, `Content`, `Anxious`, `Agitated`, `Low`.

Two data characteristics strongly shape results and must be kept in mind:

- **`Calm` originates only from RAVDESS.** Strong `Calm` performance can partly reflect
  corpus-specific recording cues rather than mood, and is the least trustworthy class for
  cross-population transfer.
- **Speaker counts are very uneven** (2 to 91), which constrains how the data can be split
  without speaker leakage.

Splits are **speaker-disjoint and corpus-aware**: speakers are partitioned per corpus so that
no speaker appears in more than one split, every corpus is represented across train/validation/
test where speaker counts allow, and the validation set is sized realistically (~15%). A
leave-one-corpus-out option is available to measure honest cross-corpus generalization.

---

## 5. Training Strategy

The pipeline is engineered for class imbalance, calibration, and robustness rather than for a
single headline accuracy number.

- **Class-balanced focal loss** — effective-number class weighting (Cui et al.) combined with
  focal loss. This handles the heavy class imbalance (e.g. `Calm` is a small minority) without
  the degenerate over-prediction that naive inverse-frequency weighting causes. Focal loss also
  acts as soft hard-example mining, focusing on the under-fit classes.
- **Auxiliary arousal task** — the arousal head is trained jointly (weighted auxiliary loss).
  This regularizes the shared representation and yields the reliable coarse output.
- **Supervised contrastive loss (optional)** — an auxiliary metric-learning term on the pooled
  embeddings to pull same-mood examples together; off or low-weight by default.
- **Data augmentation** — train-time waveform augmentation that deliberately stays mild because
  pitch and tempo themselves carry emotion: additive noise, random gain, gentle pitch shift
  (≤ 2 semitones) and time-stretch, plus **domain-shift** augmentations — a band-pass
  *telephony* filter (300–3400 Hz) and simple *reverb* — to simulate real microphones, rooms,
  and phone channels. Augmentation intensity is ramped over the first epochs (curriculum).
- **SpecAugment** — WavLM's native time/feature masking on hidden states (train only).
- **Balanced sampling** — a tempered, corpus-aware weighted sampler balances class exposure per
  epoch without dominating the loss.
- **Optimization** — discriminative learning rates (higher for the heads, lower for the
  transformer), a cosine schedule with warmup, progressive unfreezing of the encoder,
  gradient clipping, mixed precision, and early stopping on validation macro-F1.
- **Calibration** — temperature scaling fit on the validation set after training; the value is
  stored in the checkpoint.
- **TTA & ensembling (optional)** — multiple augmented views per clip and/or multiple training
  seeds, averaged at the probability level to reduce variance.

Model selection, calibration, and any thresholds use the **validation** set only; the test set
is read once for final reporting.

---

## 6. Evaluation Results

Results are reported on a **speaker-disjoint** test split of the acted corpora. Ranges reflect
whether TTA and ensembling are enabled.

| Metric | Range | Notes |
|--------|-------|-------|
| Test accuracy (6-class mood) | ~0.74 – 0.77 | Higher end with TTA + ensemble |
| Macro F1 (6-class mood) | ~0.73 – 0.76 | Balanced across classes |
| Arousal accuracy (low/high) | ~0.86 – 0.88 | The more reliable signal |

Interpretation:

- **Six-class mood is the harder task.** Much of the residual error is *within the same arousal
  band* — primarily `Content`↔`Agitated` (high-arousal valence) and `Anxious`↔`Low`
  (low-arousal). These reflect genuine label ambiguity in acted, perceived-emotion data rather
  than a lack of model capacity.
- **The arousal axis is more stable and generalizes better.** Collapsing the six moods to
  high/low arousal recovers substantially higher accuracy, which is why arousal is treated as
  the primary clinical signal.
- **Some per-class numbers are corpus-confounded.** For example, `Calm` comes only from
  RAVDESS, so its apparent strength may not transfer.

These numbers describe in-distribution acted speech. **Expect lower performance on real
spontaneous patient speech** until the model is domain-adapted and prospectively evaluated.

---

## 7. How to Run Inference

### Requirements

- Python 3.9+
- `torch`, `transformers`, `librosa`, `soundfile`, `numpy`
- A trained checkpoint (`best.pt`) and, ideally, the accompanying `hf_export/` and
  `label_mapping.json` (enables fully offline reconstruction; see [File Structure](#8-file-structure)).

### Basic command

```bash
python mood_inference.py --ckpt models/best.pt --audio sample.wav
```

### What happens, step by step

1. **Inspect & rebuild.** The script loads the checkpoint, reads its metadata, infers the
   architecture from the stored weight shapes, and reconstructs the exact multi-task model. The
   large pretrained WavLM weights are **not** re-downloaded — the backbone skeleton is built
   from config and the trained weights come from the checkpoint.
2. **Load audio.** `sample.wav` is decoded, converted to **mono**, and resampled to **16 kHz**.
   Clips longer than the configured maximum duration are truncated.
3. **Feature extraction.** The waveform is normalized by the WavLM feature extractor and an
   attention mask is produced for padding.
4. **Forward pass.** The model returns **mood logits (6)** and **arousal logits (2)**.
5. **Calibrated softmax.** Both logit vectors are divided by the stored temperature `T` and
   passed through softmax to produce probabilities.
6. **Optional TTA / ensemble averaging.** With `--tta N`, the clip is re-evaluated under `N`
   augmented views and the probabilities are averaged. With multiple `--ckpt` paths, the
   per-model calibrated probabilities are averaged as an ensemble.
7. **Output.** The script prints the Top-K mood predictions with probabilities, the arousal-head
   prediction with its confidence, the arousal implied by the top mood (as a cross-check), and
   an `UNCERTAIN(abstain)` label if the top mood confidence falls below `--abstain`.

### Useful options

```bash
# Inspect the checkpoint structure without running inference
python mood_inference.py --ckpt models/best.pt --inspect

# Top-3 moods, 5-view TTA, abstain below 0.5 confidence
python mood_inference.py --ckpt models/best.pt --audio sample.wav --topk 3 --tta 5 --abstain 0.5

# Ensemble multiple seeds over a whole folder, JSON output
python mood_inference.py --ckpt models/best_seed42.pt models/best_seed7.pt --audio clips/ --json

# Point explicitly at the offline artifacts
python mood_inference.py --ckpt models/best.pt --audio sample.wav \
    --hf-export models/hf_export --label-mapping models/label_mapping.json
```

| Flag | Meaning |
|------|---------|
| `--ckpt` | One or more checkpoint paths; multiple paths form an ensemble |
| `--audio` | A `.wav` file or a directory of audio files |
| `--topk` | Number of mood classes to report (default 3) |
| `--tta` | Test-time augmentation views (1 = none) |
| `--abstain` | Abstain if the top mood probability is below this threshold |
| `--hf-export` | Path to `hf_export/` for offline config + feature extractor |
| `--label-mapping` | Path to `label_mapping.json` |
| `--device` | `auto` / `cpu` / `cuda` |
| `--inspect` | Print checkpoint structure |
| `--json` | Emit machine-readable JSON |

### Example output (illustrative)

```
file              : sample.wav
predicted mood    : Agitated  (conf 0.62)
top-3 moods       : Agitated=0.62, Anxious=0.21, Content=0.09
arousal (head)    : high (p=0.88) probs={'low': 0.12, 'high': 0.88}
arousal (by mood) : high
temperature       : 1.87 | tta=5 | ensemble=1
```

---

## 8. File Structure

A typical training run produces the following artifacts:

```
models/
├── best.pt                 # best validation checkpoint (highest macro-F1)
├── last.pt                 # final training checkpoint
├── label_mapping.json      # label2id / id2label, arousal map, temperature, metadata
├── hf_export/              # backbone (save_pretrained) + feature extractor + heads.pt
│   ├── config.json
│   ├── model.safetensors
│   ├── preprocessor_config.json
│   └── heads.pt
├── ensemble_manifest.json  # lists ensemble members and their validation scores
└── model_package.zip       # zipped bundle of the above for download
mood_inference.py           # standalone inference script
```

### What `best.pt` is (and is not)

`best.pt` is the **checkpoint with the highest validation macro-F1** observed during training.
It is a **trained neural-network snapshot**, saved as a PyTorch dictionary. Concretely:

- It **is** a serialized snapshot containing the model `state_dict` (all learned weights for the
  WavLM backbone, attentive pooling, mood head, and arousal head), the label mapping
  (`label2id` / `id2label`), training metadata (model name, sample rate, max samples, epoch,
  validation macro-F1, seed, dropout), and the calibration `temperature`.
- It is **not a dataset** — no audio or training examples are stored in it.
- It is **not a raw / untrained model** — the weights are the result of training.
- It is intended for **inference only**. To continue training you would also need the optimizer
  state and data pipeline, which are not part of this file.

`last.pt` has the same format but corresponds to the final epoch rather than the best validation
epoch; it is useful for resuming experiments or comparison, but `best.pt` is the one to deploy.

---

## 9. Clinical Interpretation

**This section is important. Read it before using any output.**

- **Decision support, not diagnosis.** Outputs are probabilistic estimates of acoustic mood and
  arousal. They are intended to *support* a clinician's or caregiver's judgment, never to
  replace clinical assessment or to produce a diagnosis.
- **It models sound, not meaning.** The system analyzes acoustic properties of speech (prosody,
  energy, timbre). It does **not** transcribe or interpret the content of what is said, and it
  is not a measure of cognitive status.
- **Prefer the arousal signal for monitoring.** The high/low arousal output is more reliable and
  more stable than the fine six-class mood label. For use cases such as flagging possible
  agitation or distress, arousal is the more defensible signal; treat the six-class mood as a
  softer, more uncertain hint.
- **Use probabilities and abstention, not hard labels.** Report and act on calibrated
  probabilities and confidence. The `--abstain` mechanism is designed so that low-confidence
  cases can be escalated to a human rather than acted on automatically.
- **Aggregate over time.** A single clip is noisy. For monitoring, trends across many samples
  are more meaningful than any individual prediction.
- **Fairness and consent.** Voice characteristics vary by age, sex, accent, language, and health
  condition; the training population does not represent these groups equally. Any deployment
  must address informed consent, privacy, data governance, and subgroup fairness.

---

## 10. Limitations & Risks

- **Trained on acted speech.** RAVDESS/CREMA-D/TESS/SAVEE consist of acted, prototypical
  emotions recorded in clean conditions, mostly from younger speakers. Real dementia-patient
  speech is spontaneous, subtler, and recorded in noisier settings — a large, **unmeasured
  domain shift**. Real-world accuracy is expected to be **lower** than the reported test
  numbers.
- **Label ambiguity ceiling.** The six-class labels are perceived emotions with substantial
  human rater disagreement. Part of the error is irreducible; chasing very high six-class
  accuracy on this data is not scientifically meaningful and can indicate leakage.
- **Corpus confounds.** `Calm` comes from a single corpus; some per-class results reflect
  recording conditions rather than mood and may not transfer.
- **Not a medical device.** The system is unvalidated for clinical use, has no regulatory
  clearance, and must not be used for autonomous clinical decisions.
- **Demographic coverage.** Limited diversity in the training speakers risks unequal performance
  across populations.
- **Adversarial / out-of-distribution audio.** Background speakers, music, very short clips, or
  heavy noise can degrade predictions; the calibration and abstention mechanisms mitigate but do
  not eliminate this.
- **Privacy.** Speech is sensitive personal data; storage and processing must comply with
  applicable regulations.

---

## 11. Future Improvements

- **Domain adaptation to patient data.** The highest-value next step is acquiring
  clinician-labelled spontaneous patient speech and adapting the model to it (the pipeline
  includes a pseudo-labeling hook for unlabeled clinical audio as a starting point).
- **Honest cross-corpus evaluation.** Routine leave-one-corpus-out reporting to track
  generalization rather than in-distribution accuracy.
- **Coarser, clinically-grounded targets.** A dedicated binary distress / agitation detector, or
  a calibrated arousal regressor, may be both more reliable and more useful than fine mood
  classes.
- **Larger backbone.** Switching to `microsoft/wavlm-large` can add a few points of accuracy
  where compute allows, though it cannot create valence information absent from the signal.
- **Temporal modelling.** Aggregating predictions across an interaction or a monitoring window,
  with uncertainty propagation, instead of scoring isolated clips.
- **Multimodal context.** Combining acoustics with other monitoring signals (where ethically and
  legally appropriate) to improve reliability.
- **Prospective clinical validation.** Subgroup fairness analysis and a prospective study before
  any deployment.

---

*This document describes a research prototype. It is provided for development and evaluation
purposes only and carries no warranty of fitness for clinical use.*
