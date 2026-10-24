import { useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';
import { uploadImage } from '../../../api/cloudinary';
import './Inventory.css';

const EMPTY_FORM = {
  name: '',
  sku: '',
  serial_number: '',
  brand: '',
  description: '',
  unit_price: '',
  quantity: '',
  min_stock_level: '5',
  image_url: '',
  category: '',
  filter_option_ids: [],
};

const MUTED = { fontSize: '0.8rem', color: 'var(--color-text-muted)' };

export default function Inventory() {
  const [parts, setParts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [editingId, setEditingId] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stockForm, setStockForm] = useState({ quantity: '', reason: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Filter types shown inside the add/edit form for the chosen category.
  const [formFilterTypes, setFormFilterTypes] = useState([]);

  // "Manage filters" pop-up.
  const [manageOpen, setManageOpen] = useState(false);
  const [mfCategory, setMfCategory] = useState('');
  const [mfTypes, setMfTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState({});

  // Search / category / price-range / low-stock filters for the table.
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  function load() {
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (category) params.category = category;
    if (minPrice !== '') params.min_price = minPrice;
    if (maxPrice !== '') params.max_price = maxPrice;
    if (lowStockOnly) params.low_stock = 1;
    api.get('/inventory', { params }).then((r) => setParts(r.data.data));
  }

  function loadCategories() {
    api
      .get('/inventory')
      .then((r) => {
        const set = new Set();
        (r.data.data || []).forEach((p) => {
          if (p.category && p.category.trim()) set.add(p.category.trim());
        });
        setAllCategories(Array.from(set).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, minPrice, maxPrice, lowStockOnly]);

  const existingCategories = allCategories;

  // Load the filter types for the category typed/picked in the add/edit form.
  useEffect(() => {
    if (!showForm) return;

    const cat = form.category.trim();
    if (!cat) {
      setFormFilterTypes([]);
      setForm((f) => (f.filter_option_ids.length ? { ...f, filter_option_ids: [] } : f));
      return;
    }

    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get('/inventory/filters', { params: { category: cat } })
        .then((r) => {
          if (cancelled) return;
          const types = r.data?.data || [];
          setFormFilterTypes(types);

          // Drop selected options that don't belong to this category.
          const valid = new Set(types.flatMap((ty) => ty.options.map((o) => o.id)));
          setForm((f) => {
            const kept = f.filter_option_ids.filter((id) => valid.has(id));
            return kept.length === f.filter_option_ids.length ? f : { ...f, filter_option_ids: kept };
          });
        })
        .catch(() => {
          if (!cancelled) setFormFilterTypes([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [showForm, form.category]);

  // Load filter types for the "Manage filters" pop-up.
  async function loadManageTypes(cat = mfCategory) {
    const c = cat.trim();
    if (!c) {
      setMfTypes([]);
      return;
    }
    try {
      const r = await api.get('/inventory/filters', { params: { category: c } });
      setMfTypes(r.data?.data || []);
    } catch {
      setMfTypes([]);
    }
  }

  useEffect(() => {
    if (!manageOpen) return;
    const t = setTimeout(() => loadManageTypes(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageOpen, mfCategory]);

  function clearFilters() {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setLowStockOnly(false);
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormFilterTypes([]);
    setFormMode('add');
    setEditingId(null);
    setError('');
    setShowForm(true);
  }

  function openEdit(part) {
    setForm({
      name: part.name,
      sku: part.sku,
      serial_number: part.serial_number || '',
      brand: part.brand || '',
      description: part.description || '',
      unit_price: part.unit_price,
      quantity: '',
      min_stock_level: part.min_stock_level,
      image_url: part.image_url || '',
      category: part.category || '',
      filter_option_ids: Array.isArray(part.option_ids) ? part.option_ids : [],
    });
    setFormMode('edit');
    setEditingId(part.id);
    setError('');
    setShowForm(true);
  }

  function toggleFormOption(id) {
    setForm((f) => ({
      ...f,
      filter_option_ids: f.filter_option_ids.includes(id)
        ? f.filter_option_ids.filter((x) => x !== id)
        : [...f.filter_option_ids, id],
    }));
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

  async function handleFormSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (formMode === 'edit') {
        const { quantity, ...rest } = form;
        await api.put(`/inventory/${editingId}`, rest);
      } else {
        await api.post('/inventory', form);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
      loadCategories();
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${formMode === 'edit' ? 'update' : 'add'} part.`);
    }
  }

  async function handleStockAction(e) {
    e.preventDefault();
    setError('');
    try {
      if (stockModal.mode === 'in') {
        await api.post(`/inventory/${stockModal.part.id}/stock-in`, { quantity: Number(stockForm.quantity), reason: stockForm.reason });
      } else {
        await api.post(`/inventory/${stockModal.part.id}/adjust`, { quantity: Number(stockForm.quantity), reason: stockForm.reason });
      }
      setStockModal(null);
      setStockForm({ quantity: '', reason: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Stock update failed.');
    }
  }

  // ---------- Manage filters actions ----------
  function openManage() {
    setMfCategory(category || '');
    setMfTypes([]);
    setNewTypeName('');
    setNewOptionValues({});
    setError('');
    setManageOpen(true);
  }

  async function addFilterType(e) {
    e.preventDefault();
    const cat = mfCategory.trim();
    const name = newTypeName.trim();
    if (!cat || !name) return;
    setError('');
    try {
      await api.post('/inventory/filter-types', { category: cat, name });
      setNewTypeName('');
      loadManageTypes(cat);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add filter.');
    }
  }

  async function addFilterOption(typeId) {
    const value = (newOptionValues[typeId] || '').trim();
    if (!value) return;
    setError('');
    try {
      await api.post('/inventory/filter-options', { filter_type_id: typeId, value });
      setNewOptionValues((cur) => ({ ...cur, [typeId]: '' }));
      loadManageTypes();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add option.');
    }
  }

  async function deleteFilterType(type) {
    if (!window.confirm(`Delete the "${type.name}" filter and all its options?`)) return;
    setError('');
    try {
      await api.delete(`/inventory/${type.id}/filter-type`);
      loadManageTypes();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete filter.');
    }
  }

  async function deleteFilterOption(opt) {
    if (!window.confirm(`Delete the option "${opt.value}"?`)) return;
    setError('');
    try {
      await api.delete(`/inventory/${opt.id}/filter-option`);
      loadManageTypes();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete option.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Manage spare parts stock levels and categories.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={openManage}>Manage filters</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Part</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search by name, SKU, serial number or brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {existingCategories.length > 0 && (
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {existingCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <input type="number" min={0} placeholder="Min price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input type="number" min={0} placeholder="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} style={{ width: 'auto' }} />
          Low stock only
        </label>
        {(search || category || minPrice !== '' || maxPrice !== '' || lowStockOnly) && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>Clear</button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Image</th><th>Part</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Min level</th><th></th></tr>
          </thead>
          <tbody>
            {parts.length === 0 && <tr><td colSpan={8} className="empty-state">No parts match your filters.</td></tr>}
            {parts.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius:6 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f1f1f1' }} />
                  )}
                </td>
                <td>
                  <div>{p.name}</div>
                  {(p.serial_number || p.brand) && (
                    <div style={MUTED}>
                      {p.brand}
                      {p.brand && p.serial_number ? ' | ' : ''}
                      {p.serial_number ? `Serial: ${p.serial_number}` : ''}
                    </div>
                  )}
                </td>
                <td>{p.sku}</td>
                <td>{p.category || <span style={{ color: 'var(--color-text-muted)' }}>Uncategorized</span>}</td>
                <td>MK {Number(p.unit_price).toLocaleString()}</td>
                <td>
                  {p.quantity}
                  {p.low_stock && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Low</span>}
                </td>
                <td>{p.min_stock_level}</td>
                <td className="action-cell">
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setStockModal({ part: p, mode: 'in' })}>StockIn</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setStockModal({ part: p, mode: 'adjust' })}>Adjust</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2>{formMode === 'edit' ? `Edit ${form.name}` : 'Add new part'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                <div className="form-group"><label>SKU</label><input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Serial number</label><input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} placeholder="Optional" /></div>
                <div className="form-group"><label>Brand</label><input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="e.g. Bosch, Michelin" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <input
                    list="category-options"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Air Filter, Car Battery, Brake Pads"
                  />
                  <datalist id="category-options">
                    {existingCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group"><label>Unit price (MK)</label><input type="number" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} required /></div>
              </div>

              {form.category.trim() && (
                <div className="form-group">
                  <label>Filters for {form.category.trim()}</label>
                  {formFilterTypes.length === 0 ? (
                    <p style={{ ...MUTED, margin: '4px 0 0' }}>
                      No filters set up for this category yet. Use "Manage filters" to add some.
                    </p>
                  ) : (
                    formFilterTypes.map((type) => (
                      <div key={type.id} style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{type.name}</div>
                        {type.options.length === 0 ? (
                          <span style={MUTED}>No options yet.</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 4 }}>
                            {type.options.map((opt) => (
                              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                                <input
                                  type="checkbox"
                                  style={{ width: 'auto' }}
                                  checked={form.filter_option_ids.includes(opt.id)}
                                  onChange={() => toggleFormOption(opt.id)}
                                />
                                {opt.value}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="form-group"><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              {formMode === 'add' ? (
                <div className="form-row">
                  <div className="form-group"><label>Initial quantity</label><input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></div>
                  <div className="form-group"><label>Minimum stock level (for low-stock alerts)</label><input type="number" value={form.min_stock_level} onChange={(e) => setForm((f) => ({ ...f, min_stock_level: e.target.value }))} /></div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Minimum stock level (for low-stock alerts)</label>
                  <input type="number" value={form.min_stock_level} onChange={(e) => setForm((f) => ({ ...f, min_stock_level: e.target.value }))} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                    To change stock quantity, use StockIn or Adjust instead.
                  </p>
                </div>
              )}
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
                  {formMode === 'edit' ? 'Save Changes' : 'Add Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="modal-backdrop" onClick={() => setManageOpen(false)}>
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2>Manage filters</h2>
            <p style={{ ...MUTED, marginTop: 0 }}>
              Filters are set up per category. Customers only see them after clicking Filters on that category's page.
            </p>

            <div className="form-group">
              <label>Category</label>
              <input
                list="manage-category-options"
                value={mfCategory}
                onChange={(e) => setMfCategory(e.target.value)}
                placeholder="Pick or type a category"
              />
              <datalist id="manage-category-options">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {mfCategory.trim() && (
              <>
                <form onSubmit={addFilterType} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="New filter type, e.g. Brand, Size, Vehicle Make"
                  />
                  <button type="submit" className="btn btn-primary" disabled={!newTypeName.trim()}>Add filter</button>
                </form>

                {mfTypes.length === 0 && (
                  <p style={MUTED}>No filters for this category yet.</p>
                )}

                {mfTypes.map((type) => (
                  <div key={type.id} style={{ border: '1px solid #e3e5e8', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{type.name}</strong>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => deleteFilterType(type)}>Delete filter</button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0' }}>
                      {type.options.length === 0 && <span style={MUTED}>No options yet.</span>}
                      {type.options.map((opt) => (
                        <span
                          key={opt.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#f1f1f1', fontSize: '0.85rem' }}
                        >
                          {opt.value}
                          <button
                            type="button"
                            onClick={() => deleteFilterOption(opt)}
                            title="Delete option"
                            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={newOptionValues[type.id] || ''}
                        onChange={(e) => setNewOptionValues((cur) => ({ ...cur, [type.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addFilterOption(type.id);
                          }
                        }}
                        placeholder={`Add a ${type.name} option`}
                      />
                      <button type="button" className="btn btn-outline" onClick={() => addFilterOption(type.id)}>Add</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setManageOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {stockModal && (
        <div className="modal-backdrop" onClick={() => setStockModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{stockModal.mode === 'in' ? 'Receive stock' : 'Adjust stock'} — {stockModal.part.name}</h2>
            <form onSubmit={handleStockAction}>
              <div className="form-group">
                <label>{stockModal.mode === 'in' ? 'Quantity received' : 'Quantity change (use negative to reduce)'}</label>
                <input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((f) => ({ ...f, quantity: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input value={stockForm.reason} onChange={(e) => setStockForm((f) => ({ ...f, reason: e.target.value }))}placeholder="e.g. Supplier delivery, stock count correction" required={stockModal.mode === 'adjust'} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStockModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}