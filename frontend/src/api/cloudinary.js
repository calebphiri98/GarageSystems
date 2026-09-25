import api from './api';

export async function uploadImage(file) {
  // 1. Ask our own backend for a short-lived signature (secret never touches the browser).
  const { data } = await api.get('/cloudinary/sign');
  const { timestamp, signature, api_key, cloud_name } = data.data;

  // 2. Upload directly to Cloudinary using that signature.
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || 'Image upload failed.');
  }

  const uploaded = await res.json();
  return uploaded.secure_url;
}
