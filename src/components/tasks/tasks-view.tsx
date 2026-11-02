'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Loader2, Trash2, ListTodo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFormState } from 'react-dom';
import { useTransition } from 'react';
import {
  saveTask,
  updateTaskStatus,
  deleteTask,
  type TaskDto,
} from '@/app/tasks/actions';

const TASK_TYPES = [
  { value: 'CALL_BACK', label: 'Call back' },
  { value: 'SEND_FOLLOW_UP', label: 'Send follow-up' },
  { value: 'REVIEW_CONVERSATION', label: 'Review conversation' },
  { value: 'VERIFY_LEAD', label: 'Verify lead' },
  { value: 'ESCALATION', label: 'Escalation' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer support' },
  { value: 'APPOINTMENT_CONFIRMATION', label: 'Appointment confirmation' },
];

const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function typeLabel(type: string) {
  return TASK_TYPES.find((t) => t.value === type)?.label ?? type;
}

const TaskForm = ({
  contacts,
  members,
  onFormSuccess,
}: {
  contacts: { id: string; name: string }[];
  members: { id: string; name: string }[];
  onFormSuccess: () => void;
}) => {
  const [state, formAction] = useFormState(saveTask, null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  React.useEffect(() => {
    if (state?.status === 'success') {
      toast({ title: 'Success', description: state.message });
      onFormSuccess();
    } else if (state?.status === 'error' && state.message) {
      toast({ variant: 'destructive', title: 'Error', description: state.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={(formData) => startTransition(() => formAction(formData))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="t-title">Title *</Label>
        <Input id="t-title" name="title" placeholder="e.g. Call back about pricing" required minLength={2} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-type">Type</Label>
          <Select name="type" defaultValue="CALL_BACK">
            <SelectTrigger id="t-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-priority">Priority</Label>
          <Select name="priority" defaultValue="MEDIUM">
            <SelectTrigger id="t-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-assignee">Assignee</Label>
          <Select name="assigneeId" defaultValue={members[0]?.id ?? ''}>
            <SelectTrigger id="t-assignee">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-contact">Related contact</Label>
          <Select name="contactId" defaultValue="">
            <SelectTrigger id="t-contact">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-due">Due date</Label>
          <Input id="t-due" name="dueDate" type="datetime-local" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="t-description">Description</Label>
        <Input id="t-description" name="description" placeholder="Optional details" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Create task
        </Button>
      </DialogFooter>
    </form>
  );
};

export function TasksView({
  tasks,
  contacts,
  members,
  canWrite,
  currentUserId,
  activeTab,
}: {
  tasks: TaskDto[];
  contacts: { id: string; name: string }[];
  members: { id: string; name: string }[];
  canWrite: boolean;
  currentUserId: string;
  activeTab: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  const setTab = (status: string) => {
    router.push(status === 'ALL' ? '/tasks' : `/tasks?status=${status}`);
  };

  const handleStatus = (taskId: string, status: string) => {
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, status);
      if (result.success) {
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const handleDelete = (taskId: string) => {
    startTransition(async () => {
      const result = await deleteTask(taskId);
      if (result.success) {
        toast({ title: 'Task deleted' });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {canWrite && (
<Button size="sm" variant="brand" className="sm:ml-auto" onClick={() => setIsFormOpen(true)}>
<Plus />
New task
          </Button>
        )}
      </div>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden lg:table-cell">Assignee</TableHead>
              <TableHead className="hidden lg:table-cell">Due</TableHead>
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length > 0 ? (
              tasks.map((task) => {
                const overdue =
                  task.dueDate &&
                  new Date(task.dueDate) < new Date() &&
                  task.status !== 'COMPLETED' &&
                  task.status !== 'CANCELLED';
                return (
                  <TableRow key={task.$id}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{task.title}</div>
                        {task.contactName && (
                          <div className="truncate text-xs text-muted-foreground">
                            for {task.contactName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {typeLabel(task.type)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {task.assigneeName || 'Unassigned'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {task.dueDate ? (
                        <span className={overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          task.status === 'COMPLETED'
                            ? 'secondary'
                            : task.status === 'CANCELLED'
                              ? 'outline'
                              : 'default'
                        }
                      >
                        {task.status}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Task actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {['TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED']
                              .filter((s) => s !== task.status)
                              .map((status) => (
                                <DropdownMenuItem key={status} onSelect={() => handleStatus(task.$id, status)}>
                                  Mark {status.replace('_', ' ').toLowerCase()}
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(task.$id)}>
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ListTodo className="size-6 text-muted-foreground" />
                    <p className="text-sm font-medium">No tasks here</p>
                    <p className="text-xs text-muted-foreground">
                      Tasks created by your team, AI agents, and workflows will appear here.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Assign follow-up work to yourself or a teammate.</DialogDescription>
          </DialogHeader>
          <TaskForm
            contacts={contacts}
            members={members}
            onFormSuccess={() => {
              setIsFormOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
