import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/PageIntro";
import { useCallsData } from "./hooks/useCallsData";
import CallsTable from "./CallsTable";
import CallsEditDialog from "./CallsEditDialog";

const Calls = () => {
  const {
    dateFilter,
    customDate,
    setCustomDate,
    showDatePicker,
    setShowDatePicker,
    selectedCloserId,
    setSelectedCloserId,
    editingAppointment,
    setEditingAppointment,
    selectedDate,
    appointments,
    isLoading,
    roleLoading,
    closerMetrics,
    isManager,
    updateAppointmentMutation,
    handleDateFilterChange,
    handleSaveAppointment,
    formatOrg,
    setDateFilter,
  } = useCallsData();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageIntro
        icon={CalendarIcon}
        tagline="Call Management"
        description="Schedule and track your one-on-one calls."
        variant="sky"
      />

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
            <Button
              variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
              onClick={() => handleDateFilterChange('yesterday')}
            >
              Yesterday
            </Button>
            <Button
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              onClick={() => handleDateFilterChange('today')}
            >
              Today
            </Button>
            <Button
              variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
              onClick={() => handleDateFilterChange('tomorrow')}
            >
              Tomorrow
            </Button>

            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === 'custom' ? 'default' : 'outline'}
                  onClick={() => handleDateFilterChange('custom')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter === 'custom' ? format(customDate, 'MM/dd/yyyy') : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    if (date) {
                      setCustomDate(date);
                      setDateFilter('custom');
                      setShowDatePicker(false);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {dateFilter === 'custom' && (
              <span className="flex items-center text-sm text-muted-foreground">
                Showing calls for {format(customDate, 'MMMM dd, yyyy')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Closer Cards - Hidden for Managers */}
      {!isManager && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto">
          {/* All Closers Card */}
          <Card
            className={cn(
              "cursor-pointer transition-all hover:shadow-md overflow-hidden",
              selectedCloserId === null && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedCloserId(null)}
          >
            <div className="grid grid-cols-2 divide-x">
              <div className="p-4 flex flex-col justify-center">
                <h3 className="text-lg font-medium mb-2">All Closers</h3>
                <div className="text-5xl font-bold">
                  {closerMetrics?.reduce((sum, c) => sum + (c.total_calls || 0), 0) || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total calls</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Offered amt</span>
                    <span className="text-base font-bold">
                      ₹{(closerMetrics?.reduce((sum, c) => sum + (c.offered_amount || 0), 0) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Cash collected</span>
                    <span className="text-base font-bold">
                      ₹{(closerMetrics?.reduce((sum, c) => sum + (c.cash_collected || 0), 0) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span>Converted</span>
                    <span className="font-medium text-green-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.converted_count || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Rescheduled</span>
                    <span className="font-medium text-purple-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.rescheduled_count || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Pending</span>
                    <span className="font-medium text-blue-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.pending_count || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Not Converted</span>
                    <span className="font-medium text-red-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.not_converted_count || 0), 0) || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Individual Closer Cards */}
          {closerMetrics?.map((closer) => (
            <Card
              key={closer.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md overflow-hidden",
                selectedCloserId === closer.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedCloserId(selectedCloserId === closer.id ? null : closer.id)}
            >
              <div className="grid grid-cols-2 divide-x">
                <div className="p-4 flex flex-col justify-center">
                  <h3 className="text-lg font-medium mb-2">{closer.full_name}</h3>
                  <div className="text-5xl font-bold">{closer.total_calls || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">Total calls</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Offered amt</span>
                      <span className="text-base font-bold">
                        ₹{(closer.offered_amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Cash collected</span>
                      <span className="text-base font-bold">
                        ₹{(closer.cash_collected || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between border-b pb-1">
                      <span>Converted</span>
                      <span className="font-medium text-green-600">{closer.converted_count || 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Rescheduled</span>
                      <span className="font-medium text-purple-600">{closer.rescheduled_count || 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Pending</span>
                      <span className="font-medium text-blue-600">{closer.pending_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Not Converted</span>
                      <span className="font-medium text-red-600">{closer.not_converted_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Appointments Table */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Appointments for {formatOrg(selectedDate, 'MMM dd, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <CallsTable
            appointments={appointments}
            isLoading={isLoading}
            roleLoading={roleLoading}
            selectedCloserId={selectedCloserId}
            formattedDate={formatOrg(selectedDate, 'MMM dd, yyyy')}
          />
        </CardContent>
      </Card>

      {/* Edit Appointment Dialog */}
      <CallsEditDialog
        editingAppointment={editingAppointment}
        setEditingAppointment={setEditingAppointment}
        onSave={handleSaveAppointment}
        isPending={updateAppointmentMutation.isPending}
      />
    </div>
  );
};

export default Calls;
