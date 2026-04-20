import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const USERS = { A: "Shivanya", B: "Ashutosh" };
const CATEGORIES = ["🍽️ Food", "🏠 Rent", "🚗 Transport", "🛒 Groceries", "💊 Health", "🎉 Fun", "🧾 Bills", "✈️ Travel", "🛍️ Shopping", "📦 Other"];
const SPLIT_PRESETS = [
  { label: "50 / 50", a: 50, b: 50 },
  { label: "60 / 40", a: 60, b: 40 },
  { label: "40 / 60", a: 40, b: 60 },
  { label: "70 / 30", a: 70, b: 30 },
  { label: "30 / 70", a: 30, b: 70 },
  { label: "100 / 0", a: 100, b: 0 },
  { label: "0 / 100", a: 0, b: 100 },
  { label: "Custom", a: null, b: null },
];

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Math.abs(n));
}

function calcOwed(expenses) {
  let paidA = 0, paidB = 0, owesA = 0, owesB = 0;
  expenses.forEach((e) => {
    const amt = parseFloat(e.amount);
    const shareA = (e.splitA / 100) * amt;
    const shareB = (e.splitB / 100) * amt;
    if (e.payer === "A") { paidA += amt; owesA += shareA; owesB += shareB; }
    else { paidB += amt; owesA += shareA; owesB += shareB; }
  });
  const netA = paidA - owesA;
  return { netA, paidA, paidB, owesA, owesB };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem("ourwallet_user") || null);
  const [expenses, setExpenses] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

  // Real-time Firestore listener — updates instantly on both devices
  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExpenses(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const addExpense = useCallback(async (expense) => {
    try {
      await setDoc(doc(db, "expenses", expense.id), expense);
      setSaveStatus("✓ Synced");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus("⚠ Sync failed");
    }
  }, []);

  const deleteExpense = useCallback(async (id) => {
    try {
      await deleteDoc(doc(db, "expenses", id));
      setSaveStatus("✓ Deleted");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const login = (user) => {
    setCurrentUser(user);
    localStorage.setItem("ourwallet_user", user);
  };
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("ourwallet_user");
  };

  if (loading) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen onLogin={login} />;

  return (
    <Shell user={currentUser} onLogout={logout} tab={tab} setTab={setTab} saveStatus={saveStatus}>
      {tab === "dashboard" && <Dashboard expenses={expenses} currentUser={currentUser} />}
      {tab === "add" && <AddExpense onAdd={addExpense} currentUser={currentUser} onDone={() => setTab("dashboard")} />}
      {tab === "history" && <History expenses={expenses} onDelete={deleteExpense} />}
      {tab === "summary" && <Summary expenses={expenses} />}
    </Shell>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={styles.loadWrap}>
      <div style={styles.loadDot} />
      <p style={styles.loadText}>Loading your shared wallet…</p>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <div style={styles.loginBg}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeart}>💑</div>
        <h1 style={styles.loginTitle}>OurWallet</h1>
        <p style={styles.loginSub}>Shared expenses, zero stress</p>
        <p style={styles.loginPrompt}>Who are you today?</p>
        <div style={styles.loginBtns}>
          {Object.entries(USERS).map(([key, name]) => (
            <button key={key} style={styles.loginBtn} onClick={() => onLogin(key)}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              <span style={styles.loginAvatar}>{name[0]}</span>
              <span style={styles.loginName}>{name}</span>
            </button>
          ))}
        </div>
        <p style={styles.loginNote}>Data syncs in real-time between both devices 🔗</p>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ children, user, onLogout, tab, setTab, saveStatus }) {
  const tabs = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "add", icon: "+", label: "Add" },
    { id: "history", icon: "≡", label: "History" },
    { id: "summary", icon: "⇄", label: "Owes" },
  ];
  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>💑 OurWallet</span>
          {saveStatus && <span style={styles.sync}>{saveStatus}</span>}
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userChip}>
            <span style={styles.userDot}>{USERS[user][0]}</span>
            <span style={styles.userName}>{USERS[user]}</span>
          </div>
          <button style={styles.logoutBtn} onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
      <nav style={styles.nav}>
        {tabs.map(t => (
          <button key={t.id}
            style={{ ...styles.navBtn, ...(tab === t.id ? styles.navBtnActive : {}) }}
            onClick={() => setTab(t.id)}>
            <span style={{ ...styles.navIcon, color: tab === t.id ? C.terra : C.muted }}>{t.icon}</span>
            <span style={{ ...styles.navLabel, color: tab === t.id ? C.terra : C.muted }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ expenses }) {
  const { netA, paidA, paidB } = calcOwed(expenses);
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  const recentByCategory = {};
  expenses.slice(-20).forEach(e => {
    const cat = e.category || "📦 Other";
    recentByCategory[cat] = (recentByCategory[cat] || 0) + parseFloat(e.amount);
  });
  const topCats = Object.entries(recentByCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const owedMsg = () => {
    if (Math.abs(netA) < 0.01) return { text: "All settled up! 🎉", color: "#5c8a5c" };
    if (netA > 0) return { text: `${USERS.B} owes ${USERS.A} ${fmt(netA)}`, color: "#fff" };
    return { text: `${USERS.A} owes ${USERS.B} ${fmt(Math.abs(netA))}`, color: "#fff" };
  };
  const owed = owedMsg();

  return (
    <div style={styles.page}>
      <div style={styles.balanceCard}>
        <p style={styles.balanceLabel}>Total Shared Spending</p>
        <p style={styles.balanceAmount}>{fmt(total)}</p>
        <div style={{ ...styles.owedBadge, color: owed.color }}>{owed.text}</div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statName}>{USERS.A} paid</p>
          <p style={styles.statVal}>{fmt(paidA)}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statName}>{USERS.B} paid</p>
          <p style={styles.statVal}>{fmt(paidB)}</p>
        </div>
      </div>

      {topCats.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Top Categories</p>
          <div style={styles.catGrid}>
            {topCats.map(([cat, amt]) => (
              <div key={cat} style={styles.catCard}>
                <span style={styles.catEmoji}>{cat.split(" ")[0]}</span>
                <span style={styles.catName}>{cat.split(" ").slice(1).join(" ")}</span>
                <span style={styles.catAmt}>{fmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyIcon}>🧾</p>
          <p style={styles.emptyText}>No expenses yet.<br />Add your first one!</p>
        </div>
      )}

      {expenses.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Recent</p>
          {[...expenses].reverse().slice(0, 5).map(e => (
            <ExpenseRow key={e.id} expense={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ expense: e, onDelete }) {
  return (
    <div style={styles.expRow}>
      <div style={styles.expLeft}>
        <span style={styles.expCat}>{e.category?.split(" ")[0] || "📦"}</span>
        <div style={{ minWidth: 0 }}>
          <p style={styles.expDesc}>{e.description || e.category}</p>
          <p style={styles.expMeta}>{USERS[e.payer]} paid · {e.splitA}% / {e.splitB}% · {new Date(e.date).toLocaleDateString()}</p>
        </div>
      </div>
      <div style={styles.expRight}>
        <span style={styles.expAmt}>{fmt(e.amount)}</span>
        {onDelete && (
          <button style={styles.delBtn} onClick={() => onDelete(e.id)}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Add Expense ──────────────────────────────────────────────────────────────
function AddExpense({ onAdd, currentUser, onDone }) {
  const [form, setForm] = useState({
    amount: "", category: CATEGORIES[0], description: "",
    payer: currentUser, splitPreset: "50 / 50",
    splitA: 50, splitB: 50, customA: "", customB: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePreset = (preset) => {
    set("splitPreset", preset.label);
    if (preset.a !== null) { set("splitA", preset.a); set("splitB", preset.b); }
  };

  const handleCustom = (who, val) => {
    const n = Math.min(100, Math.max(0, parseInt(val) || 0));
    if (who === "A") { set("customA", val); set("splitA", n); set("splitB", 100 - n); set("customB", String(100 - n)); }
    else { set("customB", val); set("splitB", n); set("splitA", 100 - n); set("customA", String(100 - n)); }
  };

  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.description.trim()) e.description = "Add a description";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    const newExp = {
      id: Date.now().toString(),
      amount: parseFloat(form.amount).toFixed(2),
      category: form.category,
      description: form.description.trim(),
      payer: form.payer,
      splitA: form.splitA,
      splitB: form.splitB,
      date: new Date().toISOString(),
      addedBy: currentUser,
    };
    await onAdd(newExp);
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onDone(); }, 900);
  };

  if (saved) return (
    <div style={styles.savedScreen}>
      <div style={styles.savedIcon}>✓</div>
      <p style={styles.savedText}>Expense added!</p>
    </div>
  );

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>New Expense</h2>

      <div style={styles.formGroup}>
        <label style={styles.label}>Amount</label>
        <div style={styles.amountWrap}>
          <span style={styles.currency}>$</span>
          <input style={{ ...styles.input, ...styles.amountInput, ...(errors.amount ? styles.inputErr : {}) }}
            type="number" min="0" step="0.01" placeholder="0.00"
            value={form.amount} onChange={e => { set("amount", e.target.value); setErrors(f => ({ ...f, amount: "" })); }} />
        </div>
        {errors.amount && <p style={styles.err}>{errors.amount}</p>}
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Description</label>
        <input style={{ ...styles.input, ...(errors.description ? styles.inputErr : {}) }}
          placeholder="What was this for?"
          value={form.description} onChange={e => { set("description", e.target.value); setErrors(f => ({ ...f, description: "" })); }} />
        {errors.description && <p style={styles.err}>{errors.description}</p>}
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Category</label>
        <select style={styles.select} value={form.category} onChange={e => set("category", e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Who paid?</label>
        <div style={styles.payerRow}>
          {Object.entries(USERS).map(([key, name]) => (
            <button key={key}
              style={{ ...styles.payerBtn, ...(form.payer === key ? styles.payerBtnActive : {}) }}
              onClick={() => set("payer", key)}>
              <span style={styles.payerAvatar}>{name[0]}</span> {name}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Split Ratio</label>
        <div style={styles.splitPresets}>
          {SPLIT_PRESETS.map(p => (
            <button key={p.label}
              style={{ ...styles.splitBtn, ...(form.splitPreset === p.label ? styles.splitBtnActive : {}) }}
              onClick={() => handlePreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        {form.splitPreset === "Custom" ? (
          <div style={styles.customSplit}>
            <div style={styles.customField}>
              <label style={styles.smallLabel}>{USERS.A} %</label>
              <input style={styles.smallInput} type="number" min="0" max="100"
                value={form.customA} onChange={e => handleCustom("A", e.target.value)} placeholder="50" />
            </div>
            <span style={styles.splitDivider}>/</span>
            <div style={styles.customField}>
              <label style={styles.smallLabel}>{USERS.B} %</label>
              <input style={styles.smallInput} type="number" min="0" max="100"
                value={form.customB} onChange={e => handleCustom("B", e.target.value)} placeholder="50" />
            </div>
          </div>
        ) : (
          <div style={styles.splitPreview}>
            <div style={styles.splitBar}>
              <div style={{ ...styles.splitBarA, width: `${form.splitA}%` }} />
              <div style={{ ...styles.splitBarB, width: `${form.splitB}%` }} />
            </div>
            <div style={styles.splitLabels}>
              <span>{USERS.A}: {form.splitA}%</span>
              <span>{USERS.B}: {form.splitB}%</span>
            </div>
            {form.amount && !isNaN(parseFloat(form.amount)) && (
              <div style={styles.splitAmounts}>
                <span>{fmt(parseFloat(form.amount) * form.splitA / 100)}</span>
                <span>{fmt(parseFloat(form.amount) * form.splitB / 100)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <button style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Add Expense"}
      </button>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History({ expenses, onDelete }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...new Set(expenses.map(e => e.category))];
  const filtered = filter === "All" ? expenses : expenses.filter(e => e.category === filter);

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>Expense History</h2>
      <div style={styles.filterRow}>
        {cats.slice(0, 6).map(c => (
          <button key={c}
            style={{ ...styles.filterBtn, ...(filter === c ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter(c)}>
            {c === "All" ? "All" : c.split(" ")[0]}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={styles.empty}><p style={styles.emptyText}>No expenses here yet.</p></div>
      ) : (
        [...filtered].reverse().map(e => <ExpenseRow key={e.id} expense={e} onDelete={onDelete} />)
      )}
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function Summary({ expenses }) {
  const { netA, paidA, paidB, owesA, owesB } = calcOwed(expenses);

  const rows = [
    { label: `${USERS.A} paid`, val: paidA, positive: true },
    { label: `${USERS.B} paid`, val: paidB, positive: true },
    { label: `${USERS.A}'s share`, val: owesA, positive: false },
    { label: `${USERS.B}'s share`, val: owesB, positive: false },
  ];

  const verdict = () => {
    if (Math.abs(netA) < 0.01) return { msg: "You're all even! 🎉 Great teamwork.", settled: true };
    if (netA > 0) return { msg: `${USERS.B} owes ${USERS.A} ${fmt(netA)}`, settled: false };
    return { msg: `${USERS.A} owes ${USERS.B} ${fmt(Math.abs(netA))}`, settled: false };
  };
  const v = verdict();

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>Who Owes Whom</h2>

      <div style={styles.verdictCard}>
        <p style={styles.verdictEmoji}>{v.settled ? "🎉" : "💸"}</p>
        <p style={styles.verdictText}>{v.msg}</p>
        <p style={styles.verdictSub}>Based on {expenses.length} expense{expenses.length !== 1 ? "s" : ""}</p>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Breakdown</p>
        {rows.map(r => (
          <div key={r.label} style={styles.breakRow}>
            <span style={styles.breakLabel}>{r.label}</span>
            <span style={{ ...styles.breakVal, color: r.positive ? "#5c8a5c" : "#c07a3a" }}>{fmt(r.val)}</span>
          </div>
        ))}
        <div style={{ ...styles.breakRow, borderTop: "1px dashed #d4b896", marginTop: 8, paddingTop: 8 }}>
          <span style={{ ...styles.breakLabel, fontWeight: 700 }}>Net balance</span>
          <span style={{ ...styles.breakVal, fontWeight: 700, color: Math.abs(netA) < 0.01 ? "#5c8a5c" : "#c07a3a" }}>
            {Math.abs(netA) < 0.01 ? "Settled ✓" : fmt(Math.abs(netA))}
          </span>
        </div>
      </div>

      {expenses.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Per Category</p>
          {(() => {
            const byCat = {};
            expenses.forEach(e => {
              const cat = e.category || "Other";
              if (!byCat[cat]) byCat[cat] = { total: 0, a: 0, b: 0 };
              const amt = parseFloat(e.amount);
              byCat[cat].total += amt;
              byCat[cat].a += (e.splitA / 100) * amt;
              byCat[cat].b += (e.splitB / 100) * amt;
            });
            return Object.entries(byCat).sort((x, y) => y[1].total - x[1].total).map(([cat, vals]) => (
              <div key={cat} style={styles.catBreakRow}>
                <span style={styles.catEmoji}>{cat.split(" ")[0]}</span>
                <div style={styles.catBreakInfo}>
                  <span style={styles.catBreakName}>{cat.split(" ").slice(1).join(" ")}</span>
                  <span style={styles.catBreakSub}>{USERS.A}: {fmt(vals.a)} · {USERS.B}: {fmt(vals.b)}</span>
                </div>
                <span style={styles.catBreakTotal}>{fmt(vals.total)}</span>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const C = {
  cream: "#fdf6ee", warm: "#f5e8d6", paper: "#faf3e8",
  terra: "#c07a3a", terraLight: "#d4956a", teraDark: "#8a5528",
  sage: "#7a9e7e", ink: "#2c1f0e", muted: "#7a6a56",
  border: "#e0c9a8", card: "#fffaf3", shadow: "rgba(100,60,10,0.08)",
};

const styles = {
  loadWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: C.cream, gap: 16 },
  loadDot: { width: 48, height: 48, borderRadius: "50%", background: C.terra },
  loadText: { fontFamily: "'Georgia', serif", color: C.muted, fontSize: 15 },
  loginBg: { minHeight: "100vh", background: `linear-gradient(145deg, ${C.warm}, ${C.cream})`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  loginCard: { background: C.card, borderRadius: 24, padding: "40px 32px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: `0 8px 40px ${C.shadow}`, border: `1px solid ${C.border}` },
  loginHeart: { fontSize: 48, marginBottom: 12 },
  loginTitle: { fontFamily: "'Georgia', serif", fontSize: 32, color: C.ink, margin: "0 0 6px", fontWeight: 700, letterSpacing: "-0.5px" },
  loginSub: { fontFamily: "'Georgia', serif", color: C.muted, fontSize: 15, margin: "0 0 32px", fontStyle: "italic" },
  loginPrompt: { fontFamily: "system-ui", color: C.ink, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 },
  loginBtns: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 },
  loginBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 28px", background: C.warm, border: `2px solid ${C.border}`, borderRadius: 16, cursor: "pointer", transition: "transform 0.15s", flex: 1 },
  loginAvatar: { width: 44, height: 44, borderRadius: "50%", background: C.terra, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, fontFamily: "system-ui" },
  loginName: { fontFamily: "'Georgia', serif", fontSize: 15, color: C.ink, fontWeight: 600 },
  loginNote: { fontSize: 12, color: C.muted, fontFamily: "system-ui" },
  shell: { display: "flex", flexDirection: "column", minHeight: "100vh", background: C.cream, maxWidth: 480, margin: "0 auto" },
  header: { background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontFamily: "'Georgia', serif", fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: "-0.3px" },
  sync: { fontSize: 11, color: C.sage, fontFamily: "system-ui", fontWeight: 600 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  userChip: { display: "flex", alignItems: "center", gap: 7, background: C.warm, borderRadius: 20, padding: "5px 12px 5px 7px", border: `1px solid ${C.border}` },
  userDot: { width: 26, height: 26, borderRadius: "50%", background: C.terra, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "system-ui" },
  userName: { fontFamily: "system-ui", fontSize: 13, fontWeight: 600, color: C.ink },
  logoutBtn: { background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "system-ui", padding: "4px 8px" },
  main: { flex: 1, overflowY: "auto", paddingBottom: 80 },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 12px" },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" },
  navBtnActive: {},
  navIcon: { fontSize: 20, transition: "color 0.15s" },
  navLabel: { fontSize: 10, fontFamily: "system-ui", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
  page: { padding: "20px" },
  pageTitle: { fontFamily: "'Georgia', serif", fontSize: 22, color: C.ink, margin: "0 0 20px", fontWeight: 700 },
  balanceCard: { background: `linear-gradient(135deg, ${C.terra}, ${C.teraDark})`, borderRadius: 20, padding: "28px 24px", marginBottom: 16, textAlign: "center", color: "#fff" },
  balanceLabel: { fontFamily: "system-ui", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.8, margin: "0 0 8px" },
  balanceAmount: { fontFamily: "'Georgia', serif", fontSize: 44, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-1px" },
  owedBadge: { fontFamily: "system-ui", fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "6px 16px", display: "inline-block" },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
  statCard: { background: C.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${C.border}` },
  statName: { fontFamily: "system-ui", fontSize: 12, color: C.muted, margin: "0 0 6px", fontWeight: 500 },
  statVal: { fontFamily: "'Georgia', serif", fontSize: 20, color: C.ink, margin: 0, fontWeight: 700 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: "system-ui", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  catCard: { background: C.card, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.border}` },
  catEmoji: { fontSize: 22 },
  catName: { fontFamily: "system-ui", fontSize: 12, color: C.muted, flex: 1 },
  catAmt: { fontFamily: "'Georgia', serif", fontSize: 14, color: C.ink, fontWeight: 700 },
  expRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.border}` },
  expLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  expCat: { fontSize: 22, flexShrink: 0 },
  expDesc: { fontFamily: "system-ui", fontSize: 14, color: C.ink, fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  expMeta: { fontFamily: "system-ui", fontSize: 11, color: C.muted, margin: "2px 0 0" },
  expRight: { display: "flex", alignItems: "center", gap: 10 },
  expAmt: { fontFamily: "'Georgia', serif", fontSize: 16, color: C.ink, fontWeight: 700 },
  delBtn: { background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "2px 6px", borderRadius: 6 },
  empty: { textAlign: "center", padding: "48px 20px" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: "'Georgia', serif", color: C.muted, fontSize: 16, lineHeight: 1.6 },
  formGroup: { marginBottom: 20 },
  label: { display: "block", fontFamily: "system-ui", fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "system-ui", fontSize: 15, color: C.ink, boxSizing: "border-box", outline: "none" },
  inputErr: { borderColor: "#c0503a" },
  select: { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "system-ui", fontSize: 15, color: C.ink, boxSizing: "border-box", outline: "none" },
  amountWrap: { position: "relative" },
  currency: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "'Georgia', serif", fontSize: 16, color: C.muted },
  amountInput: { paddingLeft: 28, fontFamily: "'Georgia', serif", fontSize: 22, fontWeight: 700 },
  err: { color: "#c0503a", fontSize: 12, fontFamily: "system-ui", marginTop: 4 },
  payerRow: { display: "flex", gap: 12 },
  payerBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, border: `2px solid ${C.border}`, background: C.warm, cursor: "pointer", fontFamily: "system-ui", fontSize: 14, fontWeight: 600, color: C.ink, transition: "all 0.15s" },
  payerBtnActive: { borderColor: C.terra, background: `rgba(192,122,58,0.12)`, color: C.terra },
  payerAvatar: { width: 28, height: 28, borderRadius: "50%", background: C.terra, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 },
  splitPresets: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  splitBtn: { padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${C.border}`, background: C.warm, fontFamily: "system-ui", fontSize: 12, fontWeight: 600, color: C.muted, cursor: "pointer" },
  splitBtnActive: { borderColor: C.terra, background: C.terra, color: "#fff" },
  splitPreview: { background: C.warm, borderRadius: 12, padding: "14px 16px" },
  splitBar: { display: "flex", borderRadius: 8, overflow: "hidden", height: 10, marginBottom: 8 },
  splitBarA: { background: C.terra, transition: "width 0.3s" },
  splitBarB: { background: C.terraLight, transition: "width 0.3s" },
  splitLabels: { display: "flex", justifyContent: "space-between", fontFamily: "system-ui", fontSize: 12, color: C.muted, fontWeight: 600 },
  splitAmounts: { display: "flex", justifyContent: "space-between", fontFamily: "'Georgia', serif", fontSize: 14, color: C.ink, fontWeight: 700, marginTop: 4 },
  customSplit: { display: "flex", alignItems: "center", gap: 12 },
  customField: { flex: 1 },
  smallLabel: { display: "block", fontFamily: "system-ui", fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 },
  smallInput: { width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "'Georgia', serif", fontSize: 18, fontWeight: 700, color: C.ink, boxSizing: "border-box", textAlign: "center", outline: "none" },
  splitDivider: { fontFamily: "'Georgia', serif", fontSize: 22, color: C.muted, flexShrink: 0, marginTop: 18 },
  submitBtn: { width: "100%", padding: "16px", borderRadius: 14, background: C.terra, color: "#fff", border: "none", fontFamily: "system-ui", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  savedScreen: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 },
  savedIcon: { width: 72, height: 72, borderRadius: "50%", background: C.sage, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700 },
  savedText: { fontFamily: "'Georgia', serif", fontSize: 22, color: C.ink, fontWeight: 700 },
  filterRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 8, scrollbarWidth: "none" },
  filterBtn: { flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.border}`, background: C.warm, fontFamily: "system-ui", fontSize: 13, color: C.muted, cursor: "pointer", fontWeight: 500 },
  filterBtnActive: { borderColor: C.terra, background: C.terra, color: "#fff" },
  verdictCard: { background: `linear-gradient(135deg, ${C.teraDark}, ${C.terra})`, borderRadius: 20, padding: "28px 24px", textAlign: "center", marginBottom: 20, color: "#fff" },
  verdictEmoji: { fontSize: 44, margin: "0 0 12px" },
  verdictText: { fontFamily: "'Georgia', serif", fontSize: 20, fontWeight: 700, margin: "0 0 8px" },
  verdictSub: { fontFamily: "system-ui", fontSize: 13, opacity: 0.8 },
  breakRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` },
  breakLabel: { fontFamily: "system-ui", fontSize: 14, color: C.muted },
  breakVal: { fontFamily: "'Georgia', serif", fontSize: 16, fontWeight: 600 },
  catBreakRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` },
  catBreakInfo: { flex: 1, display: "flex", flexDirection: "column" },
  catBreakName: { fontFamily: "system-ui", fontSize: 14, color: C.ink, fontWeight: 600 },
  catBreakSub: { fontFamily: "system-ui", fontSize: 11, color: C.muted, marginTop: 2 },
  catBreakTotal: { fontFamily: "'Georgia', serif", fontSize: 15, fontWeight: 700, color: C.ink },
};
