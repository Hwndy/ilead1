import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Plus, Search, Filter, FileDown, Upload, IdCard, GraduationCap, UserCheck, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  admission_number: string;
  user_id: string;
  date_of_birth: string;
  gender: string;
  status: string;
  address: any;
  medical_info: any;
  emergency_contact: any;
  created_at: string;
  profiles?: {
    full_name: string;
    role: string;
  };
  class_assignments?: {
    classes: {
      name: string;
    };
  }[];
}

interface Class {
  id: string;
  name: string;
}

export const StudentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [newStudent, setNewStudent] = useState({
    full_name: '',
    email: '',
    password: '',
    admission_number: '',
    date_of_birth: undefined as Date | undefined,
    gender: '',
    class_id: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: 'Nigeria'
    },
    emergency_contact: {
      name: '',
      relationship: '',
      phone: '',
      email: ''
    },
    medical_info: {
      blood_group: '',
      allergies: '',
      conditions: ''
    }
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch students 
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (studentsError) throw studentsError;

      // Fetch classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('name');

      if (classesError) throw classesError;

      // Fetch profiles and class assignments separately
      const studentsWithDetails = await Promise.all(
        (studentsData || []).map(async (student) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', student.user_id)
            .single();

          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', student.user_id)
            .single();

          const { data: assignments } = await supabase
            .from('class_assignments')
            .select('class_id')
            .eq('student_id', student.id);

          const classNames = await Promise.all(
            (assignments || []).map(async (assignment) => {
              const { data: cls } = await supabase
                .from('classes')
                .select('name')
                .eq('id', assignment.class_id)
                .single();
              return cls;
            })
          );

          return {
            ...student,
            profiles: {
              full_name: profile?.full_name || 'Unknown',
              role: roleData?.role || 'student'
            },
            class_assignments: classNames.filter(Boolean).map(cls => ({ classes: cls }))
          };
        })
      );

      setStudents(studentsWithDetails);
      setClasses(classesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load student data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStudent = async () => {
    try {
      if (!newStudent.full_name || !newStudent.email || !newStudent.admission_number) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newStudent.email,
        password: newStudent.password || 'defaultPassword123',
        email_confirm: true,
        user_metadata: {
          full_name: newStudent.full_name,
          role: 'student'
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create student record
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: authData.user.id,
          admission_number: newStudent.admission_number,
          date_of_birth: newStudent.date_of_birth ? format(newStudent.date_of_birth, 'yyyy-MM-dd') : null,
          gender: newStudent.gender,
          address: newStudent.address,
          emergency_contact: newStudent.emergency_contact,
          medical_info: newStudent.medical_info,
                    status: 'active'
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // Assign to class if selected
      if (newStudent.class_id) {
        const { error: assignmentError } = await supabase
          .from('class_assignments')
          .insert({
            student_id: studentData.id,
            class_id: newStudent.class_id
          });

        if (assignmentError) throw assignmentError;
      }

      toast({
        title: 'Success',
        description: 'Student created successfully',
      });

      setShowAddStudent(false);
      setNewStudent({
        full_name: '',
        email: '',
        password: '',
        admission_number: '',
        date_of_birth: undefined,
        gender: '',
        class_id: '',
        address: { street: '', city: '', state: '', country: 'Nigeria' },
        emergency_contact: { name: '', relationship: '', phone: '', email: '' },
        medical_info: { blood_group: '', allergies: '', conditions: '' }
      });
      
      fetchData();
    } catch (error: any) {
      console.error('Error creating student:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create student',
        variant: 'destructive',
      });
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClass === 'all' || 
                        student.class_assignments?.some(ca => ca.classes?.name === selectedClass);
    
    const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  const generateAdmissionNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ALB${year}${random}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Student Management</h2>
          <p className="text-muted-foreground">Manage student records, admissions, and profiles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setShowAddStudent(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {students.filter(s => s.status === 'active').length}
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-orange-600">
                  {students.filter(s => s.status === 'inactive').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alumni</p>
                <p className="text-2xl font-bold text-blue-600">
                  {students.filter(s => s.status === 'graduated').length}
                </p>
              </div>
              <GraduationCap className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.name}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Students ({filteredStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission Number</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {student.profiles?.full_name?.split(' ').map(n => n[0]).join('') || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.profiles?.full_name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">{student.gender}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.admission_number}</Badge>
                    </TableCell>
                    <TableCell>
                      {student.class_assignments?.[0]?.classes?.name || 'Not Assigned'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        student.status === 'active' ? 'default' :
                        student.status === 'inactive' ? 'secondary' :
                        'outline'
                      }>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {student.date_of_birth ? format(new Date(student.date_of_birth), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedStudent(student)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact & Address</TabsTrigger>
              <TabsTrigger value="medical">Medical Info</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={newStudent.full_name}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admission_number">Admission Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="admission_number"
                      value={newStudent.admission_number}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, admission_number: e.target.value }))}
                      placeholder="Enter admission number"
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setNewStudent(prev => ({ ...prev, admission_number: generateAdmissionNumber() }))}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={newStudent.gender} onValueChange={(value) => setNewStudent(prev => ({ ...prev, gender: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newStudent.date_of_birth && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newStudent.date_of_birth ? format(newStudent.date_of_birth, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newStudent.date_of_birth}
                        onSelect={(date) => setNewStudent(prev => ({ ...prev, date_of_birth: date }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class">Assign to Class</Label>
                  <Select value={newStudent.class_id} onValueChange={(value) => setNewStudent(prev => ({ ...prev, class_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-semibold">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={newStudent.address.street}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
                      placeholder="Enter street address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newStudent.address.city}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, address: { ...prev.address, city: e.target.value } }))}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={newStudent.address.state}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, address: { ...prev.address, state: e.target.value } }))}
                      placeholder="Enter state"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={newStudent.address.country}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, address: { ...prev.address, country: e.target.value } }))}
                      placeholder="Enter country"
                    />
                  </div>
                </div>

                <h4 className="font-semibold">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_name">Contact Name</Label>
                    <Input
                      id="emergency_name"
                      value={newStudent.emergency_contact.name}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, emergency_contact: { ...prev.emergency_contact, name: e.target.value } }))}
                      placeholder="Enter contact name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship</Label>
                    <Input
                      id="relationship"
                      value={newStudent.emergency_contact.relationship}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, emergency_contact: { ...prev.emergency_contact, relationship: e.target.value } }))}
                      placeholder="e.g., Parent, Guardian"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_phone">Phone Number</Label>
                    <Input
                      id="emergency_phone"
                      value={newStudent.emergency_contact.phone}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, emergency_contact: { ...prev.emergency_contact, phone: e.target.value } }))}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_email">Email</Label>
                    <Input
                      id="emergency_email"
                      type="email"
                      value={newStudent.emergency_contact.email}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, emergency_contact: { ...prev.emergency_contact, email: e.target.value } }))}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="medical" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="blood_group">Blood Group</Label>
                  <Select 
                    value={newStudent.medical_info.blood_group} 
                    onValueChange={(value) => setNewStudent(prev => ({ ...prev, medical_info: { ...prev.medical_info, blood_group: value } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="allergies">Allergies</Label>
                  <Textarea
                    id="allergies"
                    value={newStudent.medical_info.allergies}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, medical_info: { ...prev.medical_info, allergies: e.target.value } }))}
                    placeholder="List any known allergies"
                    rows={3}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="conditions">Medical Conditions</Label>
                  <Textarea
                    id="conditions"
                    value={newStudent.medical_info.conditions}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, medical_info: { ...prev.medical_info, conditions: e.target.value } }))}
                    placeholder="List any medical conditions"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent}>
              Add Student
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Details Dialog */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-lg">
                    {selectedStudent.profiles?.full_name?.split(' ').map(n => n[0]).join('') || 'S'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedStudent.profiles?.full_name}</h3>
                  <p className="text-muted-foreground">Admission Number: {selectedStudent.admission_number}</p>
                  <Badge variant={
                    selectedStudent.status === 'active' ? 'default' :
                    selectedStudent.status === 'inactive' ? 'secondary' :
                    'outline'
                  }>
                    {selectedStudent.status}
                  </Badge>
                </div>
              </div>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="academic">Academic</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="medical">Medical</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Date of Birth</Label>
                      <p>{selectedStudent.date_of_birth ? format(new Date(selectedStudent.date_of_birth), 'PPP') : 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Gender</Label>
                      <p>{selectedStudent.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Class</Label>
                      <p>{selectedStudent.class_assignments?.[0]?.classes?.name || 'Not Assigned'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Admission Date</Label>
                      <p>{format(new Date(selectedStudent.created_at), 'PPP')}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="academic" className="space-y-4">
                  <p className="text-muted-foreground">Academic information and performance records would be displayed here.</p>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  {selectedStudent.address && (
                    <div>
                      <Label className="text-muted-foreground">Address</Label>
                      <p>{selectedStudent.address.street}, {selectedStudent.address.city}, {selectedStudent.address.state}, {selectedStudent.address.country}</p>
                    </div>
                  )}
                  {selectedStudent.emergency_contact && (
                    <div>
                      <Label className="text-muted-foreground">Emergency Contact</Label>
                      <p>{selectedStudent.emergency_contact.name} ({selectedStudent.emergency_contact.relationship})</p>
                      <p>{selectedStudent.emergency_contact.phone}</p>
                      <p>{selectedStudent.emergency_contact.email}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="medical" className="space-y-4">
                  {selectedStudent.medical_info && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-muted-foreground">Blood Group</Label>
                        <p>{selectedStudent.medical_info.blood_group || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Allergies</Label>
                        <p>{selectedStudent.medical_info.allergies || 'None reported'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Medical Conditions</Label>
                        <p>{selectedStudent.medical_info.conditions || 'None reported'}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};