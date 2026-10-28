# Job Sources

Reference list of where the agents should look. Not exhaustive — agents should adapt to the candidate's profile.

## General aggregators (job-board-searcher)

- **Indeed** — `indeed.com/jobs?q=<title>&l=<city>` — broadest coverage, often republishes stale listings (verify freshness).
- **Glassdoor** — `glassdoor.com/Job/jobs.htm?sc.keyword=<title>&locT=C&locId=<id>` — has salary data.
- **Wellfound (formerly AngelList Talent)** — `wellfound.com/jobs` — startup-heavy.
- **ZipRecruiter** — `ziprecruiter.com/jobs/search?search=<title>&location=<city>` — high noise, useful for breadth.
- **LinkedIn (public search-result pages only, no auth)** — `linkedin.com/jobs/search?keywords=<title>&location=<city>` — surface for visibility, click-through to ATS for verification.
- **SimplyHired** — `simplyhired.com/search?q=<title>&l=<city>`.

## ATS-direct (company-targeter)

When you've identified a target employer, check their career page directly. Most use one of these platforms — try the ATS URL pattern first (faster, more accurate, salary often disclosed):

- **Greenhouse** — `boards.greenhouse.io/<company>` or `<company>.greenhouse.io`
- **Lever** — `jobs.lever.co/<company>`
- **Ashby** — `jobs.ashbyhq.com/<company>`
- **Workable** — `apply.workable.com/<company>`
- **SmartRecruiters** — `jobs.smartrecruiters.com/<company>`
- **iCIMS** — `careers-<company>.icims.com`
- **Workday** — `<company>.wd1.myworkdayjobs.com` (varies by region/instance)
- **BambooHR** — `<company>.bamboohr.com/careers`
- **Recruitee** — `<company>.recruitee.com`

If the ATS isn't obvious, the employer's `/careers` page usually links to it.

## Remote-first boards (remote-specialist)

- **RemoteOK** — `remoteok.com/remote-<title>-jobs`
- **We Work Remotely** — `weworkremotely.com/categories/<category>`
- **Working Nomads** — `workingnomads.com/jobs?category=<category>`
- **Himalayas** — `himalayas.app/jobs?category=<category>`
- **Remotive** — `remotive.com/remote-jobs/<category>`
- **JustRemote** — `justremote.co/remote-<category>-jobs`
- **Outsourcely** — `outsourcely.com` (smaller, often longer-term contract).
- **NoDesk** — `nodesk.co/remote-jobs/`

## Sector-specific (company-targeter expands these per candidate)

### Nonprofit / mission-driven
- **Idealist** — `idealist.org/en/jobs`
- **Bridgespan** — `bridgespan.org/career-center/job-listings`
- **CharityVillage** (Canada-leaning)
- Foundation Center / Candid — for foundation-side roles.

### Higher education
- **HigherEdJobs** — `higheredjobs.com`
- **Chronicle Vitae** — `chroniclevitae.com/job_search`
- **Inside Higher Ed Jobs** — `careers.insidehighered.com`

### Government / civic
- **USAJobs** — `usajobs.gov` (federal)
- **GovernmentJobs.com** — state/local
- State and city career pages directly.

### Economic development / community development
- **IEDC** — `iedconline.org/web-pages/career-center/`
- **NACo** — `naco.org/careers`
- State and regional EDO career pages (e.g., West Virginia Department of Economic Development).
- LISC, Enterprise Community Partners, NeighborWorks America (community-development intermediaries).

### Grants and advocacy
- **Grant Professionals Association** job board.
- **Council on Foundations** career center.
- **PND Philanthropy News Digest** job board.

### Tech / data / AI
- **YC Work at a Startup** — `workatastartup.com`
- **Hacker News "Who is hiring"** monthly threads.
- AI-lab career pages directly (Anthropic, OpenAI, Google DeepMind, etc.) — use Greenhouse/Ashby endpoints.

### Education K-12
- **K12JobSpot** — `k12jobspot.com` (national)
- State-specific boards (e.g., **TeachTN** at `teachtn.org` for Tennessee). Most states have an equivalent.

## Salary-intel sources (salary-intel agent)

- **BLS Occupational Employment and Wage Statistics** — `bls.gov/oes` — national + metro p25/p50/p75 by SOC code. Authoritative, but lags 12-18 months.
- **Glassdoor salary pages** — current self-reports, noisy but recent.
- **Levels.fyi** — tech roles only, very accurate for FAANG-tier comp.
- **Payscale** — broad but requires careful interpretation.
- **Comparably** — newer, decent for mid-market.
- **Robert Half / Aon / Mercer salary guides** — annual PDFs published online, useful for finance/professional services.
- For nonprofit specifically: **Candid Compensation Reports**, **GuideStar 990 filings** (top officer comp is public).

## What NOT to use

- Job aggregators that obviously SEO-spam (you'll know them by the URL pattern and the "5,000 jobs in your area!" framing). They republish the same listings 20x.
- Telegram/Discord job channels — can't verify provenance.
- "Get hired in 24 hours!" sites — usually MLM or fee-for-service scams. Flag them and exclude.
