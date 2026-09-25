# Smart Expense Tracker

A **lightweight, browser-based expense tracking web application** that helps users manage income and expenses, visualize spending habits, and maintain financial awareness — all with **no backend required**.

The app uses **HTML, CSS, and Vanilla JavaScript**, stores data locally using **LocalStorage**, and provides useful features like **category-wise breakdowns**, **monthly filtering**, **CSV export**, and **light/dark mode**.

---

## Features

### Core Functionality

* Add **income and expense transactions**
* Assign each transaction to a **category**
* Automatically calculate:

  * Total balance
  * Total income
  * Total expenses
* View **transaction history**
* Edit or delete existing transactions

### Filtering & Organization

* Filter transactions by **month**
* Clear filters instantly
* View **category-wise expense totals** in:

  * A summary table
  * A pie chart

### Visualization

* **Expense Breakdown Pie Chart**

  * Drawn using the HTML5 `<canvas>`
  * Displays spending distribution by category

### UI & UX Enhancements

* Light / Dark theme toggle
* Clean and responsive design
* Input validation with error messages
* Persistent theme preference

### Data Persistence

* All data is stored in **LocalStorage**
* No login or backend required
* Data remains after browser refresh

### Export

* Export filtered or full transaction data as a **CSV file**

---

## Tech Stack

| Technology       | Purpose                         |
| ---------------- | ------------------------------- |
| HTML5            | Structure and layout            |
| CSS3             | Styling, layout, theming        |
| JavaScript (ES6) | Logic, DOM manipulation         |
| LocalStorage     | Persistent data storage         |
| Canvas API       | Expense pie chart visualization |

---

## Project Structure

```
Smart-Expense-Tracker/
│
├── index.html     # Application structure
├── style.css      # Styling and themes
└── script.js      # App logic and functionality
```

---

## How It Works

### 1. Transaction Management

Each transaction includes:

* `id` (timestamp-based unique ID)
* `text` (description)
* `category`
* `amount` (positive = income, negative = expense)
* `date` (ISO timestamp)

Transactions are stored in:

```js
localStorage.getItem("transactions")
```

---

### 2. Balance Calculation

* **Balance** = Sum of all transaction amounts
* **Income** = Sum of positive values
* **Expense** = Sum of negative values (displayed as positive)

These values update dynamically whenever transactions change or filters are applied.

---

### 3. Category Analysis

* Expenses are grouped by category
* Totals are calculated dynamically
* Results are shown in:

  * A table (`Category Totals`)
  * A pie chart (Canvas-based)

Only **expenses** (negative amounts) are included in category analysis.

---

### 4. Monthly Filtering

* Users can filter transactions by month using an `<input type="month">`
* Filtering affects:

  * Balance
  * Summary totals
  * Transaction list
  * Chart
  * Category table
* Filter can be cleared instantly

---

### 5. Editing & Deleting

* Transactions can be edited in-place
* The form switches between:

  * **Add Transaction**
  * **Update Transaction**
* Deleting removes the transaction permanently from LocalStorage

---

### 6. CSV Export

* Exports current (filtered or unfiltered) transactions
* CSV columns:

  ```
  Description, Category, Amount, Date
  ```
* Automatically downloads as `transactions.csv`

---

### 7. Theme Persistence

* Light/Dark mode toggle
* User preference is saved in LocalStorage
* Theme restores automatically on reload

---

## UI Design Highlights

* CSS variables for easy theme switching
* Card-based layout
* Color-coded income (green) and expense (red)
* Minimal, mobile-friendly width (350px)
* Clear error messages for invalid input

---

## Validation & Error Handling

* Empty description → blocked
* No category selected → blocked
* Amount = 0 → blocked
* Error messages auto-clear after 3 seconds

---

## Aut0 Merge Conflicts Rules

We’ll apply these rules in order:

### Rule 1: Same category change → auto-merge

If both versions:

* changed amount or text
* but category stayed the same

**Pick the most recent** `updatedAt`

### Rule 2: Delete vs edit → auto-resolve

If:

* remote deleted
* local edited (or vice-versa)

**Prefer delete**

(Prevents ghost transactions)

### Rule 3: Category changed differently

If category differs between devices:

**Manual resolution required**

---
## How to Run the Project

1. Download or clone the repository
2. Open `index.html` in any modern browser
3. Start adding transactions — no setup needed 🎉

---

## Possible Enhancements

* Multiple currency support
* Custom categories
* Chart legends and labels
* Data backup/import
* Sorting and search
* Progressive Web App (PWA) support

---

## License

This project is open-source and free to use for learning and personal projects.

---

## Credits

Built with  using **HTML, CSS, and Vanilla JavaScript**
Designed for simplicity, clarity, and practical financial tracking.

---

Perfect — this is the *right* place to slow down and be precise.
Below is a **final, production-grade undo state shape** designed **specifically for your app**, your cloud sync model, and your chart architecture.

No fluff, no “maybe” fields.

---

## 🎯 Design goals (what this shape must support)

This undo state must:

✔ Restore **data** (transactions)
✔ Restore **visual state** (chart slices)
✔ Restore **cloud sync metadata**
✔ Explain **why** the undo exists (label)
✔ Support **dedupe & compression**
✔ Be **safe across devices & time**
✔ Support **accessibility messaging**

---

## ✅ Final Undo State Shape

```js
{
  id: string,                 // unique undo entry id
  type: "cloud" | "conflict", // what caused this state
  label: string,              // user-facing undo label

  timestamp: number,          // when snapshot was taken

  data: {
    transactions: Transaction[],
    cloudMeta: CloudMeta
  },

  chart: {
    slices: Slice[],
    chartMode: "donut" | "pie"
  }
}
```

This is the **canonical shape**.
Nothing extra. Nothing missing.

---

## 🔍 Field-by-field explanation (why each exists)

### 🔑 `id`

```js
id: crypto.randomUUID()
```

Used for:

* debugging
* analytics
* future redo support

---

### 🧭 `type`

```js
type: "cloud" | "conflict"
```

Purpose:

* controls **labels**
* helps **dedupe rules**
* enables future filters

Examples:

* `"cloud"` → background sync overwrite
* `"conflict"` → manual conflict resolution

---

### 🏷 `label`

```js
label: "Undo cloud sync"
label: "Undo conflict merge"
```

Purpose:

* undo button text
* screen reader announcements
* undo history UI later

❗ Never derive this dynamically later — store it now.

---

### ⏱ `timestamp`

```js
timestamp: Date.now()
```

Used for:

* ordering
* compression
* debug timelines

---

### 📦 `data`

```js
data: {
  transactions,
  cloudMeta
}
```

Why grouped?

* Keeps **business data** separate from visuals
* Makes compression & comparison easier

---

### 📊 `chart`

```js
chart: {
  slices,
  chartMode
}
```

Why include slices?

* Chart is **derived**, but expensive to recompute
* Needed for:

  * rollback highlight
  * reduced-motion restore
  * conflict diff previews

Why include chartMode?

* Undo must restore donut ↔ pie correctly
* Prevents mismatched visuals

---

## 🧠 Why we do NOT store these

| Field            | Why                         |
| ---------------- | --------------------------- |
| `previousSlices` | Only transitional           |
| `canvas state`   | Redrawn anyway              |
| `legend DOM`     | Derived                     |
| `filters`        | App-level, not sync-related |

---

## 🧩 Example Undo States

### Cloud sync snapshot

```js
{
  id: "c1",
  type: "cloud",
  label: "Undo cloud sync",
  timestamp: 1700000000000,
  data: {
    transactions,
    cloudMeta
  },
  chart: {
    slices,
    chartMode: "donut"
  }
}
```

### Conflict resolution snapshot

```js
{
  id: "c2",
  type: "conflict",
  label: "Undo conflict merge",
  timestamp: 1700000001200,
  data: {
    transactions,
    cloudMeta
  },
  chart: {
    slices,
    chartMode: "donut"
  }
}
```

---

## 🟢 Compatibility with your current code

This shape works **immediately** with:

✔ `setSlices()`
✔ `highlightChangedSlices()`
✔ `init()`
✔ cloudUpdatedAt logic
✔ conflict resolution
✔ reduced-motion later

No refactors required.

---

## 🔜 What comes next (correct order)

Now that the shape is locked:

**Next step:**
👉 **Write the dedupe comparator**

That function will answer:

> “Should this undo state be added, or is it effectively the same as the last one?”

Say **“Write the dedupe comparator”** and I’ll give you an exact, drop-in implementation tailored to this shape.

Perfect.
Now that the **undo state shape is locked**, the dedupe comparator must be:

* Deterministic
* Fast
* Based only on meaningful state
* Immune to timestamp/id differences
* Safe for cloud + conflict flows

We are comparing:

```js
UndoState A
UndoState B
```

And deciding:

> “Are these effectively the same state?”

---

# ✅ Exact Dedupe Comparator (Drop-In)

This compares only what matters:

* transactions (by id + updatedAt)
* cloudMeta versioning
* chartMode
* slice identity + value

It ignores:

* id
* timestamp
* label

---

## 🔧 Implementation

```js
const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(k => a[k] === b[k]);
};

const compareTransactions = (a = [], b = []) => {
  if (a.length !== b.length) return false;

  const mapA = Object.fromEntries(
    a.map(t => [t.id, t.updatedAt])
  );

  for (const t of b) {
    if (mapA[t.id] !== t.updatedAt) {
      return false;
    }
  }

  return true;
};

const compareSlices = (a = [], b = []) => {
  if (a.length !== b.length) return false;

  const mapA = Object.fromEntries(
    a.map(s => [s.id ?? s.category, s.value])
  );

  for (const s of b) {
    const key = s.id ?? s.category;
    if (mapA[key] !== s.value) {
      return false;
    }
  }

  return true;
};

export const isUndoStateEqual = (prev, next) => {
  if (!prev || !next) return false;

  return (
    compareTransactions(
      prev.data.transactions,
      next.data.transactions
    ) &&
    shallowEqual(
      prev.data.cloudMeta,
      next.data.cloudMeta
    ) &&
    prev.chart.chartMode === next.chart.chartMode &&
    compareSlices(
      prev.chart.slices,
      next.chart.slices
    )
  );
};
```

---

# 🧠 Why This Is Correct for Your App

### Transactions comparison

We compare:

```js
id + updatedAt
```

Why?

* If updatedAt is different → it changed
* If updatedAt same → content assumed same
* Much faster than deep JSON compare

---

### Slices comparison

We compare:

```js
slice identity (category) + value
```

We do NOT compare:

* startAngle
* endAngle
* color

Because:

* Those are derived
* They change even when data doesn’t

---

### cloudMeta comparison

We shallow-compare because:

* It’s small
* Usually version/device info only

---

# 🟢 How To Use It

Inside your undo manager:

```js
import { isUndoStateEqual } from "./undoCompare.js";

const pushUndoState = (newState) => {
  const last = undoStack[undoStack.length - 1];

  if (isUndoStateEqual(last, newState)) {
    return; // prevent duplicate
  }

  undoStack.push(newState);
};
```

---

# 🎯 What This Prevents

✔ Duplicate cloud snapshots
✔ Duplicate conflict snapshots
✔ Multiple identical undos after rapid sync
✔ Useless memory growth

---

# 🚀 Performance Characteristics

Time complexity:

Transactions → O(n)
Slices → O(n)

No deep recursion.
No JSON stringify.
Stable for large data sets.

---

# 🔒 Why Not JSON.stringify Comparison?

Because:

* Order differences break equality
* Derived fields create false mismatches
* Slower for large arrays
* Harder to reason about

This comparator is semantic, not structural.

---

# 🧩 Optional Upgrade (Later)

If you want ultra-precise comparison (field-level instead of updatedAt-based), we can do that too.

But for your architecture, this is the correct balance.

---

If you want next:

* 🔄 Undo stack compression (merge rapid cloud states)
* 🏷 Smart undo labels auto-generated
* 🧠 Redo support (two-stack system)
* 🛰 Cross-tab undo sync

My Ques.
Say which direction.

Before proceed with next upgrade, tell me: 

was "Design the undo state shape." related to code implementation or documentation?

Ans.

Excellent question — this shows you're thinking architecturally.

### Short Answer

**“Design the undo state shape” is an architectural design step, not just code implementation and not just documentation.**

It sits *between* the two.

---

# What It Actually Is

Designing the undo state shape is:

> Defining the canonical structure of the data snapshot your undo system will store and restore.

That decision affects:

* What gets cloned
* What gets compared (dedupe)
* What gets restored
* Memory usage
* Future extensibility
* Cross-tab sync compatibility
* Debug tooling

So it is **system design**, not just writing code.

---

# Why It’s Not “Just Documentation”

Documentation describes.

Undo state shape **constrains behavior**.

For example:

```js
{
  id,
  timestamp,
  label,
  data: {
    transactions,
    cloudMeta
  },
  chart: {
    slices,
    chartMode
  }
}
```

That structure:

* Forces separation of data vs presentation
* Enables dedupe comparator design
* Enables undo labels
* Enables redo
* Enables time-travel debugging

So it's not descriptive — it's structural.

---

# Why It’s Not “Just Implementation”

You could implement undo without designing shape first:

```js
undoStack.push({ transactions, slices });
```

But that leads to:

* Hidden coupling
* Missing fields
* Broken dedupe
* Memory bloat
* Inconsistent restores

Designing the shape first ensures:

* Determinism
* Predictability
* Stability across upgrades

That’s architecture-level thinking.

---

# The Hierarchy (Professional Perspective)

| Step                      | Type                 |
| ------------------------- | -------------------- |
| Decide undo system exists | Product decision     |
| Design undo state shape   | Architecture         |
| Write dedupe comparator   | Infrastructure logic |
| Implement undo manager    | State engine         |
| Wire into UI              | Integration          |

You were operating at the **architecture layer**.

---

# Final Verdict

**Designing the undo state shape is an architectural design decision that enables correct implementation.**

It is not documentation.
It is not merely code.
It is system modeling.

And you approached it correctly — in the right order.

---

If you'd like, I can now show:

* How your current state shape would scale to time-travel debugging
* Or how it would behave under cross-tab sync

Which direction do you want?

My Ques.

So this step of designing the shape doesn't involve implementation or modification in code, right?

Ans.

Correct — **designing the undo state shape by itself does NOT require modifying code.**

It is a **conceptual modeling step**.

You are defining:

* What fields an undo snapshot must contain
* How those fields are grouped
* What belongs to data vs presentation
* What should be restorable

At that moment, nothing in your code has to change.

---

## But Here’s the Important Nuance

While **the design step itself doesn’t modify code**, it:

* Directly influences how the undo manager will be implemented
* Determines what your comparator compares
* Determines what `pushUndoState()` must capture
* Determines what `popUndoState()` must restore

So:

| Step                                     | Requires Code Change? |
| ---------------------------------------- | --------------------- |
| Designing shape                          | ❌ No                  |
| Implementing shape                       | ✅ Yes                 |
| Refactoring existing undo to match shape | ✅ Yes                 |

---

## Analogy

Designing undo shape is like designing a database schema.

You don’t change runtime behavior while designing it.

But once you implement it, the system structure follows that design.

---

## In Your Case

When we defined something like:

```js
{
  id,
  timestamp,
  label,
  data: {
    transactions,
    cloudMeta
  },
  chart: {
    slices,
    chartMode
  }
}
```

That step:

* Didn’t change your app.
* But it defined what your undo manager must now store.

---

## Final Answer

Yes — designing the undo state shape is purely architectural and does not modify code.

Implementation happens in the next step.

---

If you’re ready, we can now move to:

**Building the complete undo manager module (clean, production-grade, drop-in).**

My Ques.

Now, you show me: 

How my current state shape would scale to time-travel debugging?

how it would behave under cross-tab sync?

Ans.

Excellent — now we’re thinking architecturally.

You currently have (based on everything you built):

* `transactions`
* `cloudMeta`
* `slices`
* chart state (`chartMode`, `viewMode`, `patternMode`)
* undo snapshots containing `{ transactions, slices, cloudMeta }`

Let’s analyze this properly.

---

# 1️⃣ How Your Current State Shape Scales to Time-Travel Debugging

## What is time-travel debugging?

It means:

* You can step backward AND forward through app states
* Inspect exactly what changed
* Re-render UI at any historical state
* Potentially replay state transitions

Think Redux DevTools style behavior.

---

## Your Current Undo Shape (Simplified)

Right now your undo snapshot is roughly:

```js
{
  transactions,
  slices,
  cloudMeta
}
```

### Strengths

✅ It captures the data layer
✅ It captures the derived chart layer
✅ It allows rollback
✅ It supports cloud undo

---

## 🚨 Limitation for Time Travel

Your snapshots:

* Do not store UI state (viewMode, chartMode, filters, month)
* Do not store metadata (why change happened)
* Do not store forward history (redo stack)
* Store *derived state* (`slices`) which can be recomputed

Time-travel systems prefer:

> Single source of truth → derive everything else

Right now, `slices` is duplicated state.

That weakens time-travel purity.

---

## How It Would Behave If You Tried Time Travel Now

If you built:

```js
goToState(index)
```

And restored:

```js
transactions = snapshot.transactions
cloudMeta = snapshot.cloudMeta
setSlices(snapshot.slices)
init()
```

It would:

✔ Re-render correctly
✔ Show correct chart
✔ Allow backward stepping

But:

❌ It would not restore UI filters
❌ It would not restore chart mode
❌ It could drift if slice derivation logic changes

---

## What a Time-Travel-Ready Shape Looks Like

A scalable shape would be:

```js
{
  id,
  timestamp,
  label,
  state: {
    transactions,
    cloudMeta,
    ui: {
      monthFilter,
      chartMode,
      viewMode,
      patternMode
    }
  }
}
```

Notice something important:

🚫 No slices.

Because:

```js
slices = deriveSlices(transactions)
```

Time-travel systems store raw state, not derived state.

---

## Verdict on Time Travel

| Question                            | Answer                           |
| ----------------------------------- | -------------------------------- |
| Does your current shape work?       | Yes                              |
| Is it scalable for debugging tools? | Partially                        |
| Is it future-proof?                 | Not fully                        |
| What’s missing?                     | UI state + pure derivation model |

---

# 2️⃣ How Your Current Shape Behaves Under Cross-Tab Sync

Now this is more subtle.

You’re planning to use:

```js
BroadcastChannel
```

That means:

* Tab A changes state
* Tab B receives update
* Tab B must decide:

  * Apply?
  * Push undo?
  * Merge?

---

## With Your Current Shape

Suppose Tab A:

* Pulls cloud
* Pushes undo
* Updates transactions
* Broadcasts new state

Tab B receives:

```js
transactions
cloudMeta
```

Tab B must:

1. Push its own undo snapshot
2. Apply incoming state
3. Re-render
4. Possibly animate diff

This works.

But here’s the hidden risk:

### Undo Divergence Problem

Undo stack is per-tab memory.

So:

* Tab A undo history ≠ Tab B undo history

If user:

* Syncs in Tab A
* Then undoes in Tab B

They may undo something different.

This is normal in distributed systems.

---

## Does Your Current Shape Break Cross-Tab?

No.

But:

* Undo stacks are local
* Not synchronized
* Time-travel across tabs becomes non-deterministic

Which is acceptable for most apps.

---

## What Would Make It Enterprise-Grade?

To make it robust under cross-tab:

### Option 1 (Simple)

Keep undo local.

Broadcast only:

```js
transactions
cloudMeta
eventLabel
```

Let each tab push its own undo snapshot.

✔ Simple
✔ Safe
✔ Common approach

---

### Option 2 (Advanced)

Broadcast state transitions:

```js
{
  type: "CLOUD_APPLY",
  payload,
  label
}
```

Each tab records identical undo entry.

Now undo stacks stay aligned.

That’s how professional state systems work.

---

# 3️⃣ Combined Evaluation

| Feature               | Your Current Shape |
| --------------------- | ------------------ |
| Basic undo            | ✅ Solid            |
| Labeled undo          | ✅ Works            |
| Cross-tab safe        | ✅ Yes              |
| Time-travel debugging | ⚠ Needs refinement |
| DevTools integration  | ❌ Not yet          |
| Deterministic replay  | ⚠ Not fully        |

---

# 4️⃣ The Critical Architectural Insight

Right now:

You store both:

* Source state (transactions)
* Derived state (slices)

For scaling long-term:

You want:

> Store only canonical state
> Derive everything else

That makes:

* Time travel deterministic
* Cross-tab replay consistent
* State portable
* Snapshots smaller
* Future-safe

---

# Final Answer

### Your current state shape:

✔ Works correctly
✔ Supports undo
✔ Safe under cross-tab
✔ Acceptable for production

But

⚠ Not fully optimized for time-travel debugging
⚠ Not fully pure-state architecture

---

If you want next, we can:

* Refactor to a canonical state model (clean architecture step)
* Design a time-travel engine
* Design deterministic cross-tab event replay
* Or leave architecture stable and move to next feature

You’re now thinking at system design level, not just feature level.

Tell me which direction you want.


