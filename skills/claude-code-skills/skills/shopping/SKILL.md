---
name: shopping
description: Personal shopping assistant with size/brand memory. Searches retailers, compares prices, and ranks results.
argument-hint: "<query | profile | profile set <key> <value> | profile setup>"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob, Grep
---

Personal shopping assistant that searches retailers, compares prices/ratings, and remembers your sizes, brand preferences, and style profile.

Arguments: $ARGUMENTS

## Step 1: Route by Mode

Parse `$ARGUMENTS` to determine the mode:

- If arguments start with `profile setup` → **Profile Setup mode** (Step 8)
- If arguments start with `profile set` → **Profile Edit mode** (Step 9)
- If arguments equal `profile` → **Profile View mode** (Step 7)
- Otherwise → **Search mode** (Step 2)

## Step 2: Load Profile

Read the profile from `~/.claude/skills/shopping/profile.json`.

- If the file does not exist or is empty, create it with the default template (empty strings, empty arrays, null budgets) and note to the user: "No shopping profile found. I'll search without size/brand constraints. Run `/shopping profile setup` to configure your preferences."
- Parse the JSON and hold it in memory for the rest of the workflow.

## Step 3: Detect Product Category

Analyze the search query keywords to determine the category. This controls whether sizes get injected into search queries.

**Clothing categories** (inject sizes from profile):
- **Pants/Chinos/Jeans**: keywords like pants, chinos, jeans, trousers, shorts → use `sizes.pants_waist` and `sizes.pants_inseam`
- **Shirts/Tops**: keywords like shirt, polo, tee, t-shirt, henley, sweater, hoodie, pullover → use `sizes.shirt`
- **Dress Shirts**: keywords like dress shirt, button-down, oxford → use `sizes.dress_shirt_neck` and `sizes.dress_shirt_sleeve`
- **Outerwear**: keywords like jacket, coat, vest, parka, fleece → use `sizes.shirt` (outerwear typically follows shirt sizing)
- **Shoes/Boots**: keywords like shoes, boots, sneakers, loafers, sandals → use `sizes.shoe`
- **Suits/Formal**: keywords like suit, blazer, sport coat → use `sizes.suit_jacket`
- **Accessories**: keywords like belt, hat, watch, sunglasses, tie, wallet → no sizes needed

**Non-clothing categories** (no sizes):
- **Electronics**: keywords like headphones, earbuds, speaker, laptop, tablet, phone, charger, cable
- **Home/Office**: keywords like desk, chair, lamp, organizer, bag, backpack
- **General**: anything that doesn't match above

Only inject sizes that are populated in the profile. If a relevant size field is empty, search without it and note the gap in the results.

## Step 4: Extract Price Constraint

Check the query for price language:
- "under $60", "below $60", "less than $60", "max $60", "up to $60" → max price = 60
- "$30-$60", "$30 to $60" → price range
- No price mentioned → check profile budget for the detected category:
  - Clothing → `budget.clothing_max`
  - Shoes → `budget.shoes_max`
  - Electronics → `budget.electronics_max`
  - Other → `budget.default_max`
- If no price from query or profile, search without price constraint.

Query price ALWAYS overrides profile budget.

## Step 5: Build and Execute Search Queries

Build 3-4 search queries that combine the user's search terms with profile context. Examples for "navy chinos under $60" with profile sizes 34x32 and preferred retailer J.Crew:

1. `navy chinos 34x32 under $60` (core query with size)
2. `navy chinos men's 34 waist under $60 buy` (alternate phrasing)
3. `site:jcrew.com navy chinos` (preferred retailer query, only if retailers.preferred is populated)
4. `best navy chinos men's 2026 reviews under $60` (review-focused query)

If no sizes are relevant (non-clothing or empty profile), omit size terms. If no preferred retailers, use query slot 3 for another general search variation.

Execute all search queries in parallel using WebSearch. Collect the top 5 URLs from each search result.

## Step 6: Fetch and Extract Product Data

1. **Deduplicate URLs** across all search results. Remove any URLs from `retailers.avoid` domains.
2. **Select top 10-12 unique product page URLs** (prioritize URLs from `retailers.preferred` domains).
3. **WebFetch each URL** in batches of 4-5 at a time. Use this extraction prompt for each fetch:

   > Extract the following product information from this page. Return ONLY a JSON object, nothing else:
   > {"name": "product name", "price": current price as number, "original_price": original/list price as number or null if not on sale, "rating": star rating as number or null, "review_count": number of reviews or null, "sizes_available": ["list of available sizes"] or null, "retailer": "store name", "url": "product page URL", "brand": "brand name", "in_stock": true/false}

4. **Handle failures gracefully**: if a WebFetch fails or returns unparseable data, skip that URL and continue with remaining results. Do not retry failed fetches.

## Step 7: Filter, Rank, and Display Results

### Filter
Remove results that match any of these criteria:
- Price exceeds the max price constraint (if one exists)
- Retailer is in `retailers.avoid`
- Brand is in `brands.avoid`
- If a clothing category with a populated size: remove items where `sizes_available` exists and does NOT include the user's size (keep items where sizes_available is null, as the data may just be missing)

### Rank
Score each remaining result using this composite scoring:
- **Preferred retailer**: +2 points if retailer matches any in `retailers.preferred`
- **Preferred brand**: +1 point if brand matches any in `brands.preferred`
- **Rating score**: `(rating / 5) * 5` points (0-5 scale, null rating = 2.5)
- **Price competitiveness**: compare to the median price of all results. If below median: +2, if at median: +1, if above: +0
- **Review volume**: if review_count > 100: +1, else +0.5, null = +0

Sort by total score descending.

### Display

Present the top 8 results as a markdown table:

```
## Shopping Results: [original query]

| # | Product | Price | Rating | Retailer | Link |
|---|---------|-------|--------|----------|------|
| 1 | [Product Name] | $49.50 | 4.3/5 (287) | RetailerName | [view](url) |
| 2 | [Product Name] | $39.99 ~~$59.99~~ | 4.1/5 (142) | RetailerName | [view](url) |
```

Price formatting:
- Regular price: `$49.50`
- Sale price: `$39.99 ~~$59.99~~`
- If no price extracted: `check link`

Below the table, display a context line:
```
Sizes: 34x32 (from profile) | Budget: Under $60 (from query) | Category: Pants
```

If any relevant profile sizes were empty, add:
```
Note: No [size type] in your profile. Run /shopping profile set sizes.[field] [value] to add it.
```

### Follow-up Suggestions

After the results, suggest:
- "Want details on a specific item? Tell me the number."
- "Refine: try `/shopping [adjusted query]`"
- "Save preferences: `/shopping profile set brands.preferred +BrandName`"

## Step 7 (Profile View): Display Profile

Read `~/.claude/skills/shopping/profile.json` and display it as formatted tables:

```
## Shopping Profile

### Sizes
| Item | Size |
|------|------|
| Shirt | XL |
| Pants | 34W x 32L |
| Shoe | 11 |
| ... | ... |

### Brand Preferences
Preferred: Patagonia, J.Crew, Nike
Avoid: (none)

### Style
Fit: Slim | Formality: Business casual | Colors: navy, gray, olive

### Budget Defaults
| Category | Max |
|----------|-----|
| Clothing | $75 |
| Shoes | $120 |
| Electronics | $100 |
| Default | $75 |

### Retailer Preferences
Preferred: Amazon, J.Crew, REI
Avoid: Shein, Temu
```

Only display populated fields. For empty fields, show "(not set)" and suggest the set command.

## Step 8 (Profile Setup): Interactive Wizard

Walk through each section of the profile interactively. For each section, ask the user for their preferences and update the profile.

Order:
1. **Sizes**: Ask for each size field one section at a time. Group related sizes:
   - "What are your casual shirt/top sizes?" (shirt)
   - "Pants: waist and inseam?" (pants_waist, pants_inseam)
   - "Dress shirt: neck and sleeve?" (dress_shirt_neck, dress_shirt_sleeve)
   - "Suit jacket size?" (suit_jacket)
   - "Shoe size?" (shoe)
2. **Brands**: "Any brands you love? Any to avoid?"
3. **Style**: "How would you describe your fit preference (slim, regular, relaxed)? Formality (casual, business casual, formal)? Favorite colors?"
4. **Budget**: "Default max budget per item? Any category-specific limits (clothing, shoes, electronics)?"
5. **Retailers**: "Preferred retailers? Any to avoid?"

After each section, update `profile.json` immediately so progress is saved even if the conversation is interrupted. Use Read to load the current state, update the relevant section, and Write the file back.

At the end, display the full profile (Step 7 format) and confirm everything looks right.

## Step 9 (Profile Edit): Dot-Notation Updates

Parse `$ARGUMENTS` after "profile set" to extract the key path and value.

Format: `profile set <dot.path> <value>`

Examples:
- `profile set sizes.shirt XL` → set sizes.shirt to "XL"
- `profile set pants_waist 34` → set sizes.pants_waist to "34"
- `profile set brands.preferred +Patagonia` → append "Patagonia" to brands.preferred array
- `profile set brands.preferred -Gap` → remove "Gap" from brands.preferred array
- `profile set brands.avoid +Shein` → append "Shein" to brands.avoid array
- `profile set budget.default_max 75` → set budget.default_max to 75 (as number)
- `profile set style.colors +olive` → append "olive" to style.colors array
- `profile set retailers.preferred +Amazon,+REI` → append both to retailers.preferred

Rules:
- `+value` appends to arrays (do not duplicate if already present)
- `-value` removes from arrays
- Plain value sets the field directly
- Numeric-looking values for budget fields should be stored as numbers, not strings
- If the dot path doesn't match a known field, warn the user and show valid paths

After updating, read the file, apply the change, write it back, and display the updated section to confirm.

## Rules

- Always load the profile before searching. Never skip profile loading.
- Query price constraints always override profile budget defaults.
- Never fabricate product data. Every result must come from an actual WebSearch + WebFetch.
- If WebFetch returns no usable product data from a URL, skip it silently.
- If fewer than 3 results survive filtering, note this and suggest broadening the search or raising the budget.
- Display sale prices with strikethrough on the original: `$39.99 ~~$59.99~~`
- Keep the results table clean. Truncate long product names to ~50 chars.
- For profile edits, always read-modify-write the JSON file (never overwrite from memory alone).
- Profile file location: `~/.claude/skills/shopping/profile.json`
