# -*- coding: utf-8 -*-
"""Generate clean block diagrams for the IEEE paper (system, mood model, RAG)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# Academic palette
C_CLIENT = "#dbe7f3"; E_CLIENT = "#3a6ea5"
C_API    = "#d8efe0"; E_API    = "#2f8f5b"
C_AI     = "#fbe3d6"; E_AI     = "#c2693a"
C_DATA   = "#ece1f2"; E_DATA   = "#7a4f9c"
C_NEUTRAL= "#eceff1"; E_NEUTRAL= "#546e7a"
FONT = "DejaVu Sans"
plt.rcParams.update({"font.family": FONT, "font.size": 9})


def box(ax, x, y, w, h, text, fc, ec, fs=9, bold=False):
    p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.012,rounding_size=0.025",
                       linewidth=1.4, edgecolor=ec, facecolor=fc, mutation_aspect=1)
    ax.add_patch(p)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fs, fontweight=("bold" if bold else "normal"), color="#16202b", wrap=True)
    return (x, y, w, h)


def arrow(ax, p1, p2, text=None, color="#37474f", style="-|>", rad=0.0, fs=7.5, ls="-"):
    a = FancyArrowPatch(p1, p2, arrowstyle=style, mutation_scale=12,
                        connectionstyle=f"arc3,rad={rad}", linewidth=1.3,
                        color=color, linestyle=ls)
    ax.add_patch(a)
    if text:
        mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        ax.text(mx, my + 0.018, text, ha="center", va="bottom", fontsize=fs, color=color)


# ============================================================== SYSTEM ARCH
def system_arch():
    fig, ax = plt.subplots(figsize=(7.0, 4.3))
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")

    # Clients
    box(ax, 0.02, 0.80, 0.18, 0.13, "Patient\n(web client)", C_CLIENT, E_CLIENT, 8.5)
    box(ax, 0.02, 0.55, 0.18, 0.13, "Doctor\n(web client)", C_CLIENT, E_CLIENT, 8.5)
    box(ax, 0.02, 0.30, 0.18, 0.13, "Family\n(web client)", C_CLIENT, E_CLIENT, 8.5)

    # Frontend
    fe = box(ax, 0.27, 0.55, 0.18, 0.20, "React + Vite\nSPA\n(role-based UI)", C_CLIENT, E_CLIENT, 8.5, True)

    # API gateway
    api = box(ax, 0.52, 0.55, 0.20, 0.22, "Node.js / Express\nREST API\n+ Socket.IO\n(JWT per role)", C_API, E_API, 8.5, True)

    # Mongo
    box(ax, 0.80, 0.78, 0.18, 0.16, "MongoDB\n(patients, moods,\nnotifications)", C_DATA, E_DATA, 8.0, True)

    # AI microservices
    box(ax, 0.52, 0.06, 0.20, 0.16, "Mood Service\nFastAPI :8001\nWavLM model", C_AI, E_AI, 8.0, True)
    box(ax, 0.80, 0.06, 0.18, 0.16, "Chatbot Service\nRAG (Groq +\nFAISS)", C_AI, E_AI, 8.0, True)

    # arrows clients->frontend (land cleanly on the frontend left edge)
    for cy, fy in ((0.865, 0.715), (0.615, 0.650), (0.365, 0.585)):
        arrow(ax, (0.20, cy), (0.27, fy), rad=0.0)
    arrow(ax, (0.45, 0.66), (0.52, 0.66), "HTTPS / WSS")
    # API <-> Mongo (two clean parallel arrows)
    arrow(ax, (0.715, 0.71), (0.80, 0.81))
    arrow(ax, (0.80, 0.79), (0.715, 0.665), color="#7a4f9c")
    ax.text(0.775, 0.745, "Mongoose", ha="center", fontsize=7, color="#37474f")
    # API -> Mood service (down) and back
    arrow(ax, (0.585, 0.55), (0.585, 0.22), "audio (multipart)", fs=7)
    arrow(ax, (0.625, 0.22), (0.625, 0.55), color="#c2693a", rad=0.0)
    # API -> Chatbot service and back
    arrow(ax, (0.705, 0.555), (0.87, 0.22), "query", fs=7)
    arrow(ax, (0.90, 0.22), (0.715, 0.545), color="#c2693a", rad=0.0)
    # socket push to clients
    arrow(ax, (0.52, 0.72), (0.45, 0.73), "real-time alerts\n(Socket.IO)", color="#2f8f5b", rad=0.0, fs=6.8)

    ax.text(0.11, 0.97, "Clients", ha="center", fontsize=8.5, style="italic", color="#555")
    ax.text(0.62, 0.97, "Application tier", ha="center", fontsize=8.5, style="italic", color="#555")
    ax.text(0.62, 0.255, "AI inference tier (Python sidecars)", ha="center", fontsize=8.5, style="italic", color="#555")
    fig.tight_layout(pad=0.3)
    fig.savefig(os.path.join(OUT, "fig_system_arch.png"), dpi=300, bbox_inches="tight")
    plt.close(fig)


# ============================================================== MOOD MODEL
def model_arch():
    fig, ax = plt.subplots(figsize=(3.4, 5.4))
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    cx, w = 0.18, 0.64
    ys = [0.90, 0.785, 0.665, 0.545]
    box(ax, cx, ys[0], w, 0.075, "Raw waveform\n16 kHz mono, ≤6 s", C_NEUTRAL, E_NEUTRAL, 8)
    box(ax, cx, ys[1], w, 0.085, "WavLM-Base-Plus\nCNN encoder (frozen)\n+ Transformer (fine-tuned)", C_AI, E_AI, 7.8, True)
    box(ax, cx, ys[2], w, 0.075, "Frame features\n(B, T, H=768)", C_NEUTRAL, E_NEUTRAL, 8)
    box(ax, cx, ys[3], w, 0.075, "Attentive masked\npooling → (B, 768)", C_API, E_API, 8, True)
    # two heads
    box(ax, 0.02, 0.36, 0.46, 0.10, "Mood head\nMLP → 6 logits", C_CLIENT, E_CLIENT, 7.8, True)
    box(ax, 0.52, 0.36, 0.46, 0.10, "Arousal head\nLinear → 2 logits", C_CLIENT, E_CLIENT, 7.8, True)
    box(ax, 0.18, 0.20, 0.64, 0.085, "Temperature-scaled\nsoftmax (T = 1.03)", C_DATA, E_DATA, 8, True)
    box(ax, 0.02, 0.045, 0.46, 0.09, "Mood + Top-K\n+ confidence", C_NEUTRAL, E_NEUTRAL, 7.8)
    box(ax, 0.52, 0.045, 0.46, 0.09, "Arousal\n(low / high)", C_NEUTRAL, E_NEUTRAL, 7.8)

    def cdown(y1, y2):
        arrow(ax, (0.5, y1), (0.5, y2))
    cdown(ys[0], ys[1] + 0.085)
    cdown(ys[1], ys[2] + 0.075)
    cdown(ys[2], ys[3] + 0.075)
    arrow(ax, (0.40, ys[3]), (0.25, 0.46))
    arrow(ax, (0.60, ys[3]), (0.75, 0.46))
    arrow(ax, (0.25, 0.36), (0.40, 0.285))
    arrow(ax, (0.50, 0.20), (0.25, 0.135))
    arrow(ax, (0.75, 0.46), (0.75, 0.135), text=None)
    fig.tight_layout(pad=0.2)
    fig.savefig(os.path.join(OUT, "fig_model_arch.png"), dpi=300, bbox_inches="tight")
    plt.close(fig)


# ============================================================== RAG PIPELINE
def rag_arch():
    fig, ax = plt.subplots(figsize=(7.0, 3.1))
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    box(ax, 0.01, 0.42, 0.15, 0.16, "User question\n(doctor / family)", C_CLIENT, E_CLIENT, 8)
    box(ax, 0.20, 0.42, 0.17, 0.16, "Semantic router\nMiniLM cosine\n→ patient /\nknowledge / hybrid", C_API, E_API, 7.6, True)
    # sources
    box(ax, 0.43, 0.70, 0.21, 0.16, "MongoDB patient\nrecord (source of\ntruth)", C_DATA, E_DATA, 7.8, True)
    box(ax, 0.43, 0.13, 0.21, 0.16, "FAISS KB\nMiniLM embeddings\n(PDF + web)", C_DATA, E_DATA, 7.8, True)
    box(ax, 0.68, 0.42, 0.15, 0.16, "Grounded\nprompt builder\n+ guardrails", C_AI, E_AI, 7.8, True)
    box(ax, 0.86, 0.42, 0.13, 0.16, "Groq\nLlama-3.3-70B\n(T = 0)", C_AI, E_AI, 7.8, True)
    arrow(ax, (0.16, 0.50), (0.20, 0.50))
    arrow(ax, (0.37, 0.54), (0.43, 0.74), "patient")
    arrow(ax, (0.37, 0.46), (0.43, 0.25), "knowledge")
    arrow(ax, (0.64, 0.74), (0.68, 0.55), color="#7a4f9c")
    arrow(ax, (0.64, 0.21), (0.68, 0.45), color="#7a4f9c")
    arrow(ax, (0.83, 0.50), (0.86, 0.50))
    arrow(ax, (0.925, 0.42), (0.925, 0.06), color="#c2693a")
    box(ax, 0.80, -0.02, 0.19, 0.08, "Grounded answer\n+ disclaimer", C_NEUTRAL, E_NEUTRAL, 7.6)
    fig.tight_layout(pad=0.2)
    fig.savefig(os.path.join(OUT, "fig_rag_arch.png"), dpi=300, bbox_inches="tight")
    plt.close(fig)


system_arch()
model_arch()
rag_arch()
print("diagrams written:", [f for f in os.listdir(OUT) if f.endswith(".png")])
