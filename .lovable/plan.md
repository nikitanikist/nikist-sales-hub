

# Add Contact Details to Cohort Student Rows

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
- The email and phone data is already being fetched from the database -- it just isn't displayed
- No queries, mutations, or business logic will be modified
- Only the rendering/display portion of the page changes

---

## Technical Details

### File to Modify
`src/pages/CohortPage.tsx`

### Import Addition
Add `Copy` icon from `lucide-react` and a small inline copy-to-clipboard handler using `navigator.clipboard`.

### Change 1: Desktop Student Name Cell (around line 1481)
Currently shows only the student name + PAE badge. Will add a second line below the name:
```tsx
<TableCell className="font-medium">
  <div className="flex items-center gap-2">
    {student.contact_name}
    {/* ...existing PAE badge and notes icon... */}
  </div>
  {/* NEW: Email subtitle with copy */}
  {student.email && (
    <div className="flex items-center gap-1 mt-0.5">
      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
        {student.email}
      </span>
      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(student.email); }}>
        <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  )}
</TableCell>
```

### Change 2: Desktop Expanded Row (around line 1555)
Add contact info block above "EMI Payment History":
```tsx
<div className="pl-8">
  {/* NEW: Contact details */}
  <div className="flex flex-wrap gap-4 mb-3 text-sm text-muted-foreground">
    {student.email && (
      <div className="flex items-center gap-1">
        <span>Email: {student.email}</span>
        <button onClick={() => copyToClipboard(student.email)}>
          <Copy className="h-3.5 w-3.5 hover:text-foreground" />
        </button>
      </div>
    )}
    {student.phone && (
      <div className="flex items-center gap-1">
        <span>Phone: {student.phone}</span>
        <button onClick={() => copyToClipboard(student.phone)}>
          <Copy className="h-3.5 w-3.5 hover:text-foreground" />
        </button>
      </div>
    )}
  </div>
  <h4 className="font-medium mb-3">EMI Payment History</h4>
  {/* ...existing EMI table... */}
</div>
```

### Change 3: Mobile Student Card (around line 1626)
Add email below student name, same pattern as desktop.

### Change 4: Mobile Expanded Section (around line 1715)
Add contact details above "EMI Payment History" heading in the mobile expanded view.

### Helper Function
Add a simple `copyToClipboard` function that copies text and shows a toast confirmation:
```tsx
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast({ title: "Copied", description: text, duration: 1500 });
};
```
