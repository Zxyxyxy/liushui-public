---
name: financial-advisor
description: Monthly personal financial analysis with XLSX dashboard and DOCX narrative report. Reads bank/CC statements, credit reports, debt tracking, and paystubs.
argument-hint: "[YYYY-MM | --setup | --migrate]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, TeamCreate, TeamDelete, TaskCreate, TaskList, TaskGet, TaskUpdate, SendMessage
---

Generate a monthly personal financial analysis using 4 parallel agents (spending analyzer, debt strategist, credit health monitor, budget/savings advisor).

Target: $ARGUMENTS

## Constants

```
FINANCIAL_ROOT = $ONEDRIVE_PERSONAL/Personal/Financial Reports
PERSONAL_ROOT  = $ONEDRIVE_PERSONAL/Personal
```

## Step 0: First-Run Setup and Directory Verification

Check that all required subdirectories exist under `FINANCIAL_ROOT`:

```
Bank Statements/
Credit Card Statements/
Credit Score/
Debt Tracking/
Mortgage/
Investments/
Pay Stubs/
Insurance/
Loan Forgiveness/
Other/
Reports/
```

If any are missing, create them with `mkdir -p`.

### Mode Routing

- If `$ARGUMENTS` is `--setup`: create directories, print confirmation, and STOP.
- If `$ARGUMENTS` is `--migrate`: run the migration script (Step 0b) and STOP.
- Otherwise: proceed to Step 1.

### Step 0b: File Migration (--migrate only)

Write and execute `/tmp/financial_migrate.py`. The script copies (NOT moves) files from scattered locations into the organized structure using `shutil.copy2` to preserve timestamps. Skip files that already exist at the destination (compare filename only).

**Print a dry-run summary first, then execute.**

Source-to-destination mapping:

| Source | Destination |
|--------|-------------|
| `PERSONAL_ROOT/Bank Statements/Paystub/*.pdf` | `Pay Stubs/` |
| `PERSONAL_ROOT/Banking/stmt.csv` | `Bank Statements/` |
| `PERSONAL_ROOT/Banking/transactions.xlsx` | `Bank Statements/` |
| `PERSONAL_ROOT/Banking/eStmt_*.pdf` | `Bank Statements/` |
| `PERSONAL_ROOT/Banking/Mortgage - Escrow Docs/*` | `Mortgage/` |
| `PERSONAL_ROOT/House/eStmt_*.pdf` | `Bank Statements/` |
| `PERSONAL_ROOT/CreditCardStatement.pdf` | `Credit Card Statements/` |
| `PERSONAL_ROOT/Debt.xlsx` | `Debt Tracking/` |
| `PERSONAL_ROOT/Debt_Amortization_Schedule.csv` | `Debt Tracking/` |
| `PERSONAL_ROOT/Out of Debt.xlsx` | `Debt Tracking/` |
| `PERSONAL_ROOT/House/Edward Jones*.pdf` | `Investments/` |
| `PERSONAL_ROOT/House/Edward Jones*.xlsx` | `Investments/` |
| `PERSONAL_ROOT/House/Liquidity of Roth IRA.pdf` | `Investments/` |
| `PERSONAL_ROOT/House/XXXX7338*edj*.pdf` | `Investments/` |
| `PERSONAL_ROOT/Stonks/Indices.xlsx` | `Investments/` |
| `PERSONAL_ROOT/Retirement/*.pdf` | `Investments/` |
| `PERSONAL_ROOT/Deerfield Bonds.pdf` | `Investments/` |
| `PERSONAL_ROOT/American Fidelity/*.pdf` | `Insurance/` |
| `PERSONAL_ROOT/Loan Forgiveness/*` | `Loan Forgiveness/` |
| `PERSONAL_ROOT/Credit Report/*.pdf` | `Credit Score/` |
| `PERSONAL_ROOT/House/*W2*.pdf` | `Pay Stubs/` |
| `PERSONAL_ROOT/House/*W2*.png` | `Pay Stubs/` |
| `PERSONAL_ROOT/House/*W2*.png.pdf` | `Pay Stubs/` |
| `PERSONAL_ROOT/House/*paystub*` | `Pay Stubs/` |
| `PERSONAL_ROOT/House/*Paystub*` | `Pay Stubs/` |
| `PERSONAL_ROOT/House/$AUTHOR_NAME CHECK STUBS.pdf` | `Pay Stubs/` |
| `PERSONAL_ROOT/House/employer-stub.pdf` | `Pay Stubs/` |
| `PERSONAL_ROOT/Child Support.xlsx` | `Other/` |
| `PERSONAL_ROOT/Personal - Travel.xlsx` | `Other/` |

After migration, print count of files copied per destination folder.

## Step 1: Determine Target Month

- If `$ARGUMENTS` matches `YYYY-MM` format, use that as target month.
- Otherwise, default to the current month (today's date).
- Set variables: `MONTH` (01-12), `YEAR` (YYYY), `MONTH_YEAR` (e.g., "February 2026"), `MONTH_TAG` (e.g., "2026-02").

## Step 2: Inventory Available Files

Scan each subdirectory for files relevant to the target month. Financial files may not always be month-tagged, so inventory everything available:

1. **Bank Statements/**: CSVs (`stmt.csv`, `transactions.xlsx`), PDF statements (`eStmt_*.pdf`)
2. **Credit Card Statements/**: PDF statements
3. **Debt Tracking/**: `Debt.xlsx`, `Out of Debt.xlsx`, `Debt_Amortization_Schedule.csv`
4. **Credit Score/**: Equifax.pdf, Experian.pdf, TransUnion.pdf
5. **Pay Stubs/**: Monthly paystub PDFs
6. **Investments/**: Edward Jones files, retirement statements
7. **Mortgage/**: Escrow documents

Print a summary table of available files. Warn if critical files are missing (bank statements, debt tracking).

Create the output directory: `FINANCIAL_ROOT/Reports/YYYY-MM/`

## Step 3: Create Team and Tasks

1. `TeamCreate` with `team_name: "financial-YYYY-MM"` (e.g., `financial-2026-02`).

2. `TaskCreate` for 4 tasks:

### Task 1: Spending Analysis
Reads: Bank Statements/ and Credit Card Statements/
- Parse CSV/XLSX files with pandas for transaction data
- Extract text from PDF statements with PyMuPDF (`fitz`) for amounts and descriptions
- Categorize every transaction using the keyword engine (see Categorization Engine below)
- Calculate: total income, total expenses, category totals, top 10 merchants
- Detect recurring charges (same merchant, similar amount, monthly pattern)
- Flag transactions over $500 as "large"
- Write results to `/tmp/financial_spending_YYYY-MM.json`

### Task 2: Debt Analysis
Reads: Debt Tracking/
- Read Debt.xlsx or Out of Debt.xlsx with openpyxl
- For each debt: creditor name, type (CC/loan/mortgage/student), balance, interest rate, minimum payment
- Calculate: total debt, total minimum payments, weighted average interest rate
- Model avalanche payoff (highest rate first) with extra payment scenarios ($100, $250, $500/mo extra)
- Model snowball payoff (lowest balance first) with same scenarios
- Estimate debt-to-income ratio (needs income from spending agent, estimate if unavailable)
- Write results to `/tmp/financial_debt_YYYY-MM.json`

### Task 3: Credit Health Analysis
Reads: Credit Score/
- Extract text from Equifax.pdf, Experian.pdf, TransUnion.pdf using PyMuPDF
- Parse: credit scores, credit utilization %, number of accounts, derogatory marks, hard inquiries, oldest account age
- Compare across bureaus
- Flag concerning items (high utilization, derogatory marks, recent inquiries)
- Write results to `/tmp/financial_credit_YYYY-MM.json`

### Task 4: Budget & Savings Analysis
Reads: Pay Stubs/, and spending results from Task 1
- Read paystub PDFs for gross income, net income, deductions
- Wait for spending analysis to complete (blocked by Task 1)
- Calculate: savings rate (income - expenses) / income
- Run 50/30/20 analysis (50% needs, 30% wants, 20% savings/debt)
- Audit subscriptions from recurring charges
- Identify top 3 savings opportunities
- Estimate emergency fund status (months of expenses covered)
- Write results to `/tmp/financial_budget_YYYY-MM.json`

3. Set Task 4 as `addBlockedBy: [Task 1 ID]`.

## Step 4: Spawn 4 Agents

Launch all 4 in a SINGLE message using the `Agent` tool:

```
Agent(team_name: "financial-YYYY-MM", name: "spending-analyzer", subagent_type: "general-purpose")
Agent(team_name: "financial-YYYY-MM", name: "debt-strategist", subagent_type: "general-purpose")
Agent(team_name: "financial-YYYY-MM", name: "credit-monitor", subagent_type: "general-purpose")
Agent(team_name: "financial-YYYY-MM", name: "budget-advisor", subagent_type: "general-purpose")
```

Each agent prompt must include:
- The exact file paths to read
- The categorization keyword list (for spending agent)
- The output JSON path and expected schema
- Instructions to claim their task via TaskUpdate, mark in_progress, then completed when done

### Agent JSON Output Schemas

**spending_YYYY-MM.json:**
```json
{
  "month": "YYYY-MM",
  "total_income": 0.00,
  "total_expenses": 0.00,
  "net_cashflow": 0.00,
  "categories": {"Housing": 0.00, "Food & Grocery": 0.00, ...},
  "top_merchants": [{"name": "", "total": 0.00, "count": 0}],
  "recurring_charges": [{"merchant": "", "amount": 0.00, "frequency": "monthly"}],
  "large_transactions": [{"date": "", "merchant": "", "amount": 0.00, "category": ""}],
  "transactions": [{"date": "", "description": "", "amount": 0.00, "category": ""}]
}
```

**debt_YYYY-MM.json:**
```json
{
  "month": "YYYY-MM",
  "total_debt": 0.00,
  "total_minimum_payments": 0.00,
  "weighted_avg_rate": 0.00,
  "debt_to_income_ratio": 0.00,
  "debts": [{"creditor": "", "type": "", "balance": 0.00, "rate": 0.00, "min_payment": 0.00}],
  "avalanche": {"months": 0, "total_interest": 0.00, "scenarios": {}},
  "snowball": {"months": 0, "total_interest": 0.00, "scenarios": {}},
  "debts_paid_off_this_month": []
}
```

**credit_YYYY-MM.json:**
```json
{
  "month": "YYYY-MM",
  "scores": {"equifax": 0, "experian": 0, "transunion": 0},
  "average_score": 0,
  "utilization": 0.00,
  "total_accounts": 0,
  "derogatory_marks": 0,
  "hard_inquiries": 0,
  "oldest_account_years": 0,
  "concerns": [""],
  "recommendations": [""]
}
```

**budget_YYYY-MM.json:**
```json
{
  "month": "YYYY-MM",
  "gross_income": 0.00,
  "net_income": 0.00,
  "total_expenses": 0.00,
  "savings_rate": 0.00,
  "budget_50_30_20": {
    "needs_target": 0.00, "needs_actual": 0.00,
    "wants_target": 0.00, "wants_actual": 0.00,
    "savings_target": 0.00, "savings_actual": 0.00
  },
  "subscriptions": [{"name": "", "amount": 0.00, "keep_recommendation": true}],
  "savings_opportunities": [""],
  "emergency_fund_months": 0.0
}
```

## Step 5: Monitor and Collect

Poll `TaskList` until all 4 tasks show `completed`. Then read all 4 JSON files from `/tmp/`.

If any agent fails, note the failure and proceed with available data.

## Step 6: Generate XLSX Dashboard

Write `/tmp/financial_dashboard_gen.py` and execute with `python3`.

The script reads the 4 JSON files and generates a 6-tab XLSX workbook:

### Styling Constants
```python
NAVY = "1F3864"
MED_BLUE = "2E75B6"
LIGHT_BLUE = "D6E4F0"
WHITE = "FFFFFF"
header_font = Font(name="Calibri", bold=True, color=WHITE, size=11)
header_fill = PatternFill(start_color=NAVY, end_color=NAVY, fill_type="solid")
alt_fill = PatternFill(start_color=LIGHT_BLUE, end_color=LIGHT_BLUE, fill_type="solid")
thin_border = Border(
    left=Side(style="thin", color=MED_BLUE),
    right=Side(style="thin", color=MED_BLUE),
    top=Side(style="thin", color=MED_BLUE),
    bottom=Side(style="thin", color=MED_BLUE),
)
```

### Tab 1: Summary
Key metrics in a card-style layout:
- Monthly Income, Monthly Expenses, Net Cashflow, Savings Rate
- Total Debt, Debt-to-Income Ratio
- Credit Scores (Equifax / Experian / TransUnion / Average)
- Net Worth Estimate (if data available)

### Tab 2: Spending
- Category breakdown table (Category, Amount, % of Total) sorted descending
- PieChart of top 8 categories
- Top 10 merchants table
- Recurring charges table

### Tab 3: Debt
- All debts table: Creditor, Type, Balance, Rate, Min Payment
- Avalanche vs Snowball comparison table with payoff months and total interest for each scenario
- Extra payment scenarios ($100, $250, $500 extra/month)

### Tab 4: Credit
- Three-bureau comparison table
- Score rating (Poor/Fair/Good/Very Good/Exceptional)
- Utilization, negative items, inquiries
- Recommendations list

### Tab 5: Budget
- 50/30/20 target vs actual table
- Subscription audit table (Name, Amount, Keep?)
- Savings opportunities list
- Emergency fund status

### Tab 6: Transactions
- Full merged transaction log: Date, Description, Amount, Category
- Sorted by date descending
- Auto-filter on all columns
- Frozen header row

All tabs: frozen header rows, alternating row shading (light blue), navy headers with white text, Calibri 11pt, thin blue borders.

Charts use navy (`1F3864`), medium blue (`2E75B6`), and light blue (`D6E4F0`) palette.

Save to: `FINANCIAL_ROOT/Reports/YYYY-MM/Financial_Dashboard_YYYY-MM.xlsx`

## Step 7: Generate DOCX Report

Write `/tmp/financial_report_gen.py` and execute with `python3`.

The script reads the 4 JSON files and generates a narrative report using `python-docx`.

### Document Styling
- Font: Calibri 11pt throughout body
- Headings: Navy color (#1F3864), Calibri
- No bold in body text, no emdashes
- Single spacing between paragraphs, 1.15 line spacing

### Report Sections

**1. Executive Summary**
3-5 key highlights and concerns. Lead with the most impactful finding. Example: "Net cashflow was $X this month, with a Y% savings rate."

**2. Spending Analysis**
- Total expenses by category narrative
- Top 10 spending table (use python-docx table)
- Notable or unusual charges
- Recurring charge audit

**3. Debt Progress**
- Total debt and change from previous month (if available)
- Payoff trajectory (avalanche recommended timeline)
- Interest cost analysis
- Any debts paid off or about to be paid off

**4. Credit Health**
- Scores by bureau with rating bands
- Utilization analysis
- Negative items or concerns
- Specific recommendations

**5. Budget & Savings**
- Income vs expenses narrative
- 50/30/20 analysis with target vs actual
- Subscription audit highlights
- Top savings opportunities
- Emergency fund status

**6. Action Items**
Numbered, prioritized, specific, actionable steps. Example:
1. Pay off [smallest debt] by [date] to free up $X/month
2. Cancel [subscription] to save $X/month
3. Increase 401k contribution by 1% at next open enrollment

Save to: `FINANCIAL_ROOT/Reports/YYYY-MM/Financial_Report_YYYY-MM.docx`

## Step 8: Cleanup

1. Delete temp files: `/tmp/financial_*.py`, `/tmp/financial_*.json`
2. Send `shutdown_request` to all 4 teammates
3. `TeamDelete`

## Step 9: Open and Report

1. Open both output files:
   ```
   open "FINANCIAL_ROOT/Reports/YYYY-MM/Financial_Dashboard_YYYY-MM.xlsx"
   open "FINANCIAL_ROOT/Reports/YYYY-MM/Financial_Report_YYYY-MM.docx"
   ```

2. Print terminal summary:
   ```
   Financial Advisor - MONTH_YEAR
   ==============================

   Agents
   - Spending Analyzer: [status]
   - Debt Strategist: [status]
   - Credit Monitor: [status]
   - Budget Advisor: [status]

   Key Numbers
   - Monthly Income: $X,XXX
   - Monthly Expenses: $X,XXX
   - Savings Rate: XX%
   - Total Debt: $XX,XXX
   - Credit Score (avg): XXX

   Files
   - Dashboard: Financial Reports/Reports/YYYY-MM/Financial_Dashboard_YYYY-MM.xlsx
   - Report: Financial Reports/Reports/YYYY-MM/Financial_Report_YYYY-MM.docx

   Next Month Prep
   [ ] Download bank statement PDF for current month
   [ ] Download credit card statement PDF
   [ ] Update Debt.xlsx with current balances
   [ ] (Quarterly) Download fresh credit reports
   ```

## Transaction Categorization Engine

Use this keyword mapping for transaction categorization. Match against transaction descriptions, case-insensitive. First match wins; unmatched transactions go to "Other."

```python
CATEGORIES = {
    "Housing": ["mortgage", "rent", "hoa", "property tax", "homeowner"],
    "Utilities": ["electric", "water", "gas", "internet", "phone", "spectrum", "att", "verizon",
                  "comcast", "utility", "sewer", "trash", "waste"],
    "Food & Grocery": ["grocery", "kroger", "walmart", "aldi", "publix", "food lion", "ingles",
                       "food city", "costco", "sam's club", "target"],
    "Dining Out": ["restaurant", "mcdonald", "chick-fil", "starbucks", "dunkin", "wendy",
                   "burger", "pizza", "taco", "chipotle", "panera", "cracker barrel",
                   "waffle", "ihop", "applebee", "olive garden", "chili", "sonic", "zaxby",
                   "grubhub", "doordash", "uber eats", "cafe"],
    "Transportation": ["gas station", "shell", "exxon", "bp", "marathon", "pilot", "murphy",
                       "car wash", "parking", "uber", "lyft", "oil change", "tire",
                       "autozone", "advance auto", "jiffy"],
    "Subscriptions": ["netflix", "hulu", "disney", "spotify", "apple music", "youtube",
                      "amazon prime", "audible", "kindle", "adobe", "microsoft 365",
                      "dropbox", "icloud", "playstation", "xbox", "nintendo",
                      "subscription", "recurring"],
    "Healthcare": ["pharmacy", "walgreens", "cvs", "doctor", "hospital", "medical",
                   "dental", "vision", "optom", "copay", "prescription", "quest diag",
                   "labcorp", "urgent care", "dexcom"],
    "Education": ["etsu", "university", "college", "tuition", "student", "book",
                  "chegg", "course", "udemy", "coursera"],
    "Shopping": ["amazon", "ebay", "best buy", "home depot", "lowe", "bath & body",
                 "tj maxx", "ross", "marshalls", "old navy", "gap", "nike", "dick's",
                 "academy", "hobby lobby", "michaels"],
    "Kids": ["child", "daycare", "school supply", "toys r us", "children",
             "kid", "baby", "pediatric"],
    "Financial": ["bank fee", "atm", "overdraft", "interest charge", "late fee",
                  "finance charge", "annual fee", "wire transfer"],
    "Insurance": ["insurance", "geico", "state farm", "allstate", "progressive",
                  "american fidelity", "life insurance", "premium"],
    "Debt Payments": ["loan payment", "credit card payment", "student loan",
                      "auto payment", "mortgage payment", "principal", "payoff"],
    "Income/Deposits": ["deposit", "direct dep", "payroll", "salary", "transfer in",
                        "refund", "reimbursement", "tax refund", "venmo", "zelle"],
    "Savings/Investments": ["edward jones", "401k", "ira", "investment", "savings",
                            "brokerage", "dividend", "contribution"],
}
```

## Debt Payoff Projection Algorithm

```python
def project_payoff(debts, extra_monthly=0, method="avalanche"):
    """
    debts: list of dicts with balance, rate (annual %), min_payment
    method: "avalanche" (highest rate first) or "snowball" (lowest balance first)
    Returns: months_to_payoff, total_interest_paid
    """
    import copy
    debts = copy.deepcopy(debts)
    if method == "avalanche":
        debts.sort(key=lambda d: -d["rate"])
    else:  # snowball
        debts.sort(key=lambda d: d["balance"])

    months = 0
    total_interest = 0
    max_months = 360  # 30 year cap

    while any(d["balance"] > 0 for d in debts) and months < max_months:
        months += 1
        freed = extra_monthly
        for d in debts:
            if d["balance"] <= 0:
                continue
            monthly_rate = d["rate"] / 100 / 12
            interest = d["balance"] * monthly_rate
            total_interest += interest
            payment = d["min_payment"] + freed
            freed = 0
            d["balance"] = d["balance"] + interest - payment
            if d["balance"] <= 0:
                freed += abs(d["balance"])
                d["balance"] = 0

    return months, round(total_interest, 2)
```

## Rules

- NEVER move original files. Migration always copies.
- If a JSON result file is missing (agent failed), skip that section gracefully in reports.
- Use `python3` for all Python execution.
- Quote all file paths (OneDrive has spaces).
- Do NOT print raw financial data to the terminal, only summaries.
- Delete ALL temp files after completion.
- Both output files go in `Reports/YYYY-MM/` subfolder.
