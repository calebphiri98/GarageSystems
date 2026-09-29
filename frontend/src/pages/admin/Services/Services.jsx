import { useEffect, useState } from 'react';
import api from '../../../api/api';
import { uploadImage } from '../../../api/cloudinary';

const EMPTY_FORM = { name: '', description: '', estimated_price: '', image_url: '' };

export default function Services() {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    api
      .get('/services', { params: { all: 1 } })
      .then((r) => setServices(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load services.'));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormMode('add');
    setEditingId(null);
    setError('');
    setMessage('');
    setShowForm(true);
  }

  function openEdit(service) {
    setForm({
      name: service.name,
      description: service.description || '',
      estimated_price: service.estimated_price ?? '',
      image_url: service.image_url || '',
    });
    setFormMode('edit');
    setEditingId(service.id);
    setError('');
    setMessage('');
    setShowForm(true);
  }

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      name: form.name,
      description: form.description,
      estimated_price: form.estimated_price === '' ? null : form.estimated_price,
      image_url: form.image_url,
    };
    try {
      if (formMode === 'edit') {
        await api.put(`/services/${editingId}`, payload);
        setMessage('Service updated.');
      } else {
        await api.post('/services', payload);
        setMessage('Service added.');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${formMode === 'edit' ? 'update' : 'add'} service.`);
    }
  }

  async function toggleActive(service) {
    setError('');
    setMessage('');
    try {
      await api.put(`/services/${service.id}`, { is_active: !service.is_active });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update service status.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Services</h1>
          <p>Manage the services shown on the public site and to customers.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Service</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Image</th><th>Name</th><th>Description</th><th>Price</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {services.length === 0 && <tr><td colSpan={6} className="empty-state">No services yet.</td></tr>}
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f1f1f1' }} />
                  )}
                </td>
                <td>{s.name}</td>
                <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>{s.description || <span style={{ color: 'var(--color-text-muted)' }}>No description</span>}</td>
                <td>{s.estimated_price !== null && s.estimated_price !== undefined && s.estimated_price !== '' ? `MK ${Number(s.estimated_price).toLocaleString()}` : <span style={{ color: 'var(--color-text-muted)' }}>Not set</span>}</td>
                <td>
                  <span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="action-cell">
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn btn-outline btn-sm" onClick={() => toggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{formMode === 'edit' ? `Edit ${form.name}` : 'Add new service'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Estimated price (MK) — leave blank if it varies</label>
                <input type="number" value={form.estimated_price} onChange={(e) => setForm((f) => ({ ...f, estimated_price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Photo</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {uploading && <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Uploading…</p>}
                {form.image_url && !uploading && (
                  <img src={form.image_url} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 8 }} />
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {formMode === 'edit' ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}