import axios from 'axios';
import FormData from 'form-data';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10);

const mlApi = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

const extractFaces = (data) => {
  const faces = data?.faces || {};
  const models = data?.models || ['buffalo_l', 'facenet', 'vggface2'];
  return { faces, models };
};

export const embedBuffersAllModels = async (buffers = []) => {
  if (!buffers.length) return { faces: {}, models: [] };

  const form = new FormData();
  form.append('model_name', 'all');
  buffers.forEach((buf, idx) => {
    form.append('files', buf, `image-${idx}.jpg`);
  });

  const response = await mlApi.post('/embed', form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });

  return extractFaces(response.data);
};

export const embedBase64AllModels = async (base64Image, modelName = 'all') => {
  if (!base64Image) {
    return { faces: {}, models: [] };
  }

  const response = await mlApi.post('/embed/base64', {
    image: base64Image,
    model_name: modelName,
  });
  return extractFaces(response.data);
};
