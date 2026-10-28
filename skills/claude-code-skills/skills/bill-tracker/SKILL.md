# Bill Tracker Skill

## Description
Track Tennessee education legislation. Uses the official TN Legislature website (wapp.capitol.tn.gov) as the primary data source for status, votes, fiscal notes, and amendments. Optionally seeds bill lists from State Affairs Pro reports.

## Trigger
Activate when the user says "track bills", "bill tracker", "legislative tracker", provides a State Affairs Pro report URL, or asks to check bill status.

## Arguments
- URL to a State Affairs Pro report (to get initial bill list)
- OR: specific bill numbers to track
- Optional: "update" to refresh status on previously tracked bills

## Instructions

### Step 1: Identify Bills to Track
Option A: If a State Affairs Pro report URL is provided:
1. Use Puppeteer MCP to navigate (JS-heavy SPA, requires browser rendering)
2. Extract text via `puppeteer_evaluate` on `document.querySelector('body').innerText`
3. The page content is long; extract in chunks (0-15000, 15000-30000, etc.)
4. Parse bill numbers from the report

Option B: If specific bill numbers are given, use those directly.

Option C: If "update" mode, read the most recent tracker from the Legislative folder and use those bill numbers.

### Step 2: Look Up Each Bill on TN Legislature Website
For each bill, fetch from `https://wapp.capitol.tn.gov/apps/Billinfo/Default?BillNumber={BILL}&ga=114`
- Use WebFetch with a prompt to extract: bill number, caption, sponsors, full status history with dates, current status, companion bill, amendments, vote results, and fiscal impact
- Note: Most current bills are GA 114. Carryover bills from 2024-2025 may also be GA 114. If "Bill Not Found", try GA 113.
- Batch fetches in parallel (8 at a time works well) for efficiency

Extract for each bill:
- Bill number and companion bill number
- Short title/description
- Sponsor(s) with party
- Full status history with dates
- Current status in both chambers
- Amendment numbers, sponsors, and descriptions (see Step 2b)
- Vote results (committee and floor, with counts)
- Fiscal impact statement
- Next scheduled hearing/vote

### Step 2b: Look Up Amendments
For each bill that has amendments listed on its bill info page:
1. Fetch the amendment detail page: `https://wapp.capitol.tn.gov/apps/BillInfo/Default.aspx?BillNumber={AMENDMENT_NUMBER}&GA=114`
   - Amendment numbers follow the pattern: HA0001, SA0001, etc. (House Amendment, Senate Amendment)
   - Some bills link amendments directly from the status history (e.g., "Amendment 1 adopted")
2. Extract for each amendment:
   - Amendment number (e.g., HA0123, SA0456)
   - Sponsor(s)
   - Description/summary of what the amendment changes
   - Status: filed, adopted, failed, withdrawn, tabled
   - Vote results if voted on (ayes/nays/PNV)
   - Date of last action
3. Flag amendments that substantively change the bill's impact on the district (e.g., funding formula changes, new compliance requirements, scope expansions)
4. If the amendment text is available as a PDF link on the page, note the URL but do not download it unless the user requests it
5. Batch amendment fetches in parallel alongside bill fetches for efficiency

### Step 3: Categorize and Assess Impact
Assign each bill to a district-relevant category:
- **Funding/TISA** - budget, funding formulas, weighted allocations
- **Safety/Security** - school safety, threats, searches, SROs
- **Nutrition** - food service, dyes, meal programs
- **Staffing/HR** - licensure, tenure, salary, hiring, bonuses
- **Curriculum** - standards, instruction, social studies, civics
- **Technology/Digital** - devices, virtual schools, internet policy, AI
- **Charter/Choice** - charter schools, vouchers, private school access
- **Student Services** - special education, attendance, truancy, health
- **Governance** - board operations, committees, reporting deadlines
- **Immigration** - enrollment eligibility, documentation requirements
- **Other**

Rate district impact as:
- **High** - Directly affects district operations, budget, or compliance
- **Medium** - May require policy changes or has indirect effects
- **Low** - Minimal direct impact
- **Watch** - Caption bill or broad scope; could evolve

### Step 4: Generate Tracking Spreadsheet
Create an Excel file using `openpyxl` with these sheets:

**Sheet 1: "Bill Tracker"** (main tracking sheet)
Columns: Bill #, Companion, Short Title, Sponsor, Category, District Impact, House Status, Senate Status, Last Action, Last Action Date, Next Hearing, Caption Bill, Amendments (count/status summary), Fiscal Impact, Key Votes, Notes

Format:
- Header row: bold, dark blue fill (#1F3864), white text, frozen panes
- Auto-filter on all columns
- Color-code District Impact: High=red fill (#FFC7CE), Medium=yellow (#FFE699), Low=green (#C6EFCE)
- Column widths sized appropriately
- Thin borders on all cells

**Sheet 2: "By Category"**
- Pivot-style summary: category, bill count, high-impact bills, all bills

**Sheet 3: "Timeline"**
- Bills sorted by next hearing/action date
- Color bands by day (blue, green, orange)
- Include votes and fiscal columns

**Sheet 4: "Full Details"**
- All fields including amendment summaries, full bill summary, and district notes
- Word-wrapped cells for long text
- Amendment column should list each amendment on a separate line: number, sponsor, status, and one-line description

**Sheet 5: "Amendments"**
- Dedicated sheet for amendment detail across all bills
- Columns: Bill #, Amendment #, Sponsor, Description, Status (filed/adopted/failed/withdrawn/tabled), Vote (Ayes-Nays-PNV), Date, District Impact Flag, Notes
- Header row: bold, dark blue fill (#1F3864), white text, frozen panes
- Color-code Status: Adopted=green (#C6EFCE), Failed=red (#FFC7CE), Filed/Pending=yellow (#FFE699), Withdrawn/Tabled=gray (#D9D9D9)
- Sort by Bill # then Amendment #
- Flag amendments that change district impact with a "Yes" in the District Impact Flag column and bold the row

**Sheet 6: "Vote Detail"**
- Bills sorted by impact, with vote breakdown and fiscal impact
- Highlight rows with close votes (margins < 5) in red

### Step 5: Save and Report
- Save to: `$ONEDRIVE_WORK/Legislative/Bill Tracker/Bill Tracker - {date_range}.xlsx`
- Also save a backup copy to a secondary location
- Print summary to console: total bills, impact breakdown, notable fiscal notes, close votes, high-impact bill list, bills with adopted amendments (highlighting any that changed district impact)

### Step 6: Generate HTML Email Summary
After every update (initial or update mode), generate a polished HTML email summary.

**HTML email design:**
Use inline CSS (email clients strip `<style>` blocks). Structure:

1. **Header bar** - navy gradient (#1a365d to #2c5282), white text. Title: "Legislative Tracker Update". Subtitle: date and district name.

2. **Stats bar** - light blue (#ebf8ff) row with 4 cells: Bills Tracked, Amendments, Status Changes, Now Law (enacted count). Use `<table>` layout (flexbox doesn't work in Outlook).

3. **Status Changes section** - each bill in a rounded card with a colored left border and status badge:
   - Signed into Law: green badge (#c6f6d5), green border
   - Transmitted to Governor: yellow badge (#fefcbf), yellow border
   - Passed Chamber: blue badge (#bee3f8), blue border
   - Stalled: red badge (#fed7d7), red border
   - Advanced: purple badge (#e9d8fd), purple border
   - Each card shows: badge, bill number (bold), short title, detail line (vote count, next step)

4. **Amendments section** - light gray rounded cards with bill number bold, amendment number, action (adopted/failed/withdrawn), vote count, and brief description.

5. **Upcoming Hearings section** - grouped by date (bold date header), each hearing as a bullet with bill number bold, short title, and committee/floor. Tag high-impact hearings with a red "HIGH IMPACT" badge.

6. **High-Impact Bills to Watch** - cards with yellow background (#fffbeb) and yellow border. Bills with fiscal notes > $50M get red background (#fef2f2) and red border. Show fiscal note amount in a small bold line. Detail line with context.

7. **Enacted/Awaiting Governor** - green box for enacted bills, yellow box for awaiting governor. One line each.

8. **Footer** - light gray bar with next recommended update date.

**Inline CSS notes for email compatibility:**
- Use `style=""` on every element (no `<style>` block, no classes)
- Fonts: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Keep max-width 680px, centered
- All colors as hex values

Send via your preferred email CLI or save as an HTML file for manual forwarding.

### Update Mode
When user says "update", "update the tracker", or "legislative update":
1. Find the most recent `Bill Tracker - *.xlsx` in the Legislative/Bill Tracker/ folder (sort by date in filename)
2. Read it with pandas to get the full bill list and current statuses
3. Identify bills with upcoming hearings, pending actions, or governor signatures since the last update date
4. Launch a research agent to check each bill's current status on wapp.capitol.tn.gov via web search
5. Use openpyxl to load the existing file, update changed fields, and set "Status Changed" = "Yes" for modified rows
6. Save as a NEW dated file in `Bill Tracker/`: `Bill Tracker - {Month} {Day} {Year} Update.xlsx` (never overwrite)
7. Update the Amendments sheet with any new or changed amendments
8. Print a summary grouped by: signed into law, passed floor, advanced in committee, amended (new amendments adopted), deferred, stalled/dead
9. Generate and send the HTML email per Step 6

### Fact-Check Mode
When user says "fact-check" or "verify" the tracker:
1. Read the current tracker
2. Launch 3 parallel verification agents (batches of ~13 bills each)
3. Each agent checks every bill against wapp.capitol.tn.gov for: vote counts, committee assignments, current status, hearing dates, fiscal notes, and amendments (new, adopted, or failed since last check)
4. Report discrepancies with specific details
5. Fix any confirmed errors in the spreadsheet
6. Categories: VERIFIED, DISCREPANCY (with fix), UNABLE TO VERIFY

### Next Run Recommendation
After any update, scan the "Next Hearing" column and recommend when to run again:
- Identify the next cluster of scheduled hearings/floor votes
- Suggest running the evening after major hearing days
- Flag high-impact bills (especially fiscal bills like TISA/funding) that warrant priority tracking

## Output Format
- Excel (.xlsx) via openpyxl. Never save plain text as .xlsx.
- HTML email summary after every update.

## File Location
- Primary: `$ONEDRIVE_WORK/Legislative/Bill Tracker/Bill Tracker - {date} Update.xlsx`
- Each update is a new file; never overwrite previous versions

## Dependencies
- WebFetch or WebSearch (for TN Legislature website lookups)
- Agent tool (for parallel research and fact-check verification)
- Puppeteer MCP (only if scraping State Affairs Pro for bill lists)
- Python 3 with openpyxl, pandas
