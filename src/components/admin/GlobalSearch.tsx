import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from '@/components/ui/command';
import { useNavigate } from 'react-router-dom';

type Results = {
  students: any[]; staff: any[]; parents: any[]; applications: any[];
};

export const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>({ students: [], staff: [], parents: [], applications: [] });
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open || q.length < 2) { setResults({ students: [], staff: [], parents: [], applications: [] }); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('global_search', { q });
      if (data) setResults(data as unknown as Results);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search students, staff, parents, applications…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{q.length < 2 ? 'Type at least 2 characters.' : 'No results.'}</CommandEmpty>
        {results.students.length > 0 && (
          <CommandGroup heading="Students">
            {results.students.map((s) => (
              <CommandItem key={s.id} onSelect={() => go(`/admin?tab=academic&subtab=student-detail&id=${s.id}`)}>
                <span className="font-medium">{s.full_name || 'Unknown'}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.admission_number} • {s.class_name || ''}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.staff.length > 0 && (
          <CommandGroup heading="Staff">
            {results.staff.map((s) => (
              <CommandItem key={s.user_id} onSelect={() => go(`/admin?tab=users`)}>
                <span className="font-medium">{s.full_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.employee_id} • {s.designation || ''}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.parents.length > 0 && (
          <CommandGroup heading="Parents">
            {results.parents.map((p) => (
              <CommandItem key={p.id} onSelect={() => go(`/admin?tab=parents&subtab=list`)}>
                <span className="font-medium">{p.full_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{p.phone_primary || ''}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.applications.length > 0 && (
          <CommandGroup heading="Applications">
            {results.applications.map((a) => (
              <CommandItem key={a.id} onSelect={() => go(`/admin?tab=admissions&subtab=applications`)}>
                <span className="font-medium">{a.first_name} {a.last_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{a.application_number} • {a.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;