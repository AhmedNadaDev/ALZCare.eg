import torch
import torch.nn as nn
import torch.nn.functional as F
import librosa
import numpy as np
from transformers import AutoFeatureExtractor, Wav2Vec2Model

# ======================
# PRETRAINED
# ======================
pretrained = "facebook/wav2vec2-base"
feature_extractor = AutoFeatureExtractor.from_pretrained(pretrained)
wav2vec = Wav2Vec2Model.from_pretrained(pretrained)


# ======================
# MFCC (stable + normalized)
# ======================
def extract_mfcc(audio, sr=16000):
    audio = librosa.effects.preemphasis(audio)
    mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
    mfcc = np.mean(mfcc, axis=1)

    # normalization (critical for stable loss)
    return (mfcc - mfcc.mean()) / (mfcc.std() + 1e-6)


# ======================
# MFCC NETWORK
# ======================
class MFCCNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(40, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(0.25),
            nn.Linear(128, 128)
        )

    def forward(self, x):
        return self.net(x)


# ======================
# AUDIO ENCODER (PARTIAL FREEZE)
# ======================
class AudioEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.wav2vec = wav2vec

        # freeze first half (best tradeoff)
        for layer in self.wav2vec.encoder.layers[:6]:
            for p in layer.parameters():
                p.requires_grad = False

    def forward(self, x):
        x = self.wav2vec(x).last_hidden_state
        return x.mean(dim=1)


# ======================
# 🔥 CROSS-ATTENTION FUSION (BEST VERSION)
# ======================
class CrossAttentionFusion(nn.Module):
    def __init__(self):
        super().__init__()

        self.q = nn.Linear(768, 256)
        self.k = nn.Linear(128, 256)
        self.v = nn.Linear(128, 256)

        self.scale = 1 / (256 ** 0.5)

    def forward(self, a, b):
        q = self.q(a)
        k = self.k(b)
        v = self.v(b)

        attn = torch.softmax((q * k) * self.scale, dim=-1)
        fused = attn * v

        return torch.cat([a, fused], dim=1)


# ======================
# FINAL MODEL
# ======================
class EmotionModel(nn.Module):
    def __init__(self):
        super().__init__()

        self.audio = AudioEncoder()
        self.mfcc = MFCCNet()
        self.fusion = CrossAttentionFusion()

        self.classifier = nn.Sequential(
            nn.Linear(768 + 256, 512),
            nn.LayerNorm(512),
            nn.ReLU(),
            nn.Dropout(0.4),

            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(0.3),

            nn.Linear(256, 8)
        )

    def forward(self, wav, mfcc):
        a = self.audio(wav)
        b = self.mfcc(mfcc)

        x = self.fusion(a, b)
        return self.classifier(x)