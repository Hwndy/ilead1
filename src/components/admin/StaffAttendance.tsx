import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Users, CheckCircle2, XCircle, AlertCircle, Save, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

interface StaffMember {
  id: string;
  user_id: string;
  employee_id: string;
  department: string;
  designation: string;
  status: string;
  profile?: {
    full_name: string;
  };
}

interface AttendanceRecord {
  staff_id: string;
  status: string;
  check_in?: string;
  check_out?: string;
  notes?: string;
}

export const StaffAttendance = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState({
    totalDays: 0,
    avgPresent: 0,
    avgAbsent: 0,
    avgLeave: 0,
  });

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  useEffect(() => {
    fetchMonthlyStats();
  }, [selectedDate]);

  const fetchStaffMembers = async () => {
    const { data: staffData, error } = await supabase
      .from("staff_details")
      .select("id, user_id, employee_id, department, designation, status")
      
      .eq("status", "active");

    if (error) {
      console.error("Error fetching staff:", error);
      return;
    }

    if (staffData && staffData.length > 0) {
      const userIds = staffData.map(s => s.user_id);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const enrichedStaff = staffData.map(staff => ({
        ...staff,
        profile: profiles?.find(p => p.user_id === staff.user_id)
      }));

      setStaffMembers(enrichedStaff);
    } else {
      setStaffMembers([]);
    }
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("staff_attendance")
      .select("*")
      
      .eq("date", selectedDate);

    if (!error && data) {
      const records: Record<string, AttendanceRecord> = {};
      data.forEach((record) => {
        records[record.staff_id] = {
          staff_id: record.staff_id,
          status: record.status,
          check_in: record.check_in,
          check_out: record.check_out,
          notes: record.notes,
        };
      });
      setAttendanceRecords(records);
    }
    
    setIsLoading(false);
  };

  const fetchMonthlyStats = async () => {
    const date = new Date(selectedDate);
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("staff_attendance")
      .select("status")
      
      .gte("date", start)
      .lte("date", end);

    if (!error && data) {
      const workingDays = eachDayOfInterval({
        start: startOfMonth(date),
        end: new Date() > endOfMonth(date) ? endOfMonth(date) : new Date()
      }).filter(d => !isWeekend(d)).length;

      const present = data.filter(r => r.status === "present").length;
      const absent = data.filter(r => r.status === "absent").length;
      const leave = data.filter(r => r.status === "leave").length;

      setMonthlyStats({
        totalDays: workingDays,
        avgPresent: present,
        avgAbsent: absent,
        avgLeave: leave,
      });
    }
  };

  const handleStatusChange = (staffId: string, status: string) => {
    setAttendanceRecords((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        staff_id: staffId,
        status,
      },
    }));
  };

  const handleTimeChange = (staffId: string, field: "check_in" | "check_out", value: string) => {
    setAttendanceRecords((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        staff_id: staffId,
        [field]: value,
      },
    }));
  };

  const saveAttendance = async () => {
    setIsSaving(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const records = Object.values(attendanceRecords).filter(r => r.status);
      
      for (const record of records) {
        const { error } = await supabase
          .from("staff_attendance")
          .upsert({
                        staff_id: record.staff_id,
            date: selectedDate,
            status: record.status,
            check_in: record.check_in || null,
            check_out: record.check_out || null,
            notes: record.notes || null,
            marked_by: userData.user?.id,
          }, {
            onConflict: "staff_id,date"
          });

        if (error) throw error;
      }

      toast.success("Attendance saved successfully");
      fetchMonthlyStats();
    } catch (error: any) {
      toast.error(error.message || "Failed to save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const markAllPresent = () => {
    const newRecords: Record<string, AttendanceRecord> = { ...attendanceRecords };
    staffMembers.forEach((staff) => {
      newRecords[staff.user_id] = {
        ...newRecords[staff.user_id],
        staff_id: staff.user_id,
        status: "present",
        check_in: newRecords[staff.user_id]?.check_in || "08:00",
      };
    });
    setAttendanceRecords(newRecords);
  };

  const clearDay = () => setAttendanceRecords({});

  const exportDay = () => {
    const header = ["Employee ID", "Name", "Department", "Status", "Check In", "Check Out"];
    const rows = staffMembers.map((s) => [
      s.employee_id || "",
      s.profile?.full_name || "",
      s.department || "",
      attendanceRecords[s.user_id]?.status || "not marked",
      attendanceRecords[s.user_id]?.check_in || "",
      attendanceRecords[s.user_id]?.check_out || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-attendance-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-500">Present</Badge>;
      case "absent":
        return <Badge variant="destructive">Absent</Badge>;
      case "leave":
        return <Badge className="bg-amber-500">Leave</Badge>;
      case "half-day":
        return <Badge variant="secondary">Half Day</Badge>;
      case "late":
        return <Badge className="bg-orange-500">Late</Badge>;
      default:
        return <Badge variant="outline">Not Marked</Badge>;
    }
  };

  const presentCount = Object.values(attendanceRecords).filter(r => r.status === "present" || r.status === "late").length;
  const absentCount = Object.values(attendanceRecords).filter(r => r.status === "absent").length;
  const leaveCount = Object.values(attendanceRecords).filter(r => r.status === "leave" || r.status === "half-day").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Staff Attendance</h2>
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
          <Button variant="outline" onClick={markAllPresent}>
            Mark All Present
          </Button>
          <Button variant="outline" onClick={clearDay}>
            Clear
          </Button>
          <Button variant="outline" onClick={exportDay} disabled={staffMembers.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={saveAttendance} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Attendance
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{staffMembers.length}</p>
                <p className="text-sm text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{presentCount}</p>
                <p className="text-sm text-muted-foreground">Present Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{absentCount}</p>
                <p className="text-sm text-muted-foreground">Absent Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{leaveCount}</p>
                <p className="text-sm text-muted-foreground">On Leave</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance for {format(new Date(selectedDate), "MMMM dd, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No staff members found. Add staff in Staff Management first.
                  </TableCell>
                </TableRow>
              ) : (
                staffMembers.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.employee_id}</TableCell>
                    <TableCell>{staff.profile?.full_name || "N/A"}</TableCell>
                    <TableCell>{staff.department || ""}</TableCell>
                    <TableCell>
                      <Select
                        value={attendanceRecords[staff.user_id]?.status || ""}
                        onValueChange={(value) => handleStatusChange(staff.user_id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Select">
                            {attendanceRecords[staff.user_id]?.status
                              ? getStatusBadge(attendanceRecords[staff.user_id].status)
                              : "Select"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="leave">Leave</SelectItem>
                          <SelectItem value="half-day">Half Day</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={attendanceRecords[staff.user_id]?.check_in || ""}
                        onChange={(e) => handleTimeChange(staff.user_id, "check_in", e.target.value)}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={attendanceRecords[staff.user_id]?.check_out || ""}
                        onChange={(e) => handleTimeChange(staff.user_id, "check_out", e.target.value)}
                        className="w-28"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Monthly Summary - {format(new Date(selectedDate), "MMMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <p className="text-2xl font-bold">{monthlyStats.totalDays}</p>
              <p className="text-sm text-muted-foreground">Working Days</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-2xl font-bold text-green-600">{monthlyStats.avgPresent}</p>
              <p className="text-sm text-muted-foreground">Total Present</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-2xl font-bold text-red-600">{monthlyStats.avgAbsent}</p>
              <p className="text-sm text-muted-foreground">Total Absent</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{monthlyStats.avgLeave}</p>
              <p className="text-sm text-muted-foreground">Total Leave</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
