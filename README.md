# Smart Expense Tracker

A modern, high-performance, modular personal finance Single Page Application (SPA) built with pure vanilla HTML5, CSS3, and ES6+ JavaScript modules. Designed with zero external frontend frameworks or bundlers, the application features a custom HTML5 Canvas charting engine, reactive state management, an offline-first LocalStorage engine with real-time Supabase cloud synchronization, time-travel undo/redo history, multi-currency conversion, cross-tab synchronization, and RFC 4180-compliant CSV data import/export.

---

## Project Overview

The **Smart Expense Tracker** provides a seamless, privacy-conscious finance tracking experience for guest users and authenticated members alike. Operating entirely in the browser without requiring build steps (such as Webpack, Vite, or Babel), it delivers real-time expense breakdown visualization, automated transaction sign normalization, and cloud account migration.

Key architecture highlights include:
* **Zero-Framework Architecture**: Built using native browser standards—HTML5 native forms, CSS Custom Properties, native HTML5 Canvas 2D context, and modular ES JavaScript (`import`/`export`).
* **Dual-Tier Persistence**: Operates in an offline-first mode using browser `localStorage` with automated optimistic concurrency synchronization to a Supabase database when signed in.
* **Custom HTML5 Canvas Chart Engine**: A custom, lightweight data visualization engine constructed from scratch using native HTML5 Canvas 2D API (`<canvas>`), offering interactive donut/pie chart, visual diff overlays, hover tooltips, and slice highlighting.
* **Tabular Data Breakdown** Donut/Pie Chart can be switched to table to display data in a tabular format. 
* **Time-Travel Undo/Redo Engine**: State snapshot management supporting linear history traversal, snapshot diffing, keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`), and cloud history synchronization.
* **Multi-Currency Support**: Real-time currency normalization supporting 9 world currencies (USD, EUR, GBP, PKR, INR, JPY, CNY, CAD, AUD) with 1-hour exchange rate local caching via exchange rate APIs.

---

## Features

### 1. Transaction Management & Automated Rules
* **Add, Edit & Delete**: Full lifecycle management for income and expense entries with descriptions, amounts, dates, and categories.
* **Categorization**: Pre-configured categories divided into Income (`Income`, `Salary`) and Expenses (`Food`, `Transport`, `Shopping`, `Bills`, `Entertainment`, `Health`, `Rent`, `Other`).
* **Automated Amount Normalization**: Converts input amounts to canonical signed values—income categories automatically store positive values, while expense categories automatically convert to negative values (`js/transactionRules.js`).
* **Advanced Filtering & Search**: Real-time client-side filtering by category, transaction type (`all`, `income`, `expense`), and date range.

### 2. Custom HTML5 Canvas Charting Engine
* **Multiple Visualization Modes**: Toggle seamlessly between Donut/Pie charts and Bar charts (`js/chart.js`).
* **Interactive Hit-Testing & Hover Effects**: Calculates polar and Cartesian coordinates to detect point-in-slice hover states (`js/chartHitTest.js`), displaying dynamic HTML/Canvas tooltips (`js/chartHover.js`).
* **Slice Highlighting & Selection**: Supports clicking slices to highlight transactions matching specific categories (`js/chartClick.js`, `js/chartHighlight.js`).
* **Smooth Animation Loops**: Smooth slice transitions and rendering built with `requestAnimationFrame` (`js/chartAnimations.js`).
* **Pattern Fills & Visual Diff Overlays**: Custom Canvas pattern generation for visual accessibility (`js/chartPatterns.js`) and state comparison overlays (`js/chartDiff.js`).

### 3. State Management & Schema Validation
* **Reactive State Container**: Centralized Pub/Sub state store (`js/state.js`) enabling decoupled component subscription.
* **Immutability Enforcement**: Deep recursive object freezing (`js/deepFreeze.js`) to prevent unintended direct state mutations.
* **Runtime Schema Validation**: Robust validation engine (`js/stateValidator.js`) verifying state integrity, data types, UUID formats, and transaction fields prior to committing state changes.

### 4. Cloud Synchronization & Auth Migration
* **Supabase Authentication**: Integrated registration, login, logout, and password management powered by Supabase Auth (`js/auth.js`).
* **Optimistic Concurrency Control**: Cloud state versioning (`cloud/cloudSync.js`) utilizing atomic database RPC functions (`update_expense_tracker_state`) to detect version collisions and prevent data overwrite conflicts.
* **Automated Exponential Backoff Retry**: Resilient cloud saving pipeline (`cloud/saveWithRetry.js`) that automatically queues state updates and retries failed operations on network disruption.
* **Guest-to-User State Migration**: Automatically migrates local guest data to cloud storage upon user authentication (`js/identityMigration.js`), retaining a unique client device UUID (`js/deviceIdentity.js`).

### 5. Time-Travel Undo / Redo & Snapshot Inspector
* **Linear History Stack**: Captures state snapshots on every mutation (`js/historyState.js`) with an in-memory and local storage undo stack.
* **Global Keyboard Shortcuts**: Quick time-travel navigation using `Ctrl+Z` / `Cmd+Z` for Undo and `Ctrl+Y` / `Cmd+Shift+Z` for Redo.
* **Visual History Inspector**: Developer debug overlay (`js/historyInspector.js`) allowing visual inspection of past state snapshots, deep state diffs (`js/snapshotDiff.js`), and cloud sync history (`js/undoSync.js`).

### 6. Multi-Currency Conversion & Exchange Rate Engine
* **Supported Currencies**: Full support for US Dollar (USD), Euro (EUR), British Pound (GBP), Pakistani Rupee (PKR), Indian Rupee (INR), Japanese Yen (JPY), Chinese Yuan (CNY), Canadian Dollar (CAD), and Australian Dollar (AUD).
* **Live Rate Fetching & Caching**: Connects to currency exchange rate APIs with a 1-hour local storage cache (`CACHE_TTL`) to minimize network queries (`js/exchangeRates.js`).
* **Dynamic Base Currency Preference**: User-configurable base currency (`js/currencyPreferences.js`) with automatic real-time display conversion across all transactions and summaries.

### 7. Cross-Tab Real-Time Sync
* **Multi-Tab State Propagation**: Leverages Web `BroadcastChannel` API and window `storage` events (`js/crossTabSync.js`) to synchronize transaction additions, edits, and deletions instantly across open browser tabs.

### 8. CSV Import & Export Engine
* **RFC 4180-Compliant CSV Parser**: Custom CSV parsing engine (`js/csvImport.js`) handling quoted strings, line breaks, and comma delimiters without third-party dependencies.
* **Automated Header Mapping & Validation**: Automatically maps CSV headers (`description`, `category`, `amount`, `date`, `currency`) with interactive error diagnostics and preview modal before import.
* **Filtered CSV Export**: Generates formatted CSV downloads reflecting current user search filters and date ranges (`js/csvExport.js`).

### 9. Theme Switcher & Developer Diagnostics
* **Dark / Light Theme Toggle**: Seamless UI theme toggling with accessible SVG icons, CSS Custom Properties, and local preference storage.
* **Developer Debug Panel**: Toggleable visual panel (`js/debugPanel.js`) displaying active storage keys, cloud version numbers, device UUID, and real-time undo stack metrics.

### 10. HTML `hidden` Attribute Toggling
* **Authentication &amp; Account Views**: The application dynamically switches visible forms in `js/main.js` by setting or clearing the HTML `hidden` attribute[1]. It conditionally toggles between guest login buttons (`#userAuth`), the login form (`#authLogin`), sign-up form (`#authSignUp`), logged-in account status (`#authLoggedIn`), password change form (`#changePasswordForm`), and the password recovery modal (`#passwordRecovery`)[1].
* **Visualization Views**: Switching between the HTML5 Canvas chart (`#chartView`) and the Category Totals table (`#tableView`) dynamically updates `chartView.hidden` and `tableView.hidden` based on the selected `viewMode` ("chart" vs "table")[8].

### 11. Dynamic DOM Generation & Clearing
* **Transaction List**: `renderList()` in `js/ui.js` clears `listEl.innerHTML` and conditionally injects `"<li>No transactions yet</li>"` if the filtered transaction array is empty[11]. When transactions exist, it dynamically creates formatted `<li>` elements containing description labels, normalized currency amounts, and action buttons[11][12].
* **Category Breakdown Table**: `renderCategories()` filters negative amounts (expenses), aggregates totals per category, and conditionally generates table rows (``) only for categories with spent balances[13][14].
* **Category Filter Chips**: `renderCategoryFilterChips()` dynamically constructs interactive button chips for all valid categories (`Food`, `Transport`, `Rent`, etc.) and sets `aria-pressed` and `.active` classes based on the current filter state[15].</li>

---

## Tech Stack

| Layer | Technology / Standard | Usage & Responsibility |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5 (Native DOM & Canvas) | Semantic application layout, modal structures, and custom `<canvas>` visual charting. |
| **Styling** | CSS3 (Variables & Flexbox/Grid) | Responsive application styling, theme customization, dark/light mode tokens. |
| **Language** | Vanilla JavaScript (ES6+ Modules) | Application logic, reactive state, event handling, modular ES `import`/`export`. |
| **Cloud Services** | Supabase JS Client (`v2` via CDN) | Database operations, RPC execution, user authentication (Signup, Login, Password Change). |
| **Web APIs** | HTML5 Canvas API | 2D vector graphics rendering, hit testing, chart pattern generation, and animations. |
| **Storage & Sync** | Web Storage API (`localStorage`) | Offline state persistence, exchange rate caching, theme & currency preferences. |
| **Cross-Tab Communication** | `BroadcastChannel` & `storage` events | Instant real-time state synchronization across multiple open browser tabs. |
| **External API** | Foreign Exchange Rate API | Live foreign exchange rate retrieval via `API_BASE` endpoint. |
| **Icons** | FontAwesome Free SVG Icons (v7.3.1) | Theme toggle icons, auth controls, navigation, and modal button iconography. |

---

## Project Structure

```
smart-expense-tracker-with-html-css-and-javascript/
├── index.html                 # Main application HTML markup & component structure
├── style.css                  # Comprehensive CSS stylesheet, CSS variables, dark/light themes
├── config.js                  # Configuration file (Supabase credentials, API URLs, storage keys)
├── cloud/                     # Cloud synchronization & Supabase database integration
│   ├── cloudState.js          # Cloud metadata storage keys & cloud state normalization utilities
│   ├── cloudSync.js           # Supabase DB operations, RPC state push/pull, versioning control
│   ├── saveWithRetry.js       # Exponential backoff retry engine & concurrency conflict resolver
│   └── supabaseClient.js      # Supabase client instantiation via ESM CDN
└── js/                        # Core application modules & UI rendering engine
    ├── auth.js                # Supabase Auth integration (login, signup, logout, password change)
    ├── chart.js               # Canvas chart engine coordinator & primary renderer
    ├── chartAnimations.js     # RequestAnimationFrame chart animation loops
    ├── chartClick.js          # Canvas click event listener & slice selection handler
    ├── chartDiff.js           # Visual diff overlay renderer for comparing chart states
    ├── chartGeometry.js       # Trigonometric math helpers (radians, angles, center coordinates)
    ├── chartHighlight.js      # Visual highlight effects for selected chart segments
    ├── chartHitTest.js        # Mathematical canvas point-in-slice hit testing calculations
    ├── chartHover.js          # Hover detection & dynamic tooltip positioning logic
    ├── chartPatterns.js       # Pattern fill generators for canvas chart segments
    ├── chartState.js          # Chart configuration & display state manager
    ├── crossTabSync.js        # BroadcastChannel & Storage event cross-tab synchronization
    ├── csvExport.js           # Filtered transaction export to downloadable CSV files
    ├── csvImport.js           # RFC 4180 CSV parser, column auto-mapping, and validation engine
    ├── currency.js            # Currency definitions, locale formats, and validation checks
    ├── currencyPreferences.js # User base currency setting persistence in local storage
    ├── debugPanel.js          # Floating developer diagnostic overlay component
    ├── deepFreeze.js          # Recursive object freezing utility for state immutability
    ├── deviceIdentity.js      # Unique client UUID v4 generation and device key persistence
    ├── eventBus.js            # Light Pub/Sub event bus implementation for app-wide events
    ├── events.js              # DOM event binding helper functions
    ├── exchangeRates.js       # Foreign exchange rate fetcher & 1-hour local cache manager
    ├── filters.js             # Filter predicate functions (search, category, date, type)
    ├── historyInspector.js    # Developer visual undo/redo history inspector component
    ├── historyState.js        # Time-travel undo/redo stack manager & snapshot history
    ├── identityMigration.js   # Guest-to-authenticated account state migration workflow
    ├── localState.js          # LocalStorage reader/writer & backup key management
    ├── main.js                # Application entry point, DOM initialization & event wiring
    ├── snapshotDiff.js        # Object diff calculator for state snapshot comparison
    ├── state.js               # Central reactive state container & subscriber manager
    ├── stateValidator.js      # Runtime schema validator for state and transaction objects
    ├── transactionRules.js    # Category classifications (income vs expense) & sign normalization
    ├── ui.js                  # DOM rendering engine, transaction list, and modal controls
    ├── undoCompare.js         # Deep comparison utility for undo/redo state states
    ├── undoSync.js            # Sync coordinator between local undo stack & cloud state
    └── utils.js               # Helper utilities (date formatting, UUID generator, HTML escaping)
```

---

## Prerequisites

Before running the application, ensure you have the following installed:

1. **Modern Web Browser**: A browser supporting HTML5 Canvas, ES6 JavaScript Modules, `BroadcastChannel`, and `localStorage` (Chrome 80+, Firefox 75+, Safari 13.1+, or Edge 80+).
2. **Local HTTP Web Server**: Because native ES modules require HTTP/HTTPS protocol to load relative imports, you must serve the files using a local server rather than opening `index.html` directly via `file://`.
    * Python 3 (`python -m http.server`)
    * Node.js (`npx serve` or `npx http-server`)
    * VS Code extension: *Live Server*
3. **Supabase Account (Optional)**: Required only if you intend to enable cloud backup, user authentication, and multi-device synchronization.

---

## Installation Steps

### Step 1: Clone or Download the Project
Clone the repository or download the source files into a local directory:
```bash
git clone <repository-url>
cd smart-expense-tracker-with-html-css-and-javascript
```

### Step 2: Create `config.js`
In the root directory of the project, create a file named `config.js` with your configuration settings:
```javascript
export const CLOUD_CONFIG = {
  SUPABASE_DB_URL: "YOUR_SUPABASE_PROJECT_URL",
  SUPABASE_DB_PUBLISH_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  CLOUD_META_KEY: "smart_expense_tracker_cloud_meta",
  STORAGE_SYNC_KEY: "smart_expense_tracker_sync_signal",
  CHANNEL_NAME: "smart_expense_tracker_channel",
  BASE_CURRENCY_KEY: "smart_expense_tracker_base_currency",
  API_BASE: "YOUR_EXCHANGE_RATES_API_BASE",
  CACHE_KEY: "smart_expense_tracker_exchange_rates"
};
```

### Step 3: Configure Supabase Database (Optional for Cloud Features)
If you are enabling cloud synchronization, log in to your Supabase SQL Editor and execute the following SQL script to set up the database schema and RPC procedure:

```sql
-- 1. Create the application state table
create table if not exists public.expense_tracker_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid,
  transactions jsonb not null default '[]'::jsonb,
  chart_mode text default 'donut',
  meta jsonb default '{}'::jsonb
);

-- 2. Enable Row Level Security (RLS)
alter table public.expense_tracker_state enable row level security;

-- 3. Create RLS Policies for authenticated users
create policy "Users can view own state" on public.expense_tracker_state
  for select using (auth.uid() = user_id);

create policy "Users can update own state" on public.expense_tracker_state
  for update using (auth.uid() = user_id);

create policy "Users can insert own state" on public.expense_tracker_state
  for insert with check (auth.uid() = user_id);

-- 4. Create optimistic concurrency update RPC procedure
create or replace function public.update_expense_tracker_state(
  p_user_id uuid,
  p_expected_version integer,
  p_next_version integer,
  p_transactions jsonb,
  p_chart_mode text,
  p_meta jsonb
) returns jsonb as $$
declare
  v_updated record;
begin
  update public.expense_tracker_state
  set
    version = p_next_version,
    updated_at = now(),
    updated_by = p_user_id,
    transactions = p_transactions,
    chart_mode = p_chart_mode,
    meta = p_meta
  where user_id = p_user_id and version = p_expected_version
  returning * into v_updated;

  if not found then
    return null;
  end if;

  return row_to_json(v_updated)::jsonb;
end;
$$ language plpgsql security definer;
```

### Step 4: Launch the Local HTTP Server
Start your local HTTP web server in the project directory:

* **Using Python 3**:
    ```bash
    python3 -m http.server 8000
    ```
* **Using Node.js (`serve`)**:
    ```bash
    npx serve .
    ```

### Step 5: Access the Application
Open your browser and navigate to the local server URL (e.g., `http://localhost:8000`).

---

## Usage with Examples

### 1. Adding Transactions
1. Enter the description (e.g., `Grocery Shopping`), category (`Food`), amount (`150.50`), date (`2026-11-05`), and currency (`USD`).
2. Click **Add Transaction**.
3. Note that selecting an expense category (`Food`, `Transport`, etc.) automatically converts the stored numerical value to negative (`-150.50`), while income categories (`Salary`, `Income`) store positive values (`+5000.00`).

### 2. Filtering
* **Category Filter**: Select a specific category from the filter chips to isolate spending in that area.
* **Date Filtering**: Use the start and end date pickers to view expenses within a custom time window.
* **Type Filter**: Switch between `All`, `Income`, and `Expense` chips.

### 3. Importing Data via CSV
You can import bulk transactions using a CSV file. Prepare a file named `transactions.csv` formatted as follows:

```csv
description,category,amount,date,currency
Software Subscription,Bills,29.99,2026-11-01,USD
Freelance Payment,Income,1200.00,2026-11-02,USD
Coffee Shop,Food,4.75,2026-11-03,USD
Gym Membership,Health,45.00,2026-11-04,USD
```

1. Click **Import CSV** in the application interface.
2. Select your `.csv` file.
3. Review the preview modal for any validation flags or row parsing errors.
4. Confirm import to merge transactions into your current state.

### 4. Time-Travel Undo and Redo
* Press `Ctrl + Z` (Windows/Linux) or `Cmd + Z` (macOS) to revert the last transaction change.
* Press `Ctrl + Y` (Windows/Linux) or `Cmd + Shift + Z` (macOS) to re-apply an undone change.
* Observe instant UI updates across the transaction table, balance summary, and HTML5 Canvas chart.

### 5. Multi-Currency Operations
* Select your preferred base currency from the header selector (e.g., `EUR`).
* The application fetches conversion rates from the configured exchange rate API, caching rates for 1 hour.
* Transactions stored in foreign currencies (e.g., `USD` or `GBP`) are automatically converted to `EUR` in the summary headers and analytics charts.

---

## UI Design Highlights

* CSS variables for easy theme switching
* Card-based layout
* Color-coded income (green) and expense (red)
* Responsive Design with minimal, mobile-friendly width (350px)
* Clear error messages for invalid input
* Conditional Rendering for User Authentication Operations
* Dynamic Labelling on Undo & Redo buttons

---

## Validation & Error Handling

* No currency → blocked
* No category selected → blocked
* Amount = 0 → blocked
* Error messages auto-clear after 3 seconds
* Empty description → Optional to skip

---

## Possible Enhancements

* Data Visualization Dashboard with multiple charts for enhanced data analysis
* Dynamic Category Budgeting 
* Custom Categories
* Sorting and Keyword searching
* Progressive Web App (PWA) support

---

## License

This application codebase is open-source.

**Third-Party Icon License Notice**:
* This project incorporates SVG icons from **FontAwesome Free v7.3.1** (Copyright 2026 Fonticons, Inc.).
* FontAwesome Free icons are licensed under the FontAwesome Free License.

---

## Credits

* **FontAwesome**: Iconography assets for UI buttons and theme controls.
* **Supabase**: Open-source backend platform providing cloud database infrastructure, RPC execution, and user authentication services.
* **Frankfurter API**: Open-source foreign currency exchange rate service.
