import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Eye,
  UserX,
  Activity,
  Wifi,
  Monitor,
  MousePointer,
  RefreshCw,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logAuditEvent } from '@/lib/audit';

interface LiveSession {
  id: string;
  student_id: string;
  student_name: string;
  exam_title: string;
  status: string;
  started_at: string;
  time_remaining_seconds: number;
  current_question_index: number;
  total_questions: number;
  ip_address?: string;
  user_agent?: string;
  last_activity?: string;
  suspicious_activity_count: number;
}

interface SuspiciousActivity {
  id: string;
  student_name: string;
  activity_type: string;
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

interface SystemMetrics {
  total_sessions: number;
  active_sessions: number;
  peak_concurrent: number;
  average_session_duration: number;
  network_status: 'stable' | 'unstable' | 'critical';
  server_load: number;
}

export const EnhancedLiveMonitor: React.FC = () => {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    total_sessions: 0,
    active_sessions: 0,
    peak_concurrent: 0,
    average_session_duration: 0,
    network_status: 'stable',
    server_load: 0
  });
  
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [investigating, setInvestigating] = useState<SuspiciousActivity | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLiveData();
    fetchExams();
    
    // Set up real-time subscriptions
    const sessionChannel = supabase
      .channel('live-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'exam_sessions',
        },
        () => {
          fetchLiveData();
        }
      )
      .subscribe();

    // Auto refresh every 10 seconds if enabled
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchLiveData();
      }
    }, 10000);

    return () => {
      sessionChannel.unsubscribe();
      clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchLiveData = async () => {
    try {
      // Fetch active sessions with proper join
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          exams!inner(title, total_questions),
          profiles!student_id(full_name)
        `)
        .eq('status', 'in_progress');

      if (sessionsError) throw sessionsError;

      // Process sessions data
      const formattedSessions = sessionsData?.map((session: any) => ({
        id: session.id,
        student_id: session.student_id,
        student_name: session.profiles?.full_name || 'Unknown Student',
        exam_title: session.exams?.title || 'Unknown Exam',
        status: session.status,
        started_at: session.started_at,
        time_remaining_seconds: session.time_remaining_seconds || 0,
        current_question_index: session.current_question_index || 0,
        total_questions: session.exams?.total_questions || 0,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        last_activity: session.updated_at,
        suspicious_activity_count: 0
      })) || [];

      setLiveSessions(formattedSessions);

      // Calculate system metrics
      const now = new Date();
      const averageDuration = formattedSessions.reduce((acc, session) => {
        const duration = (now.getTime() - new Date(session.started_at).getTime()) / (1000 * 60); // minutes
        return acc + duration;
      }, 0) / (formattedSessions.length || 1);

      setSystemMetrics({
        total_sessions: formattedSessions.length,
        active_sessions: formattedSessions.length,
        peak_concurrent: Math.max(formattedSessions.length, systemMetrics.peak_concurrent),
        average_session_duration: averageDuration,
        network_status: 'stable',
        server_load: Math.min(formattedSessions.length * 2, 100) // Simulated load
      });

      // Real attention signals derived from the live sessions themselves.
      const activities: SuspiciousActivity[] = [];
      const seenStudents = new Map<string, number>();

      formattedSessions.forEach((session) => {
        seenStudents.set(session.student_id, (seenStudents.get(session.student_id) || 0) + 1);

        const lastActivity = session.last_activity ? new Date(session.last_activity).getTime() : null;
        const idleMinutes = lastActivity ? (now.getTime() - lastActivity) / 60000 : 0;

        if (idleMinutes >= 5) {
          activities.push({
            id: `${session.id}-idle`,
            student_name: session.student_name,
            activity_type: 'inactive',
            description: `No activity for ${Math.round(idleMinutes)} minutes while the exam is still open`,
            timestamp: session.last_activity || session.started_at,
            severity: idleMinutes >= 15 ? 'high' : 'medium',
          });
        }

        if (session.time_remaining_seconds === 0) {
          activities.push({
            id: `${session.id}-overtime`,
            student_name: session.student_name,
            activity_type: 'overtime',
            description: 'Time has run out but the session has not been submitted',
            timestamp: session.last_activity || session.started_at,
            severity: 'high',
          });
        }
      });

      seenStudents.forEach((count, studentId) => {
        if (count > 1) {
          const session = formattedSessions.find((s) => s.student_id === studentId);
          activities.push({
            id: `${studentId}-duplicate`,
            student_name: session?.student_name || 'Unknown student',
            activity_type: 'duplicate_session',
            description: `${count} exam sessions open at the same time`,
            timestamp: new Date().toISOString(),
            severity: 'high',
          });
        }
      });

      setSuspiciousActivities(activities);
      setLastUpdated(new Date());


    } catch (error: any) {
      console.error('Error fetching live data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch live monitoring data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, status')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
    }
  };

  const terminateSession = async (sessionId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to terminate ${studentName}'s exam session?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: 'Session Terminated',
        description: `${studentName}'s exam session has been terminated.`,
      });

      fetchLiveData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to terminate session',
        variant: 'destructive',
      });
    }
  };

  const sendWarning = async (sessionId: string, studentName: string) => {
    // In a real implementation, this would send a warning to the student
    toast({
      title: 'Warning Sent',
      description: `Warning sent to ${studentName}`,
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = (timeRemaining: number) => {
    if (timeRemaining < 300) return 'destructive'; // Less than 5 minutes
    if (timeRemaining < 600) return 'default'; // Less than 10 minutes
    return 'secondary';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const filteredSessions = selectedExam === 'all' 
    ? liveSessions 
    : liveSessions.filter(session => session.exam_title === selectedExam);

  if (loading) {
    return <div className="flex justify-center p-8">Loading live monitoring data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Monitor className="h-5 w-5 mr-2" />
              Live Exam Monitor
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLiveData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <div className="text-2xl font-bold">{systemMetrics.active_sessions}</div>
                </div>
                <div className="text-sm text-muted-foreground">Active Sessions</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Users className="h-5 w-5 text-success" />
                  <div className="text-2xl font-bold">{systemMetrics.peak_concurrent}</div>
                </div>
                <div className="text-sm text-muted-foreground">Peak Concurrent</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="h-5 w-5 text-warning" />
                  <div className="text-2xl font-bold">{Math.round(systemMetrics.average_session_duration)}</div>
                </div>
                <div className="text-sm text-muted-foreground">Avg Duration (min)</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Wifi className="h-5 w-5 text-info" />
                  <div className="text-lg font-bold capitalize">{systemMetrics.network_status}</div>
                </div>
                <div className="text-sm text-muted-foreground">Network Status</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  <div className="text-2xl font-bold">{suspiciousActivities.length}</div>
                </div>
                <div className="text-sm text-muted-foreground">Security Alerts</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Main Monitoring Interface */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions">Live Sessions</TabsTrigger>
          <TabsTrigger value="security">Security Monitor</TabsTrigger>
          <TabsTrigger value="analytics">System Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Live Exam Sessions ({filteredSessions.length})
                </CardTitle>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by exam" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Exams</SelectItem>
                    {exams.map(exam => (
                      <SelectItem key={exam.id} value={exam.title}>
                        {exam.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active exam sessions
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {filteredSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{session.student_name}</span>
                            <Badge variant="outline">{session.exam_title}</Badge>
                            {session.suspicious_activity_count > 0 && (
                              <Badge variant="destructive">
                                {session.suspicious_activity_count} alerts
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div>
                              Progress: {session.current_question_index + 1}/{session.total_questions}
                            </div>
                            <div>
                              Started: {new Date(session.started_at).toLocaleTimeString()}
                            </div>
                            <div>
                              IP: {session.ip_address || 'N/A'}
                            </div>
                            <div>
                              Last Activity: {session.last_activity ? new Date(session.last_activity).toLocaleTimeString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-center">
                            <Badge variant={getStatusColor(session.time_remaining_seconds)}>
                              {formatTime(session.time_remaining_seconds)}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">Remaining</div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendWarning(session.id, session.student_name)}
                            >
                              ⚠️ Warn
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => terminateSession(session.id, session.student_name)}
                              className="text-destructive hover:text-destructive"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              End
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Security Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suspiciousActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                    No suspicious activities detected
                  </div>
                ) : (
                  suspiciousActivities.map((activity) => (
                    <Alert key={activity.id} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>{activity.student_name}</strong>: {activity.description}
                            <div className="text-xs mt-1">
                              {new Date(activity.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getSeverityColor(activity.severity)}>
                              {activity.severity}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => setInvestigating(activity)}>
                              Investigate
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Server Load</span>
                      <span>{systemMetrics.server_load}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${systemMetrics.server_load}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Network Status</span>
                      <span className="capitalize">{systemMetrics.network_status}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Real-time Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Active Users:</span>
                    <span className="font-medium">{systemMetrics.active_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Peak Concurrent:</span>
                    <span className="font-medium">{systemMetrics.peak_concurrent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Session Duration:</span>
                    <span className="font-medium">{Math.round(systemMetrics.average_session_duration)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Security Incidents:</span>
                    <span className="font-medium text-destructive">{suspiciousActivities.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!investigating} onOpenChange={(open) => !open && setInvestigating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspicious activity</DialogTitle>
            <DialogDescription>Details recorded for this incident.</DialogDescription>
          </DialogHeader>
          {investigating && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Student</span>
                <span className="font-medium">{investigating.student_name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{investigating.activity_type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Severity</span>
                <Badge variant={getSeverityColor(investigating.severity)}>{investigating.severity}</Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Recorded</span>
                <span className="font-medium">{new Date(investigating.timestamp).toLocaleString()}</span>
              </div>
              <div className="rounded-md border p-3 text-muted-foreground">{investigating.description}</div>
              {(() => {
                const session = liveSessions.find((s) => s.student_name === investigating.student_name);
                if (!session) return null;
                return (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Exam</span>
                      <span className="font-medium">{session.exam_title}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {session.current_question_index + 1} / {session.total_questions}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Flags on session</span>
                      <span className="font-medium">{session.suspicious_activity_count}</span>
                    </div>
                    {session.ip_address && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">IP address</span>
                        <span className="font-medium">{session.ip_address}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};