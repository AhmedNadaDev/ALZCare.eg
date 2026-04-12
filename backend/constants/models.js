export const MODEL_CONFIG = {
  buffalo_l: { dim: 512, label: 'ArcFace (buffalo_l)' },
  facenet: { dim: 512, label: 'FaceNet' },
  vggface2: { dim: 512, label: 'VGGFace2' },
};

export const MODEL_NAMES = Object.keys(MODEL_CONFIG);
