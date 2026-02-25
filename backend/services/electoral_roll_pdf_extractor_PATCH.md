# Backend fix: same record repeated (TN ECI 9 cards per row)

**Problem:** Extraction was using **3 columns** and `abs(w[0] - epic_word[0]) < 200` so words from multiple cards in the same third of the page were mixed; the parser then often produced the same (first) card’s data for every slot.

**Fix:** Use **9 columns** (9 cards per row) with explicit X bounds per column so each card gets only words in its own vertical strip.

---

## File: `backend/services/electoral_roll_pdf_extractor.py`

### 1. Replace the block that starts at “if len(epic_words) < 3” and ends at “block_words = […]” (including the loop)

**Find** (starts around line 568):

```python
    if len(epic_words) < 3:
        return []

    # -----------------------------------------
    # 2️⃣ Split into 3 columns using X position
    # -----------------------------------------
    page_width = float(getattr(page, "width", 612))
    col1 = []
    col2 = []
    col3 = []

    for w in epic_words:
        x = w[0]
        if x < page_width / 3:
            col1.append(w)
        elif x < 2 * page_width / 3:
            col2.append(w)
        else:
            col3.append(w)

    columns = [col1, col2, col3]

    # -----------------------------------------
    # 3️⃣ Process each column independently
    # -----------------------------------------
    for column in columns:
        column = sorted(column, key=lambda w: w[1])

        for i, epic_word in enumerate(column):
            epic_text = epic_word[2].upper()
            top_y = epic_word[1]

            if i + 1 < len(column):
                bottom_y = column[i + 1][1]
            else:
                bottom_y = top_y + 160

            # Extract words only from THIS column range (vertical slice + same column by X)
            block_words = [
                w for w in words_sorted
                if top_y <= w[1] < bottom_y
                and abs(w[0] - epic_word[0]) < 200
            ]
```

**Replace with:**

```python
    if len(epic_words) < 1:
        return []

    # -----------------------------------------
    # 2️⃣ Build 9 column bounds (TN ECI: 3 sections × 3 cards = 9 per row)
    # -----------------------------------------
    page_width = float(getattr(page, "width", 612))
    margin_left = float(EXTRACTION_CONFIG_DEFAULTS.get("margin_left", 20))
    margin_right = float(EXTRACTION_CONFIG_DEFAULTS.get("margin_right", 20))
    usable_width = page_width - margin_left - margin_right
    cards_per_row = 9
    card_width = usable_width / cards_per_row

    col_bounds = [
        (margin_left + c * card_width, margin_left + (c + 1) * card_width)
        for c in range(cards_per_row)
    ]

    def _col_idx(x):
        for c, (left, right) in enumerate(col_bounds):
            if left <= x < right:
                return c
        if x < margin_left:
            return 0
        if x >= page_width - margin_right:
            return cards_per_row - 1
        return min(int((x - margin_left) / card_width), cards_per_row - 1)

    columns = [[] for _ in range(cards_per_row)]
    for w in epic_words:
        columns[_col_idx(w[0])].append(w)
    for c in range(cards_per_row):
        columns[c] = sorted(columns[c], key=lambda w: w[1])

    # -----------------------------------------
    # 3️⃣ Process each column — words restricted to that column's X bounds
    # -----------------------------------------
    for col_idx, column in enumerate(columns):
        col_left, col_right = col_bounds[col_idx]
        column = sorted(column, key=lambda w: w[1])

        for i, epic_word in enumerate(column):
            top_y = epic_word[1]

            if i + 1 < len(column):
                bottom_y = column[i + 1][1]
            else:
                bottom_y = top_y + 160

            # Strict X bounds: only words inside THIS card's column (no spill from adjacent cards)
            block_words = [
                w for w in words_sorted
                if top_y <= w[1] < bottom_y
                and col_left <= w[0] < col_right
            ]
```

### 2. Optional: update the docstring of `_extract_cards_tn_eci_perfect`

**Find:**

```python
    """
    Column-aware TN ECI extraction: 3 columns per page. Split EPICs by X,
    then slice vertically inside each column so cards never mix across columns.
    """
```

**Replace with:**

```python
    """
    Column-aware TN ECI extraction: 9 cards per row. Use explicit X bounds per
    card so each crop is a distinct column slice (avoids repeating same card).
    """
```

---

After applying:

- Each card is assigned to one of 9 columns by X (`col_bounds`).
- `block_words` uses `col_left <= w[0] < col_right` so only words in that card’s strip are used → no mixing and no repeated “first card” record.

If your PDF has different margins, adjust `margin_left` / `margin_right` in `EXTRACTION_CONFIG_DEFAULTS` (or pass them via `extraction_config` if the API supports it).
