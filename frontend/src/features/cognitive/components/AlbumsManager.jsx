import React, { useState } from 'react';
import { cognitiveAPI } from '../../../modules/shared/api/api';
import {
  Modal, Field, inputCls, btnPrimary, btnGhost, EmptyState,
  CATEGORY_META, EMOTION_META, mediaUrl,
} from '../constants.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import AlbumEditor from './AlbumEditor';

const emptyAlbum = { title: '', description: '', category: 'family', emotion: 'love' };

/**
 * AlbumsManager — grid of memory albums with create + open-to-edit.
 */
const AlbumsManager = ({ patientId, albums, refetchAlbums }) => {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyAlbum);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [editId, setEditId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Please enter a title'); return; }
    setSaving(true);
    setErr(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (coverFile) fd.append('coverImage', coverFile);
      await cognitiveAPI.createAlbum(patientId, fd);
      setForm(emptyAlbum);
      setCoverFile(null);
      setCreating(false);
      await refetchAlbums();
    } catch (e2) {
      setErr(e2.message || 'Failed to create album');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (album) => {
    if (!window.confirm(`Delete "${album.title}" and all its memories?`)) return;
    setDeleting(album._id);
    setErr(null);
    try {
      await cognitiveAPI.deleteAlbum(album._id);
      await refetchAlbums();
    } catch (e2) {
      setErr(e2.message || 'Failed to delete album');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Memory Albums</h3>
          <p className="text-sm text-gray-400">Photos, videos and voice notes of people and moments.</p>
        </div>
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" /> New album
        </button>
      </div>

      {err && !creating && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{err}</div>
      )}

      {albums.length === 0 ? (
        <EmptyState icon="📸" title="No albums yet" hint="Create your first album to start building a memory library." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((a) => (
            <div
              key={a._id}
              role="button"
              tabIndex={0}
              className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-purple-500/40 transition cursor-pointer"
              onClick={() => setEditId(a._id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setEditId(a._id)}
              aria-label={`Open album: ${a.title}`}
            >
              <div className="aspect-video bg-gradient-to-br from-purple-900/40 to-violet-900/30 flex items-center justify-center overflow-hidden">
                {a.coverImage ? (
                  <img src={mediaUrl(a.coverImage)} alt={a.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">{CATEGORY_META[a.category]?.emoji || '📦'}</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-white truncate">{a.title}</h4>
                  <span className="text-lg shrink-0">{EMOTION_META[a.emotion]?.emoji}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {CATEGORY_META[a.category]?.label} · {a.itemCount || 0} {a.itemCount === 1 ? 'memory' : 'memories'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(a); }}
                disabled={deleting === a._id}
                className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-red-300 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                aria-label="Delete album"
              >
                {deleting === a._id
                  ? <span className="block w-4 h-4 border-2 border-red-300/40 border-t-red-300 rounded-full animate-spin" />
                  : <FontAwesomeIcon icon={faTrash} aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="New memory album">
        <form onSubmit={create}>
          {err && <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{err}</div>}
          <Field label="Title"><input className={inputCls} placeholder="e.g. Our Family Trips" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k} className="bg-[#150a2b]">{v.emoji} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Mood">
              <select className={inputCls} value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })}>
                {Object.entries(EMOTION_META).map(([k, v]) => <option key={k} value={k} className="bg-[#150a2b]">{v.emoji} {v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description (optional)"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Cover image (optional)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setCoverFile(e.target.files?.[0] || null)} /></Field>
          <div className="flex gap-3 justify-end mt-2">
            <button type="button" className={btnGhost} onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Creating…' : 'Create album'}</button>
          </div>
        </form>
      </Modal>

      <AlbumEditor
        open={!!editId}
        albumId={editId}
        patientId={patientId}
        onClose={() => setEditId(null)}
        onChanged={refetchAlbums}
      />
    </div>
  );
};

export default AlbumsManager;
