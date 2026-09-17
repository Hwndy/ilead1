import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Award } from "lucide-react";
interface ApplicationWithScore {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  combined_score: number | null;
  merit_rank: number | null;
  nin?: string | null;
  documents_status?: string | null;
}

export const AdmissionDecisionBoard = () => {
  const [applications, setApplications] = useState<ApplicationWithScore[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [cutoffScore, setCutoffScore] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const base = "id, application_number, first_name, last_name, email, status, combined_score, merit_rank";
      let { data, error } = await (supabase as any)
        .from("admission_applications")
        .select(`${base}, nin, documents_status`)
        .in("status", ["under_review", "interview_scheduled"])
        .order("combined_score", { ascending: false, nullsFirst: false });

      if (error) {
        // Database not updated with the admissions fields yet.
        const fallback = await supabase
          .from("admission_applications")
          .select(base)
          .in("status", ["under_review", "interview_scheduled"])
          .order("combined_score", { ascending: false, nullsFirst: false });
        if (fallback.error) throw fallback.error;
        data = fallback.data as any;
      }
      setApplications((data || []) as ApplicationWithScore[]);
    } catch (error: any) {
      toast.error("Failed to load applications: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateMeritRanks = async () => {
    try {
      const sortedApps = [...applications].sort((a, b) => 
        (b.combined_score || 0) - (a.combined_score || 0)
      );

      for (let i = 0; i < sortedApps.length; i++) {
        await supabase
          .from("admission_applications")
          .update({ merit_rank: i + 1 })
          .eq("id", sortedApps[i].id);
      }

      toast.success("Merit ranks calculated successfully");
      fetchApplications();
    } catch (error: any) {
      toast.error("Failed to calculate ranks: " + error.message);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedApps.length === 0) {
      toast.error("Please select applications to approve");
      return;
    }

    try {
      const { error } = await supabase
        .from("admission_applications")
        .update({ status: "accepted" })
        .in("id", selectedApps);

      if (error) throw error;

      toast.success(`${selectedApps.length} applications approved`);
      setSelectedApps([]);
      fetchApplications();
    } catch (error: any) {
      toast.error("Failed to approve applications: " + error.message);
    }
  };

  const handleBulkReject = async () => {
    if (selectedApps.length === 0) {
      toast.error("Please select applications to reject");
      return;
    }

    try {
      const { error } = await supabase
        .from("admission_applications")
        .update({ status: "rejected" })
        .in("id", selectedApps);

      if (error) throw error;

      toast.success(`${selectedApps.length} applications rejected`);
      setSelectedApps([]);
      fetchApplications();
    } catch (error: any) {
      toast.error("Failed to reject applications: " + error.message);
    }
  };

  const handleAutoCutoff = async () => {
    if (!cutoffScore) {
      toast.error("Please enter a cutoff score");
      return;
    }

    const threshold = parseFloat(cutoffScore);
    const qualified = applications.filter(app => (app.combined_score || 0) >= threshold);

    try {
      // Approve qualified
      if (qualified.length > 0) {
        await supabase
          .from("admission_applications")
          .update({ status: "accepted" })
          .in("id", qualified.map(app => app.id));
      }

      // Reject unqualified
      const unqualified = applications.filter(app => (app.combined_score || 0) < threshold);
      if (unqualified.length > 0) {
        await supabase
          .from("admission_applications")
          .update({ status: "rejected" })
          .in("id", unqualified.map(app => app.id));
      }

      toast.success(`Auto-processed: ${qualified.length} accepted, ${unqualified.length} rejected`);
      fetchApplications();
    } catch (error: any) {
      toast.error("Failed to apply cutoff: " + error.message);
    }
  };

  const toggleSelection = (appId: string) => {
    setSelectedApps(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading applications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admission Decision Board</h2>
          <p className="text-muted-foreground">Review and approve/reject applications</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviewed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{applications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedApps.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Auto Cutoff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="number"
              placeholder="Score"
              value={cutoffScore}
              onChange={(e) => setCutoffScore(e.target.value)}
            />
            <Button size="sm" className="w-full" onClick={handleAutoCutoff}>
              Apply
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" className="w-full" onClick={calculateMeritRanks}>
              Calculate Ranks
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Applications</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={selectedApps.length === 0}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkReject}
                disabled={selectedApps.length === 0}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Selected
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedApps.includes(app.id)}
                      onCheckedChange={() => toggleSelection(app.id)}
                    />
                  </TableCell>
                  <TableCell className="font-bold">#{app.merit_rank || "-"}</TableCell>
                  <TableCell className="font-medium">{app.application_number}</TableCell>
                  <TableCell>
                    {app.first_name} {app.last_name}
                    <div className="text-sm text-muted-foreground">{app.email}</div>
                  </TableCell>
                  <TableCell className="font-bold text-lg">
                    {app.combined_score?.toFixed(2) || "N/A"}
                  </TableCell>
                  <TableCell className="capitalize">{app.status.replace('_', ' ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
