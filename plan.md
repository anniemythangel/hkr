# Objective: Modify styles.css to fix the critical layout overflow.

## Plan

### Step 1: Make the main page container a flexible column.
- **File:** `styles.css`
- **Selector:** `.page`
- **Action:** Add the following properties:
  ```css
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 4rem); /* Full viewport height minus vertical padding */
  ```

### Step 2: Make the main table area flexible so it can grow and shrink.
- **File:** `styles.css`
- **Selector:** `.felt-bg`
- **Action:** Add the following property:
  ```css
  flex: 1;
  ```

### Step 3: Drastically reduce the table's minimum height.
- **File:** `styles.css`
- **Selector:** `.table-ring`
- **Action:** Replace `min-height: clamp(600px, 70vh, 800px);` with `min-height: clamp(400px, 60vh, 700px);`.

### Step 4: Reduce the minimum width of the side column in the top grid.
- **File:** `styles.css`
- **Selector:** `.page-top-grid`
- **Action:** Replace `grid-template-columns: minmax(0, 2fr) minmax(340px, 1fr);` with `grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);`.

### Step 5: Reduce the minimum width of the side column in the top grid (media query).
- **File:** `styles.css`
- **Selector:** `.page-top-grid` inside `@media (max-width: 1200px)`
- **Action:** Replace `grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);` with `grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr);`.

## Progress
- [x] All steps completed.

### Step 6: Remove the rigid min-height from the table ring.
- **File:** `styles.css`
- **Selector:** `.table-ring`
- **Action:** Remove `min-height: clamp(400px, 60vh, 700px);`.
- **Status:** [x] Completed