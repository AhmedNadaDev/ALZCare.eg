import React, { useState, useEffect, useCallback } from 'react';
import { cognitiveAPI } from '../../../modules/shared/api/api';
import {
  Modal, Field, inputCls, btnPrimary, btnGhost, Spinner, EmptyState,
  EMOTION_META, CATEGORY_META, mediaUrl,
} from '../constants.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';

const emptyItem = { name: '', relationship: '', story: '', emotion: 'neutral', location: '', takenAt: '' };

/**
 * AlbumEditor — manage a single album's metadata and its memory items
 * (photos / videos / voice notes with biographical detail).
 */
const AlbumEditor = ({ open, albumId, patientId, onClose, onChanged }) => {
  const [album, setAlbum] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [meta, setMeta] = useState({ title: '', description: '', category: 'family', emotion: 'neutral' });
  const [form, setForm] = useState(emptyItem);
  const [mediaFile, setMediaFile] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);

  const load = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await cognitiveAPI.getAlbum(albumId);
      setAlbum(res.data.album);
      setItems(res.data.items || []);
      setMeta({
        title: res.data.album.title || '',
        description: res.data.album.description || '',
        category: res.data.album.category || 'family',
        emotion: res.data.album.emotion || 'neutral',
      });
    } catch (e) {
      setErr(e.message || 'Failed to load album');
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const saveMeta = async () => {
    setSaving(true);
    setErr(null);
    try {
      const fd = new FormData();
      Object.entries(meta).forEach(([k, v]) => fd.append(k, v));
      await cognitiveAPI.updateAlbum(albumId, fd);
      onChanged?.();
    } catch (e) {
      setErr(e.message || 'Failed to save album');
    } finally {
      setSaving(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!mediaFile && !form.story && !form.name) {
      setErr('Add a photo/video, a name, or a short story.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (mediaFile) fd.append('media', mediaFile);
      if (voiceFile) fd.append('voiceNote', voiceFile);
      await cognitiveAPI.addItem(albumId, fd);
      setForm(emptyItem);
      setMediaFile(null);
      setVoiceFile(null);
      await load();
      onChanged?.();
    } catch (e2) {
      setErr(e2.message || 'Failed to add memory');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId) => {
    if (!window.confirm('Remove this memory?')) return;
    try {
      await cognitiveAPI.deleteItem(itemId);
      setItems((prev) => prev.filter((i) => i._id !== itemId));
      onChanged?.();
    } catch (e) {
      setErr(e.message || 'Failed to remove memory');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={album ? `Edit: ${album.title}` : 'Album'} maxWidth="max-w-4xl">
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-8">
          {err && <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{err}</div>}

          {/* Album meta */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Album title"><input className={inputCls} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
            <Field label="Category">
              <select className={inputCls} value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>
                {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k} className="bg-[#150a2b]">{v.emoji} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Description"><textarea className={inputCls} rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
            <Field label="Overall mood">
              <select className={inputCls} value={meta.emotion} onChange={(e) => setMeta({ ...meta, emotion: e.target.value })}>
                {Object.entries(EMOTION_META).map(([k, v]) => <option key={k} value={k} className="bg-[#150a2b]">{v.emoji} {v.label}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <button className={btnGhost} onClick={saveMeta} disabled={saving}>Save album details</button>
            </div>
          </section>

          {/* Items */}
          <section>
            <h4 className="text-sm font-semibold text-gray-200 mb-3">Memories ({items.length})</h4>
            {items.length === 0 ? (
              <EmptyState icon="🖼️" title="No memories yet" hint="Add photos of loved ones with their names and stories below." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {items.map((it) => (
                  <div key={it._id} className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/5">
                    <div className="aspect-square bg-black/30 flex items-center justify-center overflow-hidden">
                      {it.type === 'image' && it.mediaUrl ? (
                        <img src={mediaUrl(it.mediaUrl)} alt={it.name || 'memory'} className="w-full h-full object-cover" />
                      ) : it.type === 'video' && it.mediaUrl ? (
                        <video src={mediaUrl(it.mediaUrl)} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">{it.type === 'audio' ? '🎵' : '📝'}</span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-white truncate">{it.name || '—'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{it.relationship || it.location || ''}</p>
                    </div>
                    <button
                      onClick={() => removeItem(it._id)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-red-300 opacity-0 group-hover:opacity-100 transition"
                      aria-label="Remove memory"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add item form */}
            <form onSubmit={addItem} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faPlus} className="text-purple-400" aria-hidden="true" /> Add a memory
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Field label="Photo / Video"><input type="file" accept="image/*,video/*" className={inputCls} onChange={(e) => setMediaFile(e.target.files?.[0] || null)} /></Field>
                <Field label="Voice note (optional)"><input type="file" accept="audio/*" className={inputCls} onChange={(e) => setVoiceFile(e.target.files?.[0] || null)} /></Field>
                <Field label="Name"><input className={inputCls} placeholder="e.g. Sarah" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Relationship"><input className={inputCls} placeholder="e.g. Daughter" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} /></Field>
                <Field label="Story / description"><textarea className={inputCls} rows={2} placeholder="A short happy memory…" value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Emotion">
                    <select className={inputCls} value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })}>
                      {Object.entries(EMOTION_META).map(([k, v]) => <option key={k} value={k} className="bg-[#150a2b]">{v.emoji} {v.label}</option>)}
                    </select>
                  </Field>
                  <Field label="When"><input type="date" className={inputCls} value={form.takenAt} onChange={(e) => setForm({ ...form, takenAt: e.target.value })} /></Field>
                </div>
                <Field label="Location (optional)"><input className={inputCls} placeholder="e.g. Alexandria" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              </div>
              <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Adding…' : 'Add memory'}</button>
            </form>
          </section>
        </div>
      )}
    </Modal>
  );
};

export default AlbumEditor;
