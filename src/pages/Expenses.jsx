import React, { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";

const CATEGORIES = ["Transportation", "Staff", "Shop", "Electricity", "Repairs", "Stock Purchase", "Delivery", "Other"];

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setExpenses(await api.listExpenses());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this expense record?")) return;
    try {
      await api.deleteExpense(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Layout>
      <PageHeader title="Expenses — Money spent running the business" action={<Button icon={Plus} onClick={() => setShowForm(true)}>Add expense</Button>} />
      <ExplainerBox>
        Add anything you spend that isn't buying stock — transport, electricity, repairs, paying staff, and so on. This is subtracted when working out your real profit on the Reports page.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {!loading && expenses.length > 0 && (
        <p className="text-sm mb-6" style={{ color: "#6B6960" }}>Total recorded: <strong style={{ color: C.ink }}>{formatMoney(total)}</strong></p>
      )}

      {loading ? <Loading /> : expenses.length === 0 ? (
        <EmptyState message="No expenses recorded yet." />
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <Card key={e._id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold" style={{ color: C.ink }}>{e.category} — {formatMoney(e.amount)}</p>
                {e.description && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>{e.description}</p>}
                <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{new Date(e.date).toLocaleDateString()}</p>
              </div>
              <button onClick={() => handleDelete(e._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                <Trash2 size={12} /> Delete
              </button>
            </Card>
          ))}
        </div>
      )}

      {showForm && <ExpenseModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </Layout>
  );
}

function ExpenseModal({ onClose, onSaved }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount) {
      setError("Amount is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createExpense({ category, amount: Number(amount), description });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-sm w-full p-6" style={{ background: C.cream }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Add expense</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Amount (₦)"><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} /></Field>
          <Field label="Description (optional)"><input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} /></Field>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add expense"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
