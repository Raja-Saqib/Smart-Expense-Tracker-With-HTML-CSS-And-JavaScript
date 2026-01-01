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

