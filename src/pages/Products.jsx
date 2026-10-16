import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, useToast } from "../components/ui";
import { errText, peso } from "../utils";

const blank = {
  name: "",
  barcode: "",
  category: "",
  price: "",
  cost: "",
  stock: "",
  low_stock: 5,
  image: "",
  variants: [],
};

export default function Products() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const load = useCallback(() => {
    api.products().then(setList).catch((e) => toast(errText(e), "err"));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVar = (i, k, v) =>
    set("variants", form.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return toast("Photo is too large (max 5MB)", "err");
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 320;
        let w = img.width;
        let h = img.height;
        if (w > h && w > max) {
          h = Math.round((h * max) / w);
          w = max;
        } else if (h > max) {
          w = Math.round((w * max) / h);
          h = max;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        set("image", dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const generateBarcode = () => {
    const code = "2" + String(Date.now()).slice(-9) + Math.floor(Math.random() * 90 + 10);
    set("barcode", code);
  };

  const save = async () => {
    try {
      await api.saveProduct({
        ...form,
        price: Number(form.price),
        cost: Number(form.cost || 0),
        stock: Number(form.stock || 0),
        low_stock: Number(form.low_stock || 0),
        image: form.image || "",
        variants: form.variants.map((v) => ({
          name: v.name,
          qty: Number(v.qty),
          price: Number(v.price),
        })),
      });
      toast("Product saved");
      setForm(null);
      load();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}"? Past sales stay in history.`)) return;
    await api.deleteProduct(p.id);
    load();
  };

  const shown = list.filter((p) =>
    (p.name + p.category + p.barcode).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Products" subtitle={`${list.length} products`}>
        <button id="add-product" className="btn" onClick={() => setForm({ ...blank })}>
          <Plus size={16} /> Add product
        </button>
      </PageHeader>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search products or scan barcode…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="card">
        {shown.length === 0 ? (
          <Empty text="No products yet" />
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}>Photo</th>
                <th>Name</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th className="num">Cost</th>
                <th className="num">Stock</th>
                <th>Variants</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="row-hover">
                  <td>
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="thumb" />
                    ) : (
                      <div className="thumb placeholder-thumb">
                        <ImageIcon size={18} opacity={0.4} />
                      </div>
                    )}
                  </td>
                  <td>
                    <b>{p.name}</b>
                    {p.barcode && (
                      <div>
                        <span className="barcode-badge">{p.barcode}</span>
                      </div>
                    )}
                  </td>
                  <td>{p.category || "—"}</td>
                  <td className="num">{peso(p.price)}</td>
                  <td className="num">{peso(p.cost)}</td>
                  <td className="num">
                    <span
                      className={
                        "badge" +
                        (p.stock <= 0 ? " bad" : p.stock <= p.low_stock ? " warn" : "")
                      }
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td>
                    {p.variants.map((v) => (
                      <div key={v.id}>
                        <small>
                          {v.name}: {v.qty} pcs = {peso(v.price)}
                        </small>
                      </div>
                    ))}
                  </td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn" onClick={() => setForm({ ...p })}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => remove(p)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? "Edit product" : "Add product"}
          onClose={() => setForm(null)}
          wide
        >
          {/* Photo upload section */}
          <div className="photo-picker-box">
            {form.image ? (
              <div className="photo-preview-wrap">
                <img src={form.image} alt="Product preview" className="photo-preview" />
                <button
                  type="button"
                  className="btn ghost sm danger-text"
                  onClick={() => set("image", "")}
                >
                  <Trash2 size={14} /> Remove photo
                </button>
              </div>
            ) : (
              <div className="photo-empty-drop" onClick={() => fileInputRef.current?.click()}>
                <Camera size={26} opacity={0.6} />
                <span>Upload product photo (JPG/PNG)</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageFile}
            />
            {!form.image && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={14} /> Browse photo
              </button>
            )}
          </div>

          <div className="grid2">
            <Field label="Name">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Product name"
              />
            </Field>
            <Field label="Category">
              <input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Candy, Drinks, Snacks…"
              />
            </Field>
            <Field label="Regular price (1 pc)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>
            <Field label="Cost / Puhunan (1 pc)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
              />
            </Field>
            {!form.id && (
              <Field label="Starting stock (pcs)">
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </Field>
            )}
            <Field label="Low-stock alert at">
              <input
                type="number"
                min="0"
                value={form.low_stock}
                onChange={(e) => set("low_stock", e.target.value)}
              />
            </Field>
            <Field label="Barcode">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={form.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  placeholder="Scan or enter barcode"
                />
                <button
                  type="button"
                  className="btn ghost sm"
                  title="Generate barcode automatically"
                  onClick={generateBarcode}
                >
                  <Sparkles size={14} /> Auto
                </button>
              </div>
            </Field>
          </div>

          <div className="card" style={{ boxShadow: "none" }}>
            <h3>Variants / bundle prices</h3>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Example: Candy 1 pc = ₱2. Add variant "3 pcs" → qty 3, price ₱5. Selling it deducts 3
              from the main stock.
            </p>
            {form.variants.map((v, i) => (
              <div className="var-row" key={i} style={{ marginBottom: 8 }}>
                <input
                  placeholder="Name (e.g. 3 pcs)"
                  value={v.name}
                  onChange={(e) => setVar(i, "name", e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty deducted"
                  value={v.qty}
                  onChange={(e) => setVar(i, "qty", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={v.price}
                  onChange={(e) => setVar(i, "price", e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    set(
                      "variants",
                      form.variants.filter((_, j) => j !== i)
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() =>
                set("variants", [...form.variants, { name: "", qty: "", price: "" }])
              }
            >
              <Plus size={14} /> Add variant
            </button>
          </div>
          <button className="btn" disabled={!form.name || form.price === ""} onClick={save}>
            Save product
          </button>
        </Modal>
      )}
    </>
  );
}
