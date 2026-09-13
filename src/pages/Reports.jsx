import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Card, Loading, ErrorBanner, ExplainerBox } from "../components/ui";

const PERIODS = [
  ["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["year", "This Year"],
];

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

export default function Reports() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [year, setYear] = useState(new Date().getFullYear());
  const [yearly, setYearly] = useState(null);
  const [yearlyLoading, setYearlyLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setData(await api.getReportSummary(period));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period]);

  useEffect(() => {
    async function loadYearly() {
      setYearlyLoading(true);
      try {
        setYearly(await api.getYearlyReport(year));
      } catch (err) {
        setError(err.message);
      } finally {
        setYearlyLoading(false);
      }
    }
    loadYearly();
  }, [year]);

  const periodLabel = PERIODS.find(([k]) => k === period)?.[1] || "this period";

  return (
    <Layout>
      <PageHeader title="Reports — Is the business making money?" />
      <ExplainerBox>
        This page tells you whether the business made money or lost money. Pick a time below — Today, This Week, This Month, or This Year — and it will add up everything you sold, everything you spent, and show you what's left.
      </ExplainerBox>

      <div className="flex gap-2 mb-6">
        {PERIODS.map(([key, label]) => (
          <button key={key} onClick={() => setPeriod(key)} className="text-xs uppercase tracking-wide px-3 py-1.5"
            style={{ border: `1px solid ${period === key ? C.safety : "#C9C5BA"}`, color: period === key ? C.safety : "#6B6960" }}>
            {label}
          </button>
        ))}
      </div>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Money that came in</p>
              <p className="text-xs mb-2" style={{ color: "#6B6960" }}>Everything customers paid you for {periodLabel.toLowerCase()}</p>
              <p className="text-2xl font-bold" style={{ color: C.ink }}>{formatMoney(data.revenue)}</p>
            </Card>
            <Card>
              <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>What those goods cost you</p>
              <p className="text-xs mb-2" style={{ color: "#6B6960" }}>What you originally paid to buy the things you sold</p>
              <p className="text-2xl font-bold" style={{ color: C.ink }}>{formatMoney(data.costOfGoodsSold)}</p>
            </Card>
            <Card>
              <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Other money spent</p>
              <p className="text-xs mb-2" style={{ color: "#6B6960" }}>Transport, electricity, staff, repairs, and other running costs</p>
              <p className="text-2xl font-bold" style={{ color: C.ink }}>{formatMoney(data.totalExpenses)}</p>
            </Card>
            <Card style={{ background: data.netProfit >= 0 ? C.greenBg : C.redBg }}>
              <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>{data.netProfit >= 0 ? "Your profit" : "Your loss"}</p>
              <p className="text-xs mb-2" style={{ color: "#6B6960" }}>What's really left after everything is paid for — this is the important number</p>
              <p className="text-2xl font-bold flex items-center gap-1.5" style={{ color: data.netProfit >= 0 ? C.green : C.red }}>
                {data.netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {formatMoney(Math.abs(data.netProfit))}
              </p>
            </Card>
          </div>

          <div className="text-sm mb-8 px-4 py-3" style={{ background: C.concreteD, color: C.ink }}>
            In short: you took in <strong>{formatMoney(data.revenue)}</strong>, spent <strong>{formatMoney(data.costOfGoodsSold + data.totalExpenses)}</strong> in total (goods + running costs), and {data.netProfit >= 0 ? <>kept <strong style={{ color: C.green }}>{formatMoney(data.netProfit)}</strong> as profit.</> : <>lost <strong style={{ color: C.red }}>{formatMoney(Math.abs(data.netProfit))}</strong> for {periodLabel.toLowerCase()}.</>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <p className="text-sm font-semibold mb-3" style={{ color: C.ink }}>What happened {periodLabel.toLowerCase()}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span style={{ color: "#6B6960" }}>Number of sales made</span><span style={{ color: C.ink }}>{data.salesCount}</span></div>
                <div className="flex justify-between"><span style={{ color: "#6B6960" }}>Total items sold</span><span style={{ color: C.ink }}>{data.unitsSold}</span></div>
                <div className="flex justify-between"><span style={{ color: "#6B6960" }}>Spent buying new stock</span><span style={{ color: C.ink }}>{formatMoney(data.stockPurchasedCost)}</span></div>
              </div>
            </Card>
            <Card>
              <p className="text-sm font-semibold mb-3" style={{ color: C.ink }}>Your best-selling products</p>
              {data.topProducts.length === 0 ? (
                <p className="text-sm" style={{ color: "#8A877D" }}>Nothing sold in this period yet.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {data.topProducts.map(p => (
                    <div key={p.name} className="flex justify-between">
                      <span style={{ color: C.ink }}>{p.name}</span>
                      <span style={{ color: "#6B6960" }}>{p.units} sold · {formatMoney(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="mt-10 pt-8" style={{ borderTop: `1px solid ${C.ink}22` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Your whole year, month by month</p>
        <p className="text-xs mb-4" style={{ color: "#6B6960" }}>
          The blue bar is money in, orange is money spent, green is what you kept as profit. Taller green bars mean a better month.
        </p>
        <div className="flex items-center justify-end mb-4">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="text-xs px-3 py-1.5" style={{ border: "1px solid #C9C5BA", background: "white" }}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {yearlyLoading ? <Loading /> : yearly && (
          <Card>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={yearly.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4DFD3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Money in" fill={C.blueprint} />
                  <Bar dataKey="expenses" name="Money spent" fill={C.safety} />
                  <Bar dataKey="netProfit" name="Profit kept" fill={C.green} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
