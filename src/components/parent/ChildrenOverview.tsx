import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChildren } from '@/contexts/ChildContext';
import { LinkChildDialog } from './LinkChildDialog';
import { UserPlus, GraduationCap, Calendar, Loader2, User } from 'lucide-react';

const age = (dob?: string | null) => {
  if (!dob) return '';
  const d = new Date(dob); const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
};

export const ChildrenOverview: React.FC = () => {
  const { children, loading, setSelectedChildId } = useChildren();
  const [openLink, setOpenLink] = useState(false);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Your children</h2>
          <p className="text-sm text-muted-foreground">{children.length} linked</p>
        </div>
        <Button onClick={() => setOpenLink(true)}><UserPlus className="h-4 w-4 mr-2" /> Link a child</Button>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-1">No children linked yet</p>
            <p className="text-sm text-muted-foreground mb-4">Link your child with their admission number and date of birth.</p>
            <Button onClick={() => setOpenLink(true)}><UserPlus className="h-4 w-4 mr-2" /> Link a child</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {children.map(c => (
            <Card key={c.student_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedChildId(c.student_id)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary text-primary-foreground">{c.full_name?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</AvatarFallback></Avatar>
                  <div>
                    <CardTitle className="text-base">{c.full_name}</CardTitle>
                    <CardDescription>{c.admission_number}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-muted-foreground" /> {c.class_name || 'Not assigned'}</div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Age: {age(c.date_of_birth)}</div>
                <div className="flex gap-2 pt-1">
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status || 'active'}</Badge>
                  {c.gender && <Badge variant="outline">{c.gender}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LinkChildDialog open={openLink} onOpenChange={setOpenLink} />
    </div>
  );
};