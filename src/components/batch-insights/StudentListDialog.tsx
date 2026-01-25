import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Pencil, X } from "lucide-react";
import { format } from "date-fns";

interface Student {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  due_amount: number;
  next_follow_up_date?: string | null;
  closer_name?: string | null;
}

interface StudentListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  students: Student[];
  totalAmount: number;
  onEditNotes?: (student: Student) => void;
  showFollowUpDate?: boolean;
}

export const StudentListDialog: React.FC<StudentListDialogProps> = ({
  open,
  onOpenChange,
  title,
  subtitle,
  students,
  totalAmount,
  onEditNotes,
  showFollowUpDate = false,
}) => {
  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>{title}</span>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {formatAmount(totalAmount)}
            </Badge>
          </DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {students.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No students found
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {students.map((student) => (
                  <div key={student.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{student.contact_name}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                      <span className="font-bold text-primary">
                        {formatAmount(student.due_amount)}
                      </span>
                    </div>
                    {student.closer_name && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Closer: {student.closer_name}
                      </p>
                    )}
                    {showFollowUpDate && student.next_follow_up_date && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Follow-up: {format(new Date(student.next_follow_up_date), "dd MMM yyyy")}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {student.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCall(student.phone!)}
                          className="flex-1"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Call
                        </Button>
                      )}
                      {onEditNotes && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditNotes(student)}
                          className="flex-1"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    {showFollowUpDate && <TableHead>Follow-up</TableHead>}
                    <TableHead className="text-right">Due Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.contact_name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                          {student.closer_name && (
                            <p className="text-xs text-muted-foreground">
                              Closer: {student.closer_name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{student.phone || "—"}</TableCell>
                      {showFollowUpDate && (
                        <TableCell>
                          {student.next_follow_up_date
                            ? format(new Date(student.next_follow_up_date), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatAmount(student.due_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {student.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCall(student.phone!)}
                              title="Call"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          {onEditNotes && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditNotes(student)}
                              title="Edit Notes"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {students.length} {students.length === 1 ? "student" : "students"}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
