"""One-off patch: fix TN ECI 9-card grid so each card gets its own X slice."""
import re

import os
path = os.path.join(os.path.dirname(__file__), "..", "services", "electoral_roll_pdf_extractor.py")
path = os.path.abspath(path)
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1) Replace 3-column logic with 9-column + col_bounds (match exact unicode from file)
old_three = """    if len(epic_words) < 3:
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
            ]"""

new_nine = """    if len(epic_words) < 1:
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
            ]"""

if old_three not in content:
    print("Block not found (check unicode/emoji)")
    raise SystemExit(1)

content = content.replace(old_three, new_nine)
# Write to temp file then replace (avoids IDE lock on original)
import tempfile
dir_name = os.path.dirname(path)
fd, tmp = tempfile.mkstemp(suffix=".py", dir=dir_name, text=True)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp, path)
    print("Patched successfully.")
except Exception as e:
    os.unlink(tmp)
    raise e
