import { Check, ChevronsUpDown, Plus, Smartphone } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInstances } from "@/hooks/use-instances";
import { formatPhone } from "@/lib/format";

export function InstanceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { instances, current, currentId, setCurrentId } = useInstances();
  const navigate = useNavigate();

  if (!current) return null;

  if (collapsed) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground" title={current.instance_name}>
        <Smartphone className="h-4 w-4" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-auto py-2 px-2 font-normal">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="h-4 w-4 shrink-0 text-primary" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[140px]">{current.instance_name}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{formatPhone(current.whatsapp_number)}</span>
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        {instances.map((i) => (
          <DropdownMenuItem key={i.id} onClick={() => setCurrentId(i.id)} className="flex items-start gap-2 py-2">
            <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{i.instance_name}</span>
                <StatusDot status={i.status} />
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{formatPhone(i.whatsapp_number)}</div>
            </div>
            {i.id === currentId && <Check className="h-4 w-4 text-primary mt-0.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/onboarding", search: { next: "back" } })} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Nova instância</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "connected" ? "bg-success" :
    status === "connecting" ? "bg-warning" : "bg-muted-foreground/50";
  const label =
    status === "connected" ? "Conectada" :
    status === "connecting" ? "Conectando" : "Desconectada";
  return (
    <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-1 border-border">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </Badge>
  );
}