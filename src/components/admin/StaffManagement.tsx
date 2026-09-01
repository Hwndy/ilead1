import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Search, Edit, Eye, Briefcase, Calendar, RefreshCw, Loader2, Download } from "lucide-react";
import { format } from "date-fns";

interface StaffMember {
  id: string;
  user_id: string;
  employee_id: string;
  department: string;
  designation: string;
  join_date: string;
  employment_type: string;
  status: string;
  profile?: {
    full_name: string;
    user_id: string;
  };
  user_roles?: {
    role: string;
  }[];
}

interface StaffDetails {
  id: string;
  user_id: string;
  employee_id: string;
  department: string;
  designation: string;
  join_date: string;
  qualifications: any;
  documents: any;
  bank_details: any;
  salary: number;
  employment_type: string;
  status: string;
  emergency_contact: any;
}

export const StaffManagement = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffDetails | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    employee_id: string;
    department: string;
    designation: string;
    join_date: string;
    employment_type: string;
    status: string;
  } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    user_id: "",
    employee_id: "",
    department: "",
    designation: "",
    join_date: "",
    employment_type: "full-time",
  });

  useEffect(() => {
    fetchStaffMembers();
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStaffMembers = async () => {
    setIsLoading(true);
    
    // First get staff details
    const { data: staffData, error: staffError } = await supabase
      .from("staff_details")
      .select("*")
      ;

    if (staffError) {
      console.error("Error fetching staff:", staffError);
      setIsLoading(false);
      return;
    }

    // Fetch profiles for each staff member
    if (staffData && staffData.length > 0) {
      const userIds = staffData.map(s => s.user_id);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const enrichedStaff = staffData.map(staff => ({
        ...staff,
        profile: profiles?.find(p => p.user_id === staff.user_id),
        user_roles: roles?.filter(r => r.user_id === staff.user_id)
      }));

      setStaffMembers(enrichedStaff);
    } else {
      setStaffMembers([]);
    }
    
    setIsLoading(false);
  };

  const fetchTeachers = async () => {
    // Get all teachers/admin users without staff_details
    const { data: allUsers } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["teacher", "admin"]);

    if (allUsers) {
      const userIds = allUsers.map(u => u.user_id);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds)
        ;

      const { data: existingStaff } = await supabase
        .from("staff_details")
        .select("user_id")
        ;

      const existingUserIds = existingStaff?.map(s => s.user_id) || [];

      // Filter to only show users without staff details
      const availableTeachers = profiles?.filter(
        p => !existingUserIds.includes(p.user_id)
      ).map(p => ({
        ...p,
        role: allUsers.find(u => u.user_id === p.user_id)?.role
      }));

      setTeachers(availableTeachers || []);
    }
  };

  /** Create staff_details rows for teacher/admin accounts that don't have one yet. */
  const syncStaffFromAccounts = async () => {
    setSyncing(true);
    try {
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["teacher", "admin"]);
      if (roleErr) throw roleErr;

      const roleUserIds = [...new Set(((roleRows as any[]) || []).map((r) => r.user_id))];
      if (!roleUserIds.length) {
        toast.info("No teacher or admin accounts found");
        return;
      }

      const { data: existing } = await supabase
        .from("staff_details")
        .select("user_id")
        .in("user_id", roleUserIds);
      const existingIds = new Set(((existing as any[]) || []).map((s) => s.user_id));

      const missing = roleUserIds.filter((id) => !existingIds.has(id));
      if (!missing.length) {
        toast.success("All staff accounts already have staff records");
        return;
      }

      const rows: any[] = [];
      for (const userId of missing) {
        const role = ((roleRows as any[]) || []).find((r) => r.user_id === userId)?.role;
        rows.push({
          user_id: userId,
          // employee_id is issued by the database (unique, sequence-backed)
          designation: role === "admin" ? "Administrator" : "Teacher",
          department: role === "admin" ? "Administration" : "Academics",
          employment_type: "full-time",
          status: "active",
        });
      }

      const { error: insErr } = await supabase.from("staff_details").insert(rows);
      if (insErr) throw insErr;
      toast.success(`${rows.length} staff record(s) created`);
      await fetchStaffMembers();
      await fetchTeachers();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddStaff = async () => {
    if (!formData.user_id) {
      toast.error("Please select a user");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from("staff_details")
      .insert({
        user_id: formData.user_id,
        employee_id: formData.employee_id.trim() || null,
        department: formData.department,
        designation: formData.designation,
        join_date: formData.join_date || null,
        employment_type: formData.employment_type,
      });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Staff member added successfully");
      setShowAddDialog(false);
      setFormData({
        user_id: "",
        employee_id: "",
        department: "",
        designation: "",
        join_date: "",
        employment_type: "full-time",
      });
      fetchStaffMembers();
      fetchTeachers();
    }

    setIsLoading(false);
  };

  const handleViewStaff = async (staff: StaffMember) => {
    const { data } = await supabase
      .from("staff_details")
      .select("*")
      .eq("id", staff.id)
      .single();

    if (data) {
      setSelectedStaff(data);
      setShowViewDialog(true);
    }
  };

  const openEdit = (staff: StaffMember) => {
    setEditForm({
      id: staff.id,
      employee_id: staff.employee_id || "",
      department: staff.department || "",
      designation: staff.designation || "",
      join_date: staff.join_date || "",
      employment_type: staff.employment_type || "full-time",
      status: staff.status || "active",
    });
    setShowEditDialog(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setIsLoading(true);
    const { error } = await supabase
      .from("staff_details")
      .update({
        employee_id: editForm.employee_id.trim() || null,
        department: editForm.department || null,
        designation: editForm.designation || null,
        join_date: editForm.join_date || null,
        employment_type: editForm.employment_type,
        status: editForm.status,
      })
      .eq("id", editForm.id);
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff record updated");
    setShowEditDialog(false);
    setEditForm(null);
    fetchStaffMembers();
  };

  const exportDirectory = () => {
    const header = ["Employee ID", "Name", "Role", "Department", "Designation", "Join Date", "Type", "Status"];
    const rows = filteredStaff.map((s) => [
      s.employee_id || "",
      s.profile?.full_name || "",
      s.user_roles?.[0]?.role || "",
      s.department || "",
      s.designation || "",
      s.join_date || "",
      s.employment_type || "",
      s.status || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-directory-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "on-leave":
        return <Badge className="bg-amber-500">On Leave</Badge>;
      case "terminated":
        return <Badge variant="destructive">Terminated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredStaff = staffMembers.filter((staff) => {
    const matchesSearch =
      staff.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || staff.department === filterDepartment;
    const matchesStatus = filterStatus === "all" || staff.status === filterStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const departments = [...new Set(staffMembers.map((s) => s.department).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Staff Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportDirectory} disabled={filteredStaff.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={syncStaffFromAccounts} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync staff from accounts
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
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
                <Briefcase className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {staffMembers.filter((s) => s.status === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {staffMembers.filter((s) => s.status === "on-leave").length}
                </p>
                <p className="text-sm text-muted-foreground">On Leave</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{departments.length}</p>
                <p className="text-sm text-muted-foreground">Departments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <CardTitle>Staff Directory</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on-leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading staff…
                  </TableCell>
                </TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {staffMembers.length === 0
                      ? 'No staff records yet. Use "Sync staff from accounts" to create records for existing teacher and admin logins, or add staff manually.'
                      : "No staff match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.employee_id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{staff.profile?.full_name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">
                          {staff.user_roles?.[0]?.role || "Staff"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{staff.department || ""}</TableCell>
                    <TableCell>{staff.designation || ""}</TableCell>
                    <TableCell>
                      {staff.join_date
                        ? format(new Date(staff.join_date), "MMM dd, yyyy")
                        : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {staff.employment_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(staff.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewStaff(staff)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(staff)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select User *</label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.user_id} value={teacher.user_id}>
                      {teacher.full_name} ({teacher.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {teachers.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No available users. All teachers/admins already have staff records.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Employee ID</label>
              <Input
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                placeholder="Leave blank to auto-generate (ALB/STF/0001)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Department</label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Science"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Designation</label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g., Senior Teacher"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Join Date</label>
                <Input
                  type="date"
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Employment Type</label>
                <Select
                  value={formData.employment_type}
                  onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full Time</SelectItem>
                    <SelectItem value="part-time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff} disabled={isLoading}>
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(o) => { setShowEditDialog(o); if (!o) setEditForm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Record</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Employee ID</label>
                <Input
                  value={editForm.employee_id}
                  onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Department</label>
                  <Input
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Designation</label>
                  <Input
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Join Date</label>
                  <Input
                    type="date"
                    value={editForm.join_date}
                    onChange={(e) => setEditForm({ ...editForm, join_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Employment Type</label>
                  <Select
                    value={editForm.employment_type}
                    onValueChange={(v) => setEditForm({ ...editForm, employment_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full Time</SelectItem>
                      <SelectItem value="part-time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-leave">On Leave</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isLoading}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Staff Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Basic Info</TabsTrigger>
                <TabsTrigger value="qualifications">Qualifications</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Employee ID</label>
                    <p className="font-medium">{selectedStaff.employee_id}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Department</label>
                    <p className="font-medium">{selectedStaff.department || ""}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Designation</label>
                    <p className="font-medium">{selectedStaff.designation || ""}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Join Date</label>
                    <p className="font-medium">
                      {selectedStaff.join_date
                        ? format(new Date(selectedStaff.join_date), "MMM dd, yyyy")
                        : ""}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Employment Type</label>
                    <p className="font-medium capitalize">{selectedStaff.employment_type}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <p>{getStatusBadge(selectedStaff.status)}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="qualifications">
                <div className="py-8 text-center text-muted-foreground">
                  {Array.isArray(selectedStaff.qualifications) && selectedStaff.qualifications.length > 0
                    ? "Qualifications listed here"
                    : "No qualifications added yet"}
                </div>
              </TabsContent>
              <TabsContent value="documents">
                <div className="py-8 text-center text-muted-foreground">
                  {Array.isArray(selectedStaff.documents) && selectedStaff.documents.length > 0
                    ? "Documents listed here"
                    : "No documents uploaded yet"}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
