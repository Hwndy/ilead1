import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Download, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  verified: boolean;
  verified_at: string | null;
  uploaded_at: string;
  mime_type: string | null;
  verification_status?: string | null;
  rejection_reason?: string | null;
}

interface AdmissionDocumentViewerProps {
  applicationId: string;
}

export const AdmissionDocumentViewer = ({ applicationId }: AdmissionDocumentViewerProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchDocuments();
  }, [applicationId]);

  const fetchDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_application_documents", {
        p_application_id: applicationId,
      });

      if (error) {
        console.error("Error fetching documents:", error);
        toast.error(error.message || "Failed to load documents");
        setDocuments([]);
      } else {
        setDocuments(((data as unknown) as Document[]) || []);
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const statusOf = (doc: Document) =>
    doc.verification_status || (doc.verified ? "verified" : "pending");

  const handleReview = async (docId: string, status: "verified" | "rejected") => {
    if (status === "rejected" && !(notes[docId] || "").trim()) {
      toast.error("Please type the reason for rejecting this document");
      return;
    }
    setVerifyingDoc(docId);
    try {
      const { error } = await (supabase as any).rpc("review_admission_document", {
        p_document_id: docId,
        p_status: status,
        p_reason: status === "rejected" ? notes[docId] : null,
      });

      if (error) throw error;

      toast.success(status === "verified" ? "Document verified" : "Document rejected");
      setNotes((prev) => ({ ...prev, [docId]: "" }));
      fetchDocuments();
    } catch (error: any) {
      const message: string = error?.message || "unknown error";
      toast.error(
        /review_admission_document|schema cache|function/i.test(message)
          ? "The database still needs the admissions update (db/phase5-admissions.sql)."
          : "Failed to update document: " + message,
      );
    } finally {
      setVerifyingDoc(null);
    }
  };

  const resolveObjectPath = (fileUrl: string) => {
    const marker = "/admission-documents/";
    const idx = fileUrl.indexOf(marker);
    if (idx !== -1) return fileUrl.slice(idx + marker.length);
    return fileUrl.replace(/^admission-documents\//, "");
  };

  const openInNewTab = async (fileUrl: string) => {
    try {
      if (/^https?:\/\//i.test(fileUrl)) {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const path = resolveObjectPath(fileUrl);
      const { data, error } = await supabase.storage
        .from("admission-documents")
        .createSignedUrl(path, 60 * 10);
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const pub = supabase.storage.from("admission-documents").getPublicUrl(path);
      if (pub.data?.publicUrl) {
        window.open(pub.data.publicUrl, "_blank", "noopener,noreferrer");
        return;
      }
      throw error ?? new Error("Unable to build URL");
    } catch (error: any) {
      toast.error("Failed to open document: " + (error?.message || "unknown error"));
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      if (/^https?:\/\//i.test(fileUrl)) {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const path = resolveObjectPath(fileUrl);
      const { data, error } = await supabase.storage
        .from("admission-documents")
        .download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Failed to download document: " + (error?.message || "unknown error"));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No documents uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {doc.document_type}
                </CardTitle>
                <CardDescription>{doc.document_name}</CardDescription>
              </div>
              {statusOf(doc) === "verified" ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </Badge>
              ) : statusOf(doc) === "rejected" ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Rejected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Pending
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(doc.file_url, doc.document_name)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openInNewTab(doc.file_url)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview
              </Button>
              {statusOf(doc) !== "verified" && (
                <Button
                  size="sm"
                  onClick={() => handleReview(doc.id, "verified")}
                  disabled={verifyingDoc === doc.id}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify
                </Button>
              )}
              {statusOf(doc) !== "rejected" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReview(doc.id, "rejected")}
                  disabled={verifyingDoc === doc.id}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              )}
            </div>
            {statusOf(doc) === "rejected" && doc.rejection_reason && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <span className="font-medium">Reason: </span>{doc.rejection_reason}
              </div>
            )}
            {statusOf(doc) !== "verified" && (
              <Textarea
                rows={2}
                placeholder="Reason, if you are rejecting this document"
                value={notes[doc.id] || ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))}
              />
            )}
            <div className="text-sm text-muted-foreground">
              Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
              {doc.verified_at && ` • Reviewed: ${new Date(doc.verified_at).toLocaleDateString()}`}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
