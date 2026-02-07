

# Add Contact Details to Cohort Student Rows (Nikist Organization)

## Confirmed: Organization-Scoped
The CohortPage uses `currentOrganization.id` for all queries, so these changes apply only to whichever organization is active (Nikist in your case). No cross-organization data leakage is possible.

## What Changes
Show student email and phone number in the cohort batches tables (Insider Crypto Club, Future Mentorship, Hi Future) so you can easily identify students -- especially when two have the same name.

## Where Contact Info Will Appear

### 1. Student Name Column (both desktop and mobile)
- Below the student name, display the email in light gray text
- Add a small copy icon next to it so you can quickly copy the email

### 2. Expanded Row (when you click to expand)
- Above the "EMI Payment History" heading, show both email and phone number
- Each will have a copy button for quick copying
- Displayed in a clean, compact layout

## No Logic Changes
- The email and phone data is already being fetched from the database -- it just is not displayed
- No queries, mutations, or business logic will be modified
- Only the rendering/display portion of the page changes

---

## Technical Details

### File to Modify
`src/pages/CohortPage.tsx`

### Import Addition
Add `Copy` icon from `lucide-react` and a small inline copy-to-clipboard handler using `navigator.clipboard`.

### Change 1: Desktop Student Name Cell
Currently shows only the student name + PAE badge. Will add a second line below the name with the email and a copy button.

### Change 2: Desktop Expanded Row
Add contact info block (email + phone, each with copy buttons) directly above the "EMI Payment History" heading.

### Change 3: Mobile Student Card
Add email below student name in the mobile card view, same pattern as desktop.

### Change 4: Mobile Expanded Section
Add contact details above "EMI Payment History" heading in the mobile expanded view.

### Helper Function
Add a simple `copyToClipboard` function:
```
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast({ title: "Copied", description: text, duration: 1500 });
};
```

