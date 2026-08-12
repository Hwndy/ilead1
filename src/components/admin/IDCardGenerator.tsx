import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, Printer, Download, QrCode, Loader2, 
  Users, Calendar, Search, Eye, Pencil
} from 'lucide-react';
import { format, addYears } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { StudentIDCard } from './StudentIDCard';
import { fetchSchoolBranding } from '@/lib/school-branding';
import { EditStudentDialog } from './EditStudentDialog';

interface Student {
  id: string;
  user_id: string;
  admission_number: string;
  profile: {
    full_name: string;
    avatar_url?: string;
  };
  photo_url?: string | null;
  class?: {
    name: string;
  };
  qr_token?: string | null;
  date_of_birth?: string | null;
}

interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  motto?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

export const IDCardGenerator: React.FC = () => {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState(
    `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  );
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const branding = await fetchSchoolBranding();
      setSchool({
        id: 'ivintage',
        name: branding.name,
        address: branding.address || '',
        logo_url: branding.logo_url || '',
        motto: branding.motto || '',
      } as any);

      // Fetch classes
      const classesResponse = await supabase
        .from('classes')
        .select('id, name')
        
        .order('name');
      
      setClasses((classesResponse.data || []) as ClassOption[]);

      // Fetch students - use separate queries to avoid deep type instantiation
      const studentsResponse = await supabase
        .from('students')
        .select('id, user_id, admission_number, photo_url, date_of_birth')
        ;
      
      const studentsData = studentsResponse.data as any[] || [];

      // Get profiles for students
      if (studentsData.length > 0) {
        const userIds = studentsData.map(s => s.user_id);
        
        const profilesResponse = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        const profilesData = profilesResponse.data as any[] || [];

        // Fetch class assignments for these students (student_id = auth user_id)
        const assignmentsResponse = await supabase
          .from('class_assignments')
          .select('student_id, class_id')
          .in('student_id', userIds);
        const assignments = (assignmentsResponse.data as any[]) || [];
        const classesMap = new Map(
          ((classesResponse.data as any[]) || []).map((c: any) => [c.id, c.name])
        );
        const userClassMap = new Map<string, string>();
        for (const a of assignments) {
          const name = classesMap.get(a.class_id);
          if (name) userClassMap.set(a.student_id, name);
        }

        // QR tokens
        const studentIds = studentsData.map(s => s.id);
        const tokensResponse = await supabase
          .from('student_qr_tokens')
          .select('student_id, token')
          .is('revoked_at', null)
          .in('student_id', studentIds);
        const tokenMap = new Map<string, string>();
        for (const t of (tokensResponse.data as any[]) || []) {
          tokenMap.set(t.student_id, t.token);
        }

        const studentsWithProfiles: Student[] = studentsData.map((student: any) => ({
          id: student.id,
          user_id: student.user_id,
          admission_number: student.admission_number || `STU-${student.id.slice(0, 8).toUpperCase()}`,
          profile: profilesData.find(p => p.user_id === student.user_id) || { full_name: 'Unknown' },
          photo_url: student.photo_url,
          date_of_birth: student.date_of_birth,
          qr_token: tokenMap.get(student.id) || null,
          class: userClassMap.has(student.user_id)
            ? { name: userClassMap.get(student.user_id)! }
            : undefined,
        }));

        setStudents(studentsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admission_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class?.name === selectedClass;
    return matchesSearch && matchesClass;
  });

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredStudents.map(s => s.id);
    setSelectedStudents(prev => {
      const allSelected = visibleIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !visibleIds.includes(id));
      } else {
        return [...new Set([...prev, ...visibleIds])];
      }
    });
  };

  const generateQRData = (student: Student) => {
    return JSON.stringify({
      id: student.id,
      name: student.profile.full_name,
      admNo: student.admission_number,
      school: school?.name,
      valid: academicYear,
    });
  };

  const generateSingleCard = async (student: Student) => {
    setPreviewStudent(student);
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `ID_Card_${student.profile.full_name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({ title: 'Success', description: 'ID Card downloaded' });
    } catch (error) {
      console.error('Error generating card:', error);
      toast({ title: 'Error', description: 'Failed to generate card', variant: 'destructive' });
    }
  };

  const generateBatchCards = async () => {
    if (selectedStudents.length === 0) {
      toast({ title: 'Error', description: 'Please select students', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const cardsPerPage = 4;
    // Portrait ID card proportions matching StudentIDCard (360 x 605 px)
    const cardWidth = 54;   // mm
    const cardHeight = 90.75; // mm
    const margin = 10;
    const spacing = 5;

    try {
      const selectedStudentObjects = students.filter(s => selectedStudents.includes(s.id));
      
      for (let i = 0; i < selectedStudentObjects.length; i++) {
        const student = selectedStudentObjects[i];
        setPreviewStudent(student);
        await new Promise(resolve => setTimeout(resolve, 150));

        if (!cardRef.current) continue;

        const canvas = await html2canvas(cardRef.current, {
          scale: 3,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        
        if (i > 0 && i % cardsPerPage === 0) {
          pdf.addPage();
        }

        const positionIndex = i % cardsPerPage;
        const row = Math.floor(positionIndex / 2);
        const col = positionIndex % 2;
        
        const x = margin + col * (cardWidth + spacing);
        const y = margin + row * (cardHeight + spacing);

        pdf.addImage(imgData, 'PNG', x, y, cardWidth, cardHeight);
      }

      pdf.save(`ID_Cards_Batch_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      // Record generated cards in database
      const cardRecords = selectedStudentObjects.map(student => ({
                student_id: student.id,
        card_number: `ID-${academicYear.replace('/', '')}-${student.admission_number || student.id.slice(0, 8)}`,
        academic_year: academicYear,
        issue_date: new Date().toISOString().split('T')[0],
        expiry_date: addYears(new Date(), 1).toISOString().split('T')[0],
        status: 'active',
      }));

      await supabase.from('student_id_cards').insert(cardRecords);

      toast({ title: 'Success', description: `Generated ${selectedStudents.length} ID cards` });
      setSelectedStudents([]);
    } catch (error) {
      console.error('Error generating batch cards:', error);
      toast({ title: 'Error', description: 'Failed to generate cards', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setPreviewStudent(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{selectedStudents.length}</p>
                <p className="text-sm text-muted-foreground">Selected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{academicYear}</p>
                <p className="text-sm text-muted-foreground">Academic Year</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Student ID Card Generator</CardTitle>
          <CardDescription>Generate and print student ID cards with QR codes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="sr-only">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2024/2025"
              />
            </div>
            <Button 
              onClick={generateBatchCards} 
              disabled={selectedStudents.length === 0 || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Selected ({selectedStudents.length})
                </>
              )}
            </Button>
          </div>

          {/* Students Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s.id))}
                      onCheckedChange={selectAllVisible}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No students found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleStudentSelection(student.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {student.profile.avatar_url ? (
                              <img 
                                src={student.profile.avatar_url} 
                                alt={student.profile.full_name}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-primary">
                                {student.profile.full_name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{student.profile.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.admission_number}</Badge>
                      </TableCell>
                      <TableCell>{student.class?.name || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditUserId(student.user_id)}
                            title="Edit student profile"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setPreviewStudent(student)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => generateSingleCard(student)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ID Card Preview/Template (hidden, used for generation) */}
      {previewStudent && (
        <Card>
          <CardHeader>
            <CardTitle>ID Card Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div ref={cardRef}>
              <StudentIDCard
                student={{
                  user_id: previewStudent.user_id,
                  full_name: previewStudent.profile.full_name,
                  admission_number: previewStudent.admission_number,
                  photo_url: previewStudent.photo_url || previewStudent.profile.avatar_url || null,
                  class_name: previewStudent.class?.name || null,
                  date_of_birth: previewStudent.date_of_birth || null,
                  session: academicYear,
                  qr_token: previewStudent.qr_token || null,
                }}
                school={{
                  name: school?.name || 'School Name',
                  address: school?.address,
                  logo_url: school?.logo_url || null,
                  motto: school?.motto,
                  phone: school?.phone,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {editUserId && (
        <EditStudentDialog
          open={!!editUserId}
          onOpenChange={(o) => !o && setEditUserId(null)}
          userId={editUserId}
          onSaved={() => { setEditUserId(null); fetchData(); }}
        />
      )}
    </div>
  );
};
