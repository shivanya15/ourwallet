import { useState, useEffect, useCallback, useRef } from "react";

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
  return "₹" + Math.abs(parseFloat(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDateInput(iso) {
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function monthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(y, parseInt(m) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
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
  return { netA: paidA - owesA, paidA, paidB, owesA, owesB };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sess = await window.storage.get("couple_session");
        if (sess) setCurrentUser(sess.value);
        const data = await window.storage.get("couple_expenses", true);
        if (data) setExpenses(JSON.parse(data.value));
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const saveExpenses = useCallback(async (updated) => {
    setExpenses(updated);
    try {
      await window.storage.set("couple_expenses", JSON.stringify(updated), true);
      setSaveStatus("✓ Synced");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (_) { setSaveStatus("⚠ Sync failed"); }
  }, []);

  const login = async (user) => {
    setCurrentUser(user);
    try { await window.storage.set("couple_session", user); } catch (_) {}
  };
  const logout = async () => {
    setCurrentUser(null);
    try { await window.storage.delete("couple_session"); } catch (_) {}
  };

  if (loading) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen onLogin={login} />;

  return (
    <Shell user={currentUser} onLogout={logout} tab={tab} setTab={setTab} saveStatus={saveStatus}>
      {tab === "dashboard" && <Dashboard expenses={expenses} setTab={setTab} />}
      {tab === "add" && <AddExpense expenses={expenses} onSave={saveExpenses} currentUser={currentUser} onDone={() => setTab("dashboard")} />}
      {tab === "import" && <ImportPDF expenses={expenses} onSave={saveExpenses} currentUser={currentUser} onDone={() => setTab("dashboard")} />}
      {tab === "history" && <History expenses={expenses} onDelete={(id) => saveExpenses(expenses.filter(e => e.id !== id))} />}
      {tab === "summary" && <Summary expenses={expenses} />}
      {tab === "export" && <ExportExcel expenses={expenses} />}
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
        <p style={styles.loginNote}>Data is shared between both partners 🔗</p>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ children, user, onLogout, tab, setTab, saveStatus }) {
  const tabs = [
    { id: "dashboard", icon: "◈", label: "Home" },
    { id: "add", icon: "+", label: "Add" },
    { id: "import", icon: "⬆", label: "Import" },
    { id: "history", icon: "≡", label: "History" },
    { id: "summary", icon: "⇄", label: "Owes" },
    { id: "export", icon: "↓", label: "Export" },
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
          <button key={t.id} style={styles.navBtn} onClick={() => setTab(t.id)}>
            <span style={{ ...styles.navIcon, color: tab === t.id ? C.terra : C.muted }}>{t.icon}</span>
            <span style={{ ...styles.navLabel, color: tab === t.id ? C.terra : C.muted }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ expenses, setTab }) {
  const { netA, paidA, paidB } = calcOwed(expenses);
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  // Monthly breakdown
  const byMonth = {};
  expenses.forEach(e => {
    const k = monthKey(e.date);
    if (!byMonth[k]) byMonth[k] = 0;
    byMonth[k] += parseFloat(e.amount);
  });
  const monthEntries = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);

  // Top categories
  const byCat = {};
  expenses.slice(-30).forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + parseFloat(e.amount);
  });
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);

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

      {monthEntries.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>By Month</p>
          {monthEntries.map(([k, amt]) => {
            const monthExp = expenses.filter(e => monthKey(e.date) === k);
            const { netA: mNet } = calcOwed(monthExp);
            return (
              <div key={k} style={styles.monthRow}>
                <div>
                  <p style={styles.monthName}>{monthLabel(k)}</p>
                  <p style={styles.monthSub}>{monthExp.length} expense{monthExp.length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={styles.monthAmt}>{fmt(amt)}</p>
                  {Math.abs(mNet) > 0.01 && (
                    <p style={{ ...styles.monthSub, color: C.terra }}>
                      {mNet > 0 ? `${USERS.B} owes ${fmt(mNet)}` : `${USERS.A} owes ${fmt(Math.abs(mNet))}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
          {[...expenses].reverse().slice(0, 5).map(e => <ExpenseRow key={e.id} expense={e} />)}
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
          <p style={styles.expMeta}>{USERS[e.payer]} paid · {e.splitA}%/{e.splitB}% · {new Date(e.date).toLocaleDateString("en-IN")}</p>
        </div>
      </div>
      <div style={styles.expRight}>
        <span style={styles.expAmt}>{fmt(e.amount)}</span>
        {onDelete && <button style={styles.delBtn} onClick={() => onDelete(e.id)}>✕</button>}
      </div>
    </div>
  );
}

// ─── Add Expense ──────────────────────────────────────────────────────────────
function AddExpense({ expenses, onSave, currentUser, onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amount: "", category: CATEGORIES[0], description: "",
    payer: currentUser, splitPreset: "50 / 50",
    splitA: 50, splitB: 50, customA: "", customB: "",
    date: today,
  });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handlePreset = (p) => { set("splitPreset", p.label); if (p.a !== null) { set("splitA", p.a); set("splitB", p.b); } };
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
  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave([...expenses, {
      id: Date.now().toString(),
      amount: parseFloat(form.amount).toFixed(2),
      category: form.category,
      description: form.description.trim(),
      payer: form.payer,
      splitA: form.splitA,
      splitB: form.splitB,
      date: new Date(form.date).toISOString(),
    }]);
    setSaved(true);
    setTimeout(() => { setSaved(false); onDone(); }, 900);
  };

  if (saved) return <div style={styles.savedScreen}><div style={styles.savedIcon}>✓</div><p style={styles.savedText}>Expense added!</p></div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>New Expense</h2>

      <div style={styles.formGroup}>
        <label style={styles.label}>Amount</label>
        <div style={styles.amountWrap}>
          <span style={styles.currency}>₹</span>
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
        <label style={styles.label}>Date</label>
        <input style={styles.input} type="date" value={form.date} max={today}
          onChange={e => set("date", e.target.value)} />
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
            <button key={key} style={{ ...styles.payerBtn, ...(form.payer === key ? styles.payerBtnActive : {}) }}
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
            <button key={p.label} style={{ ...styles.splitBtn, ...(form.splitPreset === p.label ? styles.splitBtnActive : {}) }}
              onClick={() => handlePreset(p)}>{p.label}</button>
          ))}
        </div>
        {form.splitPreset === "Custom" ? (
          <div style={styles.customSplit}>
            <div style={styles.customField}><label style={styles.smallLabel}>{USERS.A} %</label><input style={styles.smallInput} type="number" min="0" max="100" value={form.customA} onChange={e => handleCustom("A", e.target.value)} placeholder="50" /></div>
            <span style={styles.splitDivider}>/</span>
            <div style={styles.customField}><label style={styles.smallLabel}>{USERS.B} %</label><input style={styles.smallInput} type="number" min="0" max="100" value={form.customB} onChange={e => handleCustom("B", e.target.value)} placeholder="50" /></div>
          </div>
        ) : (
          <div style={styles.splitPreview}>
            <div style={styles.splitBar}><div style={{ ...styles.splitBarA, width: `${form.splitA}%` }} /><div style={{ ...styles.splitBarB, width: `${form.splitB}%` }} /></div>
            <div style={styles.splitLabels}><span>{USERS.A}: {form.splitA}%</span><span>{USERS.B}: {form.splitB}%</span></div>
            {form.amount && !isNaN(parseFloat(form.amount)) && (
              <div style={styles.splitAmounts}><span>{fmt(parseFloat(form.amount) * form.splitA / 100)}</span><span>{fmt(parseFloat(form.amount) * form.splitB / 100)}</span></div>
            )}
          </div>
        )}
      </div>

      <button style={styles.submitBtn} onClick={submit}>Add Expense</button>
    </div>
  );
}

// ─── Import PDF ───────────────────────────────────────────────────────────────
// Pre-parsed transactions from statements uploaded by user
const PRELOADED_STATEMENTS = [
  {
    key: "axis_apr26",
    label: "Axis Bank Magnus · Mar–Apr 2026",
    file: "Credit_Card_Statement_Apr26.pdf",
    transactions: [
      { date: "2026-03-28", description: "Ola Cabs", amount: 300.00, category: "🚗 Transport" },
      { date: "2026-03-28", description: "Ola Cabs", amount: 356.00, category: "🚗 Transport" },
      { date: "2026-03-29", description: "Infiniti Retail (Croma)", amount: 23949.00, category: "🛍️ Shopping" },
      { date: "2026-04-14", description: "Netflix", amount: 499.00, category: "🎉 Fun" },
    ]
  },
  {
    key: "icici_apr26",
    label: "ICICI Amazon Pay · Mar–Apr 2026",
    file: "ICICI_statement.pdf",
    transactions: [
      { date: "2026-03-15", description: "Amazon Pay", amount: 1235.00, category: "🛍️ Shopping" },
      { date: "2026-03-18", description: "Amazon Grocery", amount: 1489.72, category: "🛒 Groceries" },
      { date: "2026-03-25", description: "Amazon Pay", amount: 860.00, category: "🛍️ Shopping" },
      { date: "2026-03-28", description: "Amazon E-Commerce", amount: 434.00, category: "🛍️ Shopping" },
      { date: "2026-03-29", description: "Amazon Pay", amount: 860.00, category: "🛍️ Shopping" },
      { date: "2026-04-01", description: "Amazon India", amount: 361.00, category: "🛍️ Shopping" },
      { date: "2026-04-03", description: "Amazon Grocery", amount: 838.50, category: "🛒 Groceries" },
    ]
  },
];

function ImportPDF({ expenses, onSave, currentUser, onDone }) {
  const [stage, setStage] = useState("upload");
  const [parsedItems, setParsedItems] = useState([]);
  const [editedItems, setEditedItems] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selected, setSelected] = useState({});
  const [payer, setPayer] = useState(currentUser);
  const [splitA, setSplitA] = useState(50);
  const [splitB, setSplitB] = useState(50);
  const [splitPreset, setSplitPreset] = useState("50 / 50");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState("");
  const fileRef = useRef();

  const handlePreset = (p) => {
    setSplitPreset(p.label);
    if (p.a !== null) { setSplitA(p.a); setSplitB(p.b); }
  };

  const loadTransactions = (items, name) => {
    setParsedItems(items);
    setEditedItems(items.map(it => ({ ...it, splitA: splitA, splitB: splitB })));
    const sel = {};
    items.forEach((_, i) => sel[i] = true);
    setSelected(sel);
    setExpandedRow(null);
    setFileName(name || "statement.pdf");
    setStage("review");
  };

  const updateItem = (i, field, value) => {
    setEditedItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  // Load a pre-parsed statement by key
  const loadPreloaded = (key) => {
    const stmt = PRELOADED_STATEMENTS.find(s => s.key === key);
    if (!stmt) return;
    setStage("parsing");
    setProgress(`Loading ${stmt.label}…`);
    setTimeout(() => {
      loadTransactions(stmt.transactions, stmt.file);
    }, 600);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setFileName(file.name);
    setError("");
    setStage("parsing");

    // Step 1 — read file
    let base64;
    try {
      setProgress("Step 1/3: Reading file…");
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      base64 = btoa(binary);
      setProgress(`Step 1/3: File read ✓ (${(bytes.byteLength / 1024).toFixed(0)} KB)`);
    } catch (err) {
      setError(`File read failed: ${err.message}`);
      setStage("upload");
      return;
    }

    // Step 2 — call Claude API
    let data;
    try {
      setProgress("Step 2/3: Calling Groq API…");
      const response = await fetch("/api/parse-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: base64,
          prompt: `You are parsing a bank or credit card statement. Extract purchase/debit transactions only.

CRITICAL RULES:
- The amount column is ALWAYS the LAST number on each transaction line (rightmost column)
- Indian statements often have a "Reward Points" column — IGNORE it completely
- NEVER include reward points numbers in the amount field
- Skip any row marked CR, credit, payment received, or refund
- The amount is a rupee value like 1235.00 or 23949.00, NOT a small number like 24 or 74

For each valid purchase transaction return:
- date: "YYYY-MM-DD"
- description: merchant name only, clean, max 40 chars
- amount: the LAST/RIGHTMOST number on the line (the actual rupee amount)
- category: one of: "🍽️ Food", "🏠 Rent", "🚗 Transport", "🛒 Groceries", "💊 Health", "🎉 Fun", "🧾 Bills", "✈️ Travel", "🛍️ Shopping", "📦 Other"

Return ONLY a valid JSON array. No markdown, no backticks, no explanation. If no transactions: []`
        })
      });

      setProgress(`Step 2/3: API responded (status ${response.status})`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${response.status}`;
        setError(`API error: ${msg}`);
        setStage("upload");
        return;
      }

      data = await response.json();

      if (data.error) {
        setError(`Groq error: ${data.error.message}`);
        setStage("upload");
        return;
      }
    } catch (err) {
      setError(`API call failed: ${err.message}. Make sure you are on the deployed Vercel app, not localhost.`);
      setStage("upload");
      return;
    }

    // Step 3 — parse response
    try {
      setProgress("Step 3/3: Parsing transactions…");
      const rawText = data.text || "[]";
      const clean = rawText.replace(/```json|```/g, "").trim();
      let items;
      try {
        items = JSON.parse(clean);
      } catch (_) {
        const match = clean.match(/\[[\s\S]*\]/);
        if (match) items = JSON.parse(match[0]);
        else throw new Error(`Could not parse JSON. Raw response: ${clean.slice(0, 200)}`);
      }

      if (!Array.isArray(items) || items.length === 0) {
        setError("No transactions found in this PDF. Make sure it's a bank or credit card statement.");
        setStage("upload");
        return;
      }

      loadTransactions(items, file.name);
    } catch (err) {
      setError(`Parse error: ${err.message}`);
      setStage("upload");
    }
  };

  const toggleAll = (val) => {
    const sel = {};
    parsedItems.forEach((_, i) => sel[i] = val);
    setSelected(sel);
  };

  const importSelected = async () => {
    setStage("importing");
    const toImport = editedItems.filter((_, i) => selected[i]);
    const newExpenses = toImport.map(item => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      amount: parseFloat(item.amount).toFixed(2),
      category: item.category || "📦 Other",
      description: item.description,
      payer,
      splitA: item.splitA ?? splitA,
      splitB: item.splitB ?? splitB,
      date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      importedFrom: fileName,
    }));
    await onSave([...expenses, ...newExpenses]);
    setStage("done");
  };

  // ── Upload
  if (stage === "upload") return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>Import Statement</h2>
      <p style={{ fontFamily: "system-ui", fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
        Upload a credit card or bank statement PDF and Claude will extract all transactions automatically.
      </p>

      {/* Preloaded statements */}
      <p style={styles.sectionTitle}>Your uploaded statements</p>
      {PRELOADED_STATEMENTS.map(stmt => (
        <div key={stmt.key} style={styles.preloadCard} onClick={() => loadPreloaded(stmt.key)}>
          <div style={styles.preloadLeft}>
            <p style={styles.preloadTitle}>📋 {stmt.label}</p>
            <p style={styles.preloadSub}>{stmt.file} · {stmt.transactions.length} transactions</p>
          </div>
          <span style={styles.preloadArrow}>→</span>
        </div>
      ))}

      <div style={styles.dividerRow}><div style={styles.dividerLine} /><span style={styles.dividerText}>or upload new</span><div style={styles.dividerLine} /></div>

      <div style={styles.uploadBox}
        onClick={() => fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.terra; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = C.border; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.border; handleFile(e.dataTransfer.files[0]); }}>
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        <p style={styles.uploadIcon}>📄</p>
        <p style={styles.uploadTitle}>Tap to upload PDF</p>
        <p style={styles.uploadSub}>or drag and drop here</p>
      </div>

      {error && <div style={styles.errorBox}>⚠️ {error}</div>}

      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>💡 Works with</p>
        <p style={styles.infoText}>Axis Bank, HDFC, SBI, ICICI, Chase, Amex, Citi — any PDF bank or credit card statement with a transactions table.</p>
      </div>
    </div>
  );

  // ── Parsing
  if (stage === "parsing") return (
    <div style={styles.savedScreen}>
      <p style={{ fontSize: 52, margin: 0 }}>🔍</p>
      <p style={styles.savedText}>Analysing statement…</p>
      <p style={{ fontFamily: "system-ui", fontSize: 13, color: C.muted, textAlign: "center", padding: "0 32px" }}>{progress}</p>
    </div>
  );

  // ── Review
  if (stage === "review") {
    const selectedCount = Object.values(selected).filter(Boolean).length;
    const selectedTotal = parsedItems.filter((_, i) => selected[i]).reduce((s, t) => s + parseFloat(t.amount), 0);
    return (
      <div style={styles.page}>
        <h2 style={styles.pageTitle}>Review Transactions</h2>

        <div style={styles.reviewSummary}>
          <div>
            <p style={styles.reviewCount}>{selectedCount} of {parsedItems.length} selected</p>
            <p style={styles.reviewTotal}>{fmt(selectedTotal)}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.selectAllBtn} onClick={() => toggleAll(true)}>All</button>
            <button style={styles.selectAllBtn} onClick={() => toggleAll(false)}>None</button>
          </div>
        </div>

        <div style={styles.importSettings}>
          <p style={{ ...styles.sectionTitle, marginBottom: 14 }}>Default for all — override per transaction below</p>
          <div style={styles.formGroup}>
            <label style={styles.label}>Paid by</label>
            <div style={styles.payerRow}>
              {Object.entries(USERS).map(([key, name]) => (
                <button key={key} style={{ ...styles.payerBtn, ...(payer === key ? styles.payerBtnActive : {}) }} onClick={() => setPayer(key)}>
                  <span style={styles.payerAvatar}>{name[0]}</span> {name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={styles.label}>Split</label>
            <div style={styles.splitPresets}>
              {SPLIT_PRESETS.filter(p => p.a !== null).map(p => (
                <button key={p.label} style={{ ...styles.splitBtn, ...(splitPreset === p.label ? styles.splitBtnActive : {}) }} onClick={() => handlePreset(p)}>{p.label}</button>
              ))}
            </div>
            <div style={styles.splitPreview}>
              <div style={styles.splitBar}><div style={{ ...styles.splitBarA, width: `${splitA}%` }} /><div style={{ ...styles.splitBarB, width: `${splitB}%` }} /></div>
              <div style={styles.splitLabels}><span>{USERS.A}: {splitA}%</span><span>{USERS.B}: {splitB}%</span></div>
            </div>
          </div>
        </div>

        <p style={{ ...styles.sectionTitle, marginBottom: 10 }}>Tap ✓ to select · ✏️ to edit</p>
        {editedItems.map((item, i) => {
          const isExpanded = expandedRow === i;
          return (
            <div key={i} style={{ ...styles.importRow, opacity: selected[i] ? 1 : 0.36, flexDirection: "column", padding: 0, overflow: "hidden" }}>
              {/* Row header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px" }}>
                <div
                  style={{ ...styles.checkbox, ...(selected[i] ? styles.checkboxChecked : {}), flexShrink: 0, marginTop: 2, cursor: "pointer" }}
                  onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}>
                  {selected[i] && <span style={styles.checkmark}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <p style={styles.importDesc}>{item.description}</p>
                    <p style={styles.importAmt}>{fmt(item.amount)}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 13 }}>{item.category?.split(" ")[0]}</span>
                    <span style={styles.importDate}>{new Date(item.date).toLocaleDateString("en-IN")}</span>
                    <span style={{ ...styles.importDate, color: C.terra, fontWeight: 600 }}>{item.splitA}%/{item.splitB}%</span>
                  </div>
                </div>
                {/* Edit toggle */}
                <button
                  style={styles.editToggleBtn}
                  onClick={e => { e.stopPropagation(); setExpandedRow(isExpanded ? null : i); }}>
                  {isExpanded ? "✕" : "✏️"}
                </button>
              </div>

              {/* Inline edit panel */}
              {isExpanded && (
                <div style={styles.editPanel}>
                  <div style={styles.editField}>
                    <label style={styles.editLabel}>Name</label>
                    <input
                      style={styles.editInput}
                      value={item.description}
                      onChange={e => updateItem(i, "description", e.target.value)}
                      placeholder="Merchant name"
                    />
                  </div>
                  <div style={styles.editField}>
                    <label style={styles.editLabel}>Category</label>
                    <div style={styles.editCatGrid}>
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          style={{ ...styles.editCatBtn, ...(item.category === cat ? styles.editCatBtnActive : {}) }}
                          onClick={() => updateItem(i, "category", cat)}>
                          {cat.split(" ")[0]} <span style={{ fontSize: 10, marginLeft: 2 }}>{cat.split(" ").slice(1).join(" ")}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={styles.editField}>
                    <label style={styles.editLabel}>Split Ratio</label>
                    <div style={styles.editCatGrid}>
                      {SPLIT_PRESETS.filter(p => p.a !== null).map(p => {
                        const active = item.splitA === p.a && item.splitB === p.b;
                        return (
                          <button key={p.label}
                            style={{ ...styles.editCatBtn, ...(active ? styles.editCatBtnActive : {}) }}
                            onClick={() => { updateItem(i, "splitA", p.a); updateItem(i, "splitB", p.b); }}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Custom split inputs */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <label style={styles.editLabel}>{USERS.A} %</label>
                        <input style={styles.editSplitInput} type="number" min="0" max="100"
                          value={item.splitA}
                          onChange={e => {
                            const n = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            updateItem(i, "splitA", n);
                            updateItem(i, "splitB", 100 - n);
                          }} />
                      </div>
                      <span style={{ fontFamily: "'Georgia', serif", fontSize: 18, color: C.muted, marginTop: 16 }}>/</span>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <label style={styles.editLabel}>{USERS.B} %</label>
                        <input style={styles.editSplitInput} type="number" min="0" max="100"
                          value={item.splitB}
                          onChange={e => {
                            const n = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            updateItem(i, "splitB", n);
                            updateItem(i, "splitA", 100 - n);
                          }} />
                      </div>
                    </div>
                    {/* Split preview bar */}
                    <div style={{ marginTop: 10 }}>
                      <div style={styles.splitBar}>
                        <div style={{ ...styles.splitBarA, width: `${item.splitA}%` }} />
                        <div style={{ ...styles.splitBarB, width: `${item.splitB}%` }} />
                      </div>
                      <div style={styles.splitLabels}>
                        <span>{fmt(parseFloat(item.amount) * item.splitA / 100)}</span>
                        <span>{fmt(parseFloat(item.amount) * item.splitB / 100)}</span>
                      </div>
                    </div>
                  </div>
                  <button style={styles.editDoneBtn} onClick={() => setExpandedRow(null)}>Done ✓</button>
                </div>
              )}
            </div>
          );
        })}

        <button style={{ ...styles.submitBtn, marginTop: 20, opacity: selectedCount === 0 ? 0.5 : 1 }}
          onClick={importSelected} disabled={selectedCount === 0}>
          Import {selectedCount} Expense{selectedCount !== 1 ? "s" : ""}
        </button>
        <button style={styles.cancelBtn} onClick={() => { setStage("upload"); setError(""); }}>← Upload different file</button>
      </div>
    );
  }

  // ── Importing
  if (stage === "importing") return (
    <div style={styles.savedScreen}>
      <p style={{ fontSize: 52, margin: 0 }}>💾</p>
      <p style={styles.savedText}>Saving expenses…</p>
    </div>
  );

  // ── Done
  return (
    <div style={styles.savedScreen}>
      <div style={styles.savedIcon}>✓</div>
      <p style={styles.savedText}>Expenses imported!</p>
      <button style={{ ...styles.submitBtn, width: "auto", padding: "12px 32px", marginTop: 8 }} onClick={onDone}>View Dashboard</button>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History({ expenses, onDelete }) {
  const [filter, setFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");

  const months = ["All", ...new Set(expenses.map(e => monthKey(e.date)).sort().reverse())];
  const cats = ["All", ...new Set(expenses.map(e => e.category))];

  let filtered = expenses;
  if (monthFilter !== "All") filtered = filtered.filter(e => monthKey(e.date) === monthFilter);
  if (filter !== "All") filtered = filtered.filter(e => e.category === filter);

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>Expense History</h2>

      {months.length > 2 && (
        <div style={{ marginBottom: 8 }}>
          <p style={styles.sectionTitle}>Month</p>
          <div style={styles.filterRow}>
            {months.map(m => (
              <button key={m} style={{ ...styles.filterBtn, ...(monthFilter === m ? styles.filterBtnActive : {}) }}
                onClick={() => setMonthFilter(m)}>
                {m === "All" ? "All" : monthLabel(m).split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <p style={styles.sectionTitle}>Category</p>
        <div style={styles.filterRow}>
          {cats.slice(0, 7).map(c => (
            <button key={c} style={{ ...styles.filterBtn, ...(filter === c ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(c)}>
              {c === "All" ? "All" : c.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <div style={styles.empty}><p style={styles.emptyText}>No expenses match these filters.</p></div>
        : [...filtered].reverse().map(e => <ExpenseRow key={e.id} expense={e} onDelete={onDelete} />)
      }
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function Summary({ expenses }) {
  const [selectedMonth, setSelectedMonth] = useState("All");
  const months = ["All", ...new Set(expenses.map(e => monthKey(e.date)).sort().reverse())];
  const filtered = selectedMonth === "All" ? expenses : expenses.filter(e => monthKey(e.date) === selectedMonth);

  const { netA, paidA, paidB, owesA, owesB } = calcOwed(filtered);
  const rows = [
    { label: `${USERS.A} paid`, val: paidA, positive: true },
    { label: `${USERS.B} paid`, val: paidB, positive: true },
    { label: `${USERS.A}'s share`, val: owesA, positive: false },
    { label: `${USERS.B}'s share`, val: owesB, positive: false },
  ];
  const verdict = () => {
    if (Math.abs(netA) < 0.01) return { msg: "You're all even! 🎉", settled: true };
    if (netA > 0) return { msg: `${USERS.B} owes ${USERS.A} ${fmt(netA)}`, settled: false };
    return { msg: `${USERS.A} owes ${USERS.B} ${fmt(Math.abs(netA))}`, settled: false };
  };
  const v = verdict();

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>Who Owes Whom</h2>

      {months.length > 2 && (
        <div style={{ marginBottom: 16 }}>
          <div style={styles.filterRow}>
            {months.map(m => (
              <button key={m} style={{ ...styles.filterBtn, ...(selectedMonth === m ? styles.filterBtnActive : {}) }}
                onClick={() => setSelectedMonth(m)}>
                {m === "All" ? "All time" : monthLabel(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={styles.verdictCard}>
        <p style={styles.verdictEmoji}>{v.settled ? "🎉" : "💸"}</p>
        <p style={styles.verdictText}>{v.msg}</p>
        <p style={styles.verdictSub}>
          {selectedMonth === "All" ? "All time" : monthLabel(selectedMonth)} · {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Breakdown</p>
        {rows.map(r => (
          <div key={r.label} style={styles.breakRow}>
            <span style={styles.breakLabel}>{r.label}</span>
            <span style={{ ...styles.breakVal, color: r.positive ? "#5c8a5c" : C.terra }}>{fmt(r.val)}</span>
          </div>
        ))}
        <div style={{ ...styles.breakRow, borderTop: "1px dashed #d4b896", marginTop: 8, paddingTop: 8 }}>
          <span style={{ ...styles.breakLabel, fontWeight: 700 }}>Net balance</span>
          <span style={{ ...styles.breakVal, fontWeight: 700, color: Math.abs(netA) < 0.01 ? "#5c8a5c" : C.terra }}>
            {Math.abs(netA) < 0.01 ? "Settled ✓" : fmt(Math.abs(netA))}
          </span>
        </div>
      </div>

      {filtered.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Per Category</p>
          {(() => {
            const byCat = {};
            filtered.forEach(e => {
              const cat = e.category || "📦 Other";
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

// ─── Export Excel ─────────────────────────────────────────────────────────────
function ExportExcel({ expenses }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDate = expenses.length
    ? [...expenses].sort((a, b) => a.date.localeCompare(b.date))[0].date.slice(0, 10)
    : today;

  const [from, setFrom] = useState(firstDate);
  const [to, setTo] = useState(today);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const filtered = expenses.filter(e => {
    const d = e.date.slice(0, 10);
    return d >= from && d <= to;
  });

  const { paidA, paidB, owesA, owesB, netA } = calcOwed(filtered);
  const total = filtered.reduce((s, e) => s + parseFloat(e.amount), 0);

  const generateCSV = () => {
    // Header
    const rows = [
      ["OurWallet Export"],
      [`Period: ${from} to ${to}`],
      [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
      [],
      ["Date", "Description", "Category", "Amount (₹)", "Paid By", `${USERS.A} Share (₹)`, `${USERS.B} Share (₹)`, "Split"],
    ];

    // Transactions sorted by date
    [...filtered]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(e => {
        const amt = parseFloat(e.amount);
        rows.push([
          new Date(e.date).toLocaleDateString("en-IN"),
          e.description,
          e.category,
          amt.toFixed(2),
          USERS[e.payer],
          (amt * e.splitA / 100).toFixed(2),
          (amt * e.splitB / 100).toFixed(2),
          `${e.splitA}/${e.splitB}`,
        ]);
      });

    // Summary section
    rows.push([]);
    rows.push(["SUMMARY"]);
    rows.push(["Total Spending", "", "", total.toFixed(2)]);
    rows.push([`${USERS.A} Paid`, "", "", paidA.toFixed(2)]);
    rows.push([`${USERS.B} Paid`, "", "", paidB.toFixed(2)]);
    rows.push([`${USERS.A}'s Share`, "", "", owesA.toFixed(2)]);
    rows.push([`${USERS.B}'s Share`, "", "", owesB.toFixed(2)]);
    rows.push([]);
    if (Math.abs(netA) < 0.01) {
      rows.push(["Balance", "All settled ✓"]);
    } else if (netA > 0) {
      rows.push(["Balance", `${USERS.B} owes ${USERS.A}`, "", Math.abs(netA).toFixed(2)]);
    } else {
      rows.push(["Balance", `${USERS.A} owes ${USERS.B}`, "", Math.abs(netA).toFixed(2)]);
    }

    // Category breakdown
    rows.push([]);
    rows.push(["CATEGORY BREAKDOWN"]);
    rows.push(["Category", "Total (₹)", `${USERS.A} Share (₹)`, `${USERS.B} Share (₹)`]);
    const byCat = {};
    filtered.forEach(e => {
      const cat = e.category || "📦 Other";
      if (!byCat[cat]) byCat[cat] = { total: 0, a: 0, b: 0 };
      const amt = parseFloat(e.amount);
      byCat[cat].total += amt;
      byCat[cat].a += (e.splitA / 100) * amt;
      byCat[cat].b += (e.splitB / 100) * amt;
    });
    Object.entries(byCat)
      .sort((x, y) => y[1].total - x[1].total)
      .forEach(([cat, v]) => {
        rows.push([cat, v.total.toFixed(2), v.a.toFixed(2), v.b.toFixed(2)]);
      });

    return rows;
  };

  const downloadCSV = () => {
    setDownloading(true);
    try {
      const rows = generateCSV();
      const csv = rows.map(r =>
        r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      ).join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OurWallet_${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error(err);
    }
    setDownloading(false);
  };

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>Export to Excel</h2>
      <p style={{ fontFamily: "system-ui", fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
        Download a CSV file that opens directly in Excel or Google Sheets, with all transactions and a summary.
      </p>

      {/* Date range */}
      <div style={styles.exportDateCard}>
        <p style={styles.sectionTitle}>Select date range</p>
        <div style={styles.exportDateRow}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>From</label>
            <input style={styles.input} type="date" value={from}
              max={to} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>To</label>
            <input style={styles.input} type="date" value={to}
              min={from} max={today} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        {/* Quick range presets */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {[
            { label: "This month", fn: () => { const n = new Date(); setFrom(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`); setTo(today); } },
            { label: "Last month", fn: () => { const n = new Date(); n.setMonth(n.getMonth()-1); const y = n.getFullYear(); const m = String(n.getMonth()+1).padStart(2,"0"); const last = new Date(y, n.getMonth()+1, 0).getDate(); setFrom(`${y}-${m}-01`); setTo(`${y}-${m}-${last}`); } },
            { label: "Last 3 months", fn: () => { const n = new Date(); n.setMonth(n.getMonth()-3); setFrom(n.toISOString().slice(0,10)); setTo(today); } },
            { label: "This year", fn: () => { setFrom(`${new Date().getFullYear()}-01-01`); setTo(today); } },
            { label: "All time", fn: () => { setFrom(firstDate); setTo(today); } },
          ].map(p => (
            <button key={p.label} style={styles.presetChip} onClick={p.fn}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={styles.exportPreview}>
        <p style={styles.sectionTitle}>Preview</p>
        {filtered.length === 0 ? (
          <p style={{ fontFamily: "system-ui", fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>
            No expenses in this date range
          </p>
        ) : (
          <>
            <div style={styles.exportStatRow}>
              <div style={styles.exportStat}>
                <p style={styles.exportStatLabel}>Transactions</p>
                <p style={styles.exportStatVal}>{filtered.length}</p>
              </div>
              <div style={styles.exportStat}>
                <p style={styles.exportStatLabel}>Total</p>
                <p style={styles.exportStatVal}>{fmt(total)}</p>
              </div>
              <div style={styles.exportStat}>
                <p style={styles.exportStatLabel}>{USERS.A} paid</p>
                <p style={styles.exportStatVal}>{fmt(paidA)}</p>
              </div>
              <div style={styles.exportStat}>
                <p style={styles.exportStatLabel}>{USERS.B} paid</p>
                <p style={styles.exportStatVal}>{fmt(paidB)}</p>
              </div>
            </div>
            <div style={styles.exportBalanceRow}>
              <span style={{ fontFamily: "system-ui", fontSize: 13, color: C.muted }}>Balance</span>
              <span style={{ fontFamily: "'Georgia', serif", fontSize: 14, fontWeight: 700, color: Math.abs(netA) < 0.01 ? C.sage : C.terra }}>
                {Math.abs(netA) < 0.01 ? "Settled ✓" : netA > 0 ? `${USERS.B} owes ${fmt(netA)}` : `${USERS.A} owes ${fmt(Math.abs(netA))}`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* What's included */}
      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>📋 What's in the file</p>
        <p style={styles.infoText}>All transactions with date, description, category, amount, who paid, each person's share — plus a summary sheet with category breakdown and balance. Opens in Excel, Numbers, and Google Sheets.</p>
      </div>

      <button
        style={{ ...styles.submitBtn, opacity: filtered.length === 0 || downloading ? 0.5 : 1, marginTop: 16 }}
        onClick={downloadCSV}
        disabled={filtered.length === 0 || downloading}>
        {downloading ? "Preparing…" : done ? "✓ Downloaded!" : `Download ${filtered.length} Expense${filtered.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const C = {
  cream: "#fdf6ee", warm: "#f5e8d6",
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
  loginTitle: { fontFamily: "'Georgia', serif", fontSize: 32, color: C.ink, margin: "0 0 6px", fontWeight: 700 },
  loginSub: { fontFamily: "'Georgia', serif", color: C.muted, fontSize: 15, margin: "0 0 32px", fontStyle: "italic" },
  loginPrompt: { fontFamily: "system-ui", color: C.ink, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 },
  loginBtns: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 },
  loginBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 28px", background: C.warm, border: `2px solid ${C.border}`, borderRadius: 16, cursor: "pointer", transition: "transform 0.15s", flex: 1 },
  loginAvatar: { width: 44, height: 44, borderRadius: "50%", background: C.terra, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 },
  loginName: { fontFamily: "'Georgia', serif", fontSize: 15, color: C.ink, fontWeight: 600 },
  loginNote: { fontSize: 12, color: C.muted, fontFamily: "system-ui" },
  shell: { display: "flex", flexDirection: "column", minHeight: "100vh", background: C.cream, maxWidth: 480, margin: "0 auto" },
  header: { background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontFamily: "'Georgia', serif", fontSize: 18, fontWeight: 700, color: C.ink },
  sync: { fontSize: 11, color: C.sage, fontFamily: "system-ui", fontWeight: 600 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  userChip: { display: "flex", alignItems: "center", gap: 7, background: C.warm, borderRadius: 20, padding: "5px 12px 5px 7px", border: `1px solid ${C.border}` },
  userDot: { width: 26, height: 26, borderRadius: "50%", background: C.terra, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 },
  userName: { fontFamily: "system-ui", fontSize: 13, fontWeight: 600, color: C.ink },
  logoutBtn: { background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "system-ui", padding: "4px 8px" },
  main: { flex: 1, overflowY: "auto", paddingBottom: 80 },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 12px" },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" },
  navIcon: { fontSize: 18, transition: "color 0.15s" },
  navLabel: { fontSize: 9, fontFamily: "system-ui", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
  page: { padding: "20px" },
  pageTitle: { fontFamily: "'Georgia', serif", fontSize: 22, color: C.ink, margin: "0 0 20px", fontWeight: 700 },
  balanceCard: { background: `linear-gradient(135deg, ${C.terra}, ${C.teraDark})`, borderRadius: 20, padding: "28px 24px", marginBottom: 16, textAlign: "center", color: "#fff" },
  balanceLabel: { fontFamily: "system-ui", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.8, margin: "0 0 8px" },
  balanceAmount: { fontFamily: "'Georgia', serif", fontSize: 40, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-1px" },
  owedBadge: { fontFamily: "system-ui", fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "6px 16px", display: "inline-block" },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
  statCard: { background: C.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${C.border}` },
  statName: { fontFamily: "system-ui", fontSize: 12, color: C.muted, margin: "0 0 6px", fontWeight: 500 },
  statVal: { fontFamily: "'Georgia', serif", fontSize: 18, color: C.ink, margin: 0, fontWeight: 700 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: "system-ui", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 },
  monthRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: `1px solid ${C.border}` },
  monthName: { fontFamily: "'Georgia', serif", fontSize: 15, color: C.ink, fontWeight: 700, margin: 0 },
  monthSub: { fontFamily: "system-ui", fontSize: 11, color: C.muted, margin: "3px 0 0" },
  monthAmt: { fontFamily: "'Georgia', serif", fontSize: 16, color: C.ink, fontWeight: 700, margin: 0 },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  catCard: { background: C.card, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.border}` },
  catEmoji: { fontSize: 20 },
  catName: { fontFamily: "system-ui", fontSize: 12, color: C.muted, flex: 1 },
  catAmt: { fontFamily: "'Georgia', serif", fontSize: 13, color: C.ink, fontWeight: 700 },
  expRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.border}` },
  expLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  expCat: { fontSize: 20, flexShrink: 0 },
  expDesc: { fontFamily: "system-ui", fontSize: 14, color: C.ink, fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  expMeta: { fontFamily: "system-ui", fontSize: 11, color: C.muted, margin: "2px 0 0" },
  expRight: { display: "flex", alignItems: "center", gap: 10 },
  expAmt: { fontFamily: "'Georgia', serif", fontSize: 15, color: C.ink, fontWeight: 700 },
  delBtn: { background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "4px 8px", borderRadius: 6 },
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
  cancelBtn: { width: "100%", padding: "12px", borderRadius: 14, background: "none", color: C.muted, border: `1.5px solid ${C.border}`, fontFamily: "system-ui", fontSize: 14, cursor: "pointer", marginTop: 10 },
  savedScreen: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 },
  savedIcon: { width: 72, height: 72, borderRadius: "50%", background: C.sage, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700 },
  savedText: { fontFamily: "'Georgia', serif", fontSize: 22, color: C.ink, fontWeight: 700 },
  filterRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 4, scrollbarWidth: "none" },
  filterBtn: { flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.border}`, background: C.warm, fontFamily: "system-ui", fontSize: 12, color: C.muted, cursor: "pointer", fontWeight: 500 },
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
  // Import
  preloadCard: { background: `linear-gradient(135deg, ${C.warm}, ${C.card})`, border: `1.5px solid ${C.terra}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 16 },
  preloadLeft: { flex: 1 },
  preloadTitle: { fontFamily: "system-ui", fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 },
  preloadSub: { fontFamily: "system-ui", fontSize: 12, color: C.muted, margin: "4px 0 0" },
  preloadArrow: { fontSize: 18, color: C.terra, fontWeight: 700 },
  dividerRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, background: C.border },
  dividerText: { fontFamily: "system-ui", fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" },
  uploadBox: { border: `2px dashed ${C.border}`, borderRadius: 16, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: C.warm, marginBottom: 16, transition: "border-color 0.2s" },
  uploadIcon: { fontSize: 40, margin: "0 0 10px" },
  uploadTitle: { fontFamily: "'Georgia', serif", fontSize: 17, color: C.ink, fontWeight: 700, margin: "0 0 4px" },
  uploadSub: { fontFamily: "system-ui", fontSize: 12, color: C.muted },
  errorBox: { background: "#fdf0ee", border: "1px solid #e8b4a8", borderRadius: 10, padding: "12px 16px", fontFamily: "system-ui", fontSize: 13, color: "#c0503a", marginBottom: 14, lineHeight: 1.5 },
  infoBox: { background: C.warm, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" },
  infoTitle: { fontFamily: "system-ui", fontSize: 13, fontWeight: 700, color: C.ink, margin: "0 0 6px" },
  infoText: { fontFamily: "system-ui", fontSize: 12, color: C.muted, lineHeight: 1.5, margin: 0 },
  reviewSummary: { background: C.warm, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, border: `1px solid ${C.border}` },
  reviewCount: { fontFamily: "system-ui", fontSize: 13, fontWeight: 700, color: C.ink, margin: 0 },
  reviewTotal: { fontFamily: "'Georgia', serif", fontSize: 20, color: C.terra, fontWeight: 700, margin: "4px 0 0" },
  selectAllBtn: { padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "system-ui", fontSize: 12, fontWeight: 600, color: C.muted, cursor: "pointer" },
  importSettings: { background: C.warm, borderRadius: 14, padding: "16px", marginBottom: 20, border: `1px solid ${C.border}` },
  importRow: { display: "flex", alignItems: "flex-start", gap: 12, background: C.card, borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.border}`, cursor: "pointer", transition: "opacity 0.15s" },
  checkbox: { width: 20, height: 20, borderRadius: 6, border: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", background: C.warm },
  checkboxChecked: { background: C.terra, borderColor: C.terra },
  checkmark: { color: "#fff", fontSize: 11, fontWeight: 700 },
  importDesc: { fontFamily: "system-ui", fontSize: 14, color: C.ink, fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 },
  importAmt: { fontFamily: "'Georgia', serif", fontSize: 15, color: C.ink, fontWeight: 700, flexShrink: 0 },
  importDate: { fontFamily: "system-ui", fontSize: 11, color: C.muted },
  // Inline edit
  editToggleBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px", flexShrink: 0, marginTop: 0, lineHeight: 1 },
  editPanel: { background: C.warm, borderTop: `1px solid ${C.border}`, padding: "14px 14px 10px" },
  editField: { marginBottom: 12 },
  editLabel: { display: "block", fontFamily: "system-ui", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  editInput: { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "system-ui", fontSize: 14, color: C.ink, boxSizing: "border-box", outline: "none" },
  editCatGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  editCatBtn: { padding: "5px 10px", borderRadius: 16, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "system-ui", fontSize: 12, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 },
  editCatBtnActive: { borderColor: C.terra, background: C.terra, color: "#fff" },
  editDoneBtn: { width: "100%", padding: "9px", borderRadius: 10, background: C.teraDark, color: "#fff", border: "none", fontFamily: "system-ui", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  editSplitInput: { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "'Georgia', serif", fontSize: 18, fontWeight: 700, color: C.ink, boxSizing: "border-box", textAlign: "center", outline: "none" },
  // Export
  exportDateCard: { background: C.warm, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", marginBottom: 16 },
  exportDateRow: { display: "flex", gap: 12 },
  presetChip: { padding: "5px 12px", borderRadius: 16, border: `1.5px solid ${C.border}`, background: C.card, fontFamily: "system-ui", fontSize: 11, fontWeight: 600, color: C.muted, cursor: "pointer" },
  exportPreview: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", marginBottom: 16 },
  exportStatRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 },
  exportStat: { textAlign: "center" },
  exportStatLabel: { fontFamily: "system-ui", fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" },
  exportStatVal: { fontFamily: "'Georgia', serif", fontSize: 14, color: C.ink, fontWeight: 700, margin: 0 },
  exportBalanceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 10 },
};
