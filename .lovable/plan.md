

# Mobile Optimization: Workshop Notification Page

## Problem Summary

The Workshop Notification page (`/operations/workshop-notification`) has poor mobile UX:
1. **The workshops table is not mobile-friendly** - It shows 6 columns that don't fit on mobile screens
2. **The "Run Sequence" sheet is cluttered** - The WorkshopDetailSheet is cramped on small devices
3. **The tab navigation is cramped** - The 4-tab layout is tight on mobile
4. **Status badges and action buttons are crowded** in table rows
5. **No card view alternative** for mobile like other pages in the app have

Based on the memory context, the CRM has an established pattern for mobile optimization:
- **Hybrid table/card pattern**: Tables on desktop, cards on mobile (visible in `Calls.tsx` lines 480-580)
- **Responsive breakpoints**: Using `hidden sm:block` and `sm:hidden` for view switching
- **Touch-optimized interactions**: Larger tap targets on mobile
- **MobileCardSkeleton**: Dedicated loading skeleton for mobile card views

---

## Files to Modify

| File | Purpose |
|------|---------|
| `src/components/operations/notification-channels/WhatsAppGroupTab.tsx` | Add mobile card view alongside table |
| `src/components/operations/WorkshopDetailSheet.tsx` | Optimize sheet layout for mobile |
| `src/components/operations/MessagingActions.tsx` | Simplify mobile footer actions |
| `src/components/operations/MessageCheckpoints.tsx` | Optimize checkpoint list for mobile |
| `src/pages/operations/WorkshopNotification.tsx` | Improve tab navigation for mobile |

---

## Implementation Details

### 1. WorkshopNotification.tsx - Tab Navigation Improvement

**Current Issue**: 4 tabs cramped on mobile with icons + text.

**Solution**: 
- Use icons only on mobile, full text on larger screens
- Increase tap target size
- Add scroll hint if needed

```typescript
// Updated TabsList for better mobile display
<TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid h-auto gap-1">
  <TabsTrigger value="whatsapp-group" className="gap-1.5 py-3 px-2 sm:px-3 flex-col sm:flex-row">
    <Users className="h-4 w-4" />
    <span className="text-[10px] sm:text-sm">Groups</span>
  </TabsTrigger>
  // ... similar for other tabs
</TabsList>
```

### 2. WhatsAppGroupTab.tsx - Add Mobile Card View

**Current Issue**: Table with 6 columns doesn't fit on mobile.

**Solution**: Implement the hybrid pattern used in `Calls.tsx`:

```text
+--------------------------------------------------+
|  DESKTOP (hidden on mobile)                      |
|  +----------------------------------------------+
|  | Date | Name | Tag | Regs | Status | Actions |
|  +----------------------------------------------+
+--------------------------------------------------+

+--------------------------------------------------+
|  MOBILE (visible on mobile only)                 |
|  +----------------------------------------------+
|  | [Workshop Card]                              |
|  |   Workshop Title                    [Badge]  |
|  |   Mon, Jan 15 · 2:00 PM                     |
|  |   [Tag Badge] · 45 registrations            |
|  |                                              |
|  |   [Setup] [Run] [View]                      |
|  +----------------------------------------------+
+--------------------------------------------------+
```

**Code structure**:
```typescript
// Loading state with proper skeleton
{workshopsLoading ? (
  <>
    <div className="hidden sm:block">
      <TableSkeleton columns={6} rows={5} />
    </div>
    <div className="sm:hidden">
      <MobileCardSkeleton count={3} />
    </div>
  </>
) : (
  <>
    {/* Desktop Table View */}
    <div className="hidden sm:block border rounded-lg overflow-hidden">
      <Table>...</Table>
    </div>
    
    {/* Mobile Card View */}
    <div className="sm:hidden space-y-3">
      {filteredWorkshops.map((workshop) => (
        <MobileWorkshopCard 
          workshop={workshop}
          onView={handleViewWorkshop}
          onRun={handleRunSequence}
          ... 
        />
      ))}
    </div>
  </>
)}
```

**Mobile Card Component** (inline in WhatsAppGroupTab.tsx):
```typescript
function MobileWorkshopCard({ workshop, orgTimezone, onView, onRun, ... }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium line-clamp-2">{workshop.title}</h4>
          <p className="text-sm text-muted-foreground">
            {formatInOrgTime(workshop.start_date, orgTimezone, 'EEE, MMM d · h:mm a')}
          </p>
        </div>
        {getStatusBadge(workshop)}
      </div>
      
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {workshop.tag && <WorkshopTagBadge name={workshop.tag.name} color={workshop.tag.color} />}
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {workshop.registrations_count || 0}
        </span>
      </div>
      
      <div className="flex items-center gap-2 pt-1">
        <SequenceProgressButton ... className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => onView(workshop)}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setWorkshopToDelete(workshop)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
```

### 3. WorkshopDetailSheet.tsx - Mobile Optimization

**Current Issues**:
- Fixed width `sm:max-w-lg` might be too narrow on larger phones
- Footer with MessagingActions can be cramped
- Sections are collapsible but could be tighter on mobile

**Solutions**:

A. **Full-width sheet on mobile**:
```typescript
<SheetContent className="sm:max-w-lg w-full flex flex-col p-0">
```

B. **Optimize footer spacing**:
```typescript
<SheetFooter className="border-t bg-background px-4 sm:px-6 py-3 sm:py-4 mt-auto">
```

C. **Reduce padding in overview grid**:
```typescript
<div className="grid grid-cols-2 gap-2 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
```

D. **More compact collapsible sections on mobile**:
```typescript
// CollapsibleSection.tsx - reduce padding on mobile
<div className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-muted/50">
```

### 4. MessagingActions.tsx - Mobile-Friendly Footer

**Current Issue**: Two full-width buttons stacked vertically take up too much space.

**Solution**: Stack layout with reduced spacing on mobile:

```typescript
<div className="space-y-3 sm:space-y-4">
  <h3 className="text-sm font-medium hidden sm:block">Messaging Actions</h3>
  
  {/* Run Sequence */}
  <div className="space-y-1.5 sm:space-y-2">
    {renderSequenceButton()}
    <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
      {getSequenceHelperText()}
    </p>
  </div>

  <Separator className="hidden sm:block" />

  {/* Send Now - smaller on mobile */}
  <div className="space-y-1.5 sm:space-y-2">
    <Button
      onClick={onSendNow}
      disabled={!canSendNow}
      variant="outline"
      className="w-full gap-2"
      size="default"  // Changed from "lg"
    >
      ...
    </Button>
    <p className="text-[11px] sm:text-xs text-muted-foreground text-center hidden sm:block">
      {getSendNowDisabledReason() || 'Send a single message immediately'}
    </p>
  </div>
</div>
```

### 5. MessageCheckpoints.tsx - Compact Mobile View

**Current Issue**: Checkpoints list with time, label, status, and cancel button is cramped.

**Solution**: More compact layout on mobile:

```typescript
<div
  key={checkpoint.id}
  className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg hover:bg-muted/50"
>
  <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0", ...)} />
  
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-xs sm:text-sm font-medium">{checkpoint.time}</span>
      <span className="text-xs sm:text-sm text-muted-foreground truncate">
        {checkpoint.label}
      </span>
    </div>
    ...
  </div>
  
  {/* Status badge and cancel - stack on mobile if needed */}
  <div className="flex items-center gap-1 sm:gap-2">
    <span className={cn("text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full", ...)}>
      {config.label}
    </span>
    {canCancel && (
      <Button size="icon" className="h-5 w-5 sm:h-6 sm:w-6">
        <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>
    )}
  </div>
</div>
```

### 6. TodaysWorkshopCard.tsx - Already Optimized

The Today's Workshop hero card is already reasonably mobile-friendly with responsive flex/grid layouts. Minor improvements:
- Add `px-1` to prevent edge clipping
- Ensure buttons have adequate touch targets

### 7. MultiGroupSelect.tsx - Mobile Improvements

In the WorkshopDetailSheet, the group selection area could be more compact:
- Reduce ScrollArea height on mobile: `h-[180px] sm:h-[220px]`
- Smaller padding in group items

---

## Visual Comparison

**Before (Mobile)**:
```text
| Date | Name | Tag | Regs | Status | Actions |
(Table doesn't fit, horizontal scroll required)
```

**After (Mobile)**:
```text
+----------------------------------------+
| Workshop: Marketing Webinar            |
| Mon, Jan 15 · 2:00 PM                 |
| [Marketing Tag] · 45 regs    [Ready]  |
| [Run Sequence]  [Eye] [Trash]          |
+----------------------------------------+
```

---

## Testing Checklist

After implementation, verify:
- [ ] Workshops display as cards on mobile (< 640px)
- [ ] Workshops display as table on tablet/desktop (>= 640px)
- [ ] Tab navigation is usable on small phones
- [ ] WorkshopDetailSheet scrolls properly and footer is accessible
- [ ] Run Sequence button is easy to tap
- [ ] Message checkpoints are readable
- [ ] All action buttons have adequate touch targets (min 44x44px)
- [ ] Loading skeletons match the view (card vs table)

---

## Technical Notes

- The breakpoint `sm:` corresponds to 640px (Tailwind default)
- Use `hidden sm:block` for desktop-only elements
- Use `sm:hidden` for mobile-only elements
- Follow the pattern established in `src/pages/Calls.tsx` (lines 480-580)
- Import `MobileCardSkeleton` from `@/components/skeletons` for loading states

