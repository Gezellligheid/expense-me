# 💰 Expense-me

A personal finance tracker built with Vue 3. Track your income and expenses month by month, manage recurring transactions, project your financial future, and export your data — all stored locally in your browser, no account required.

---

## Features

### 📊 Dashboard

- Monthly financial overview with total income, total expenses, and running balance
- **Doughnut chart** showing spending broken down by category
- **Bar chart** comparing income vs. expenses side by side
- Monthly insights: average daily spending, biggest expense, savings rate, and comparison against the previous month
- Set an optional starting balance to track your overall financial position over time
- **Custom date range picker** — select any arbitrary start/end date with a two-month calendar panel. Days that have an expense (or recurring expense) show a red dot; days with income (or recurring income) show a green dot

### 🔁 Recurring Transactions

- Define recurring expenses and incomes that automatically appear in every month
- **Optional end date** — set a stop date on any recurring rule so it cancels automatically on that day; clear it at any time with the × button
- **Per-month income overrides** — because income isn't always the same. Set a different amount for any specific month without touching the recurring rule
- Visual badge showing how many overrides exist per recurring income
- Override modal with diff indicators (▲ higher / ▼ lower than the base amount)

### 📈 Projections

- 12-month forward projection for any year, calculated from your recurring transactions and overrides
- Changeable year selector (past and future)
- Bar chart (monthly income vs. expenses) and Line chart (running balance over the year)
- Monthly breakdown table with projected income, expenses, net, and cumulative balance

### ⚙️ Settings

- **Currency switcher** — choose from 29 currencies; all amounts update instantly across the entire app
- **Theme picker** — Light, Dark, or System (follows your OS preference)
- **Data management** — export all data as JSON, reset transactions, reset recurring, or wipe everything with a confirmation step

### 📤 Export

- **Excel (.xlsx)** — multi-sheet workbook with a Summary sheet, an Expenses sheet, and an Income sheet
- **CSV** — flat file with all transactions for the selected month

---

## Tech Stack

| Layer           | Library                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| Framework       | [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)                    |
| Language        | TypeScript                                                                         |
| Routing         | [Vue Router 4](https://router.vuejs.org/)                                          |
| Styling         | [Tailwind CSS 3](https://tailwindcss.com/)                                         |
| Charts          | [Chart.js 4](https://www.chartjs.org/) + [vue-chartjs 5](https://vue-chartjs.org/) |
| Excel export    | [SheetJS (xlsx)](https://sheetjs.com/)                                             |
| Build tool      | [Vite](https://vitejs.dev/)                                                        |
| Package manager | [Bun](https://bun.sh/)                                                             |
| Persistence     | `localStorage` (no backend, no account)                                            |

---

## Getting Started

**Prerequisites:** [Bun](https://bun.sh/) installed.

```bash
# Install dependencies
bun install

# Start the development server
bun run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

```bash
# Build for production
bun run build

# Preview the production build
bun run preview
```

---

## Project Structure

```
src/
├── views/
│   ├── Home.vue                  # Dashboard — monthly overview & charts
│   ├── Projections.vue           # 12-month financial projections
│   └── Settings.vue              # Currency, theme & data management
├── components/
│   ├── RecurringTransactions.vue # Manage recurring income & expenses
│   ├── navbar/
│   │   └── Navbar.vue
│   └── modals/
│       ├── ExpenseModal.vue
│       └── IncomeModal.vue
├── composables/
│   └── useSettings.ts            # Singleton: currency, theme, formatCurrency()
├── services/
│   └── storageService.ts         # All localStorage CRUD + recurring logic
└── router/
    └── router.ts
```

---

## Data Storage

All data lives in `localStorage` under the following keys:

| Key                        | Contents                                         |
| -------------------------- | ------------------------------------------------ |
| `expenses`                 | One-off expense transactions                     |
| `incomes`                  | One-off income transactions                      |
| `recurringExpenses`        | Recurring expense rules                          |
| `recurringIncomes`         | Recurring income rules                           |
| `recurringIncomeOverrides` | Per-month amount overrides for recurring incomes |
| `initialBalance`           | Optional starting balance                        |
| `appSettings`              | Selected currency and theme                      |

No data ever leaves your device.
