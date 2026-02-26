"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Send,
  Variable,
  Monitor,
  Smartphone,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  saveCommunicationTemplate,
  deleteCommunicationTemplate,
  testCommunicationTemplate,
} from "@/app/actions/communication-templates";
import type { StepConditions } from "@/lib/journey-engine/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Channel = "EMAIL" | "SMS" | "WHATSAPP";
type Trigger =
  | "JOURNEY_ASSIGNED"
  | "IDENTITY_FLIP"
  | "SSO_AUTHENTICATED"
  | "MANUAL_TEST";

interface TemplateData {
  id: string;
  name: string;
  channel: Channel;
  trigger: Trigger;
  subject: string | null;
  bodyContent: string;
  isActive: boolean;
  conditions: StepConditions | null;
}

interface Props {
  template: TemplateData | null;
}

interface ConditionRow {
  id: number;
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_OPTIONS: { value: Trigger; label: string }[] = [
  {
    value: "JOURNEY_ASSIGNED",
    label: "Al asignar el Journey (Día 1 / Bienvenida)",
  },
  {
    value: "IDENTITY_FLIP",
    label: "Al confirmar el correo corporativo",
  },
  {
    value: "SSO_AUTHENTICATED",
    label: "Al realizar el primer inicio de sesión",
  },
];

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Correo Electrónico" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

const CONDITION_KEY_OPTIONS: { value: string; label: string }[] = [
  { value: "country", label: "País" },
  { value: "cluster", label: "Cluster" },
  { value: "position", label: "Cargo" },
  { value: "userStatus", label: "Estado del usuario" },
  { value: "tags", label: "Etiqueta" },
];

const AVAILABLE_VARIABLES = [
  { key: "{{user.firstName}}", desc: "Primer nombre" },
  { key: "{{user.lastName}}", desc: "Apellido(s)" },
  { key: "{{user.email}}", desc: "Email personal" },
  { key: "{{user.corporateEmail}}", desc: "Email corporativo" },
];

const SMS_MAX_CHARS = 160;
const WA_MAX_CHARS = 4096;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a StepConditions object into ConditionRow[] for the visual builder */
function conditionsToRows(cond: StepConditions | null): ConditionRow[] {
  if (!cond) return [];
  const rows: ConditionRow[] = [];
  let nextId = 1;

  for (const [key, val] of Object.entries(cond)) {
    if (Array.isArray(val)) {
      for (const v of val) {
        rows.push({ id: nextId++, key, value: String(v) });
      }
    } else if (val !== undefined && val !== null) {
      rows.push({ id: nextId++, key, value: String(val) });
    }
  }
  return rows;
}

/** Convert ConditionRow[] back into a StepConditions-compatible object */
function rowsToConditions(
  rows: ConditionRow[]
): Record<string, unknown> | null {
  const filtered = rows.filter((r) => r.key && r.value.trim());
  if (filtered.length === 0) return null;

  const result: Record<string, string[]> = {};
  for (const row of filtered) {
    if (!result[row.key]) result[row.key] = [];
    result[row.key].push(row.value.trim());
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateBuilder({ template }: Props) {
  const router = useRouter();
  const isNew = !template;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Radix hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Form state
  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<Channel>(
    template?.channel ?? "EMAIL"
  );
  const [trigger, setTrigger] = useState<Trigger>(
    template?.trigger ?? "JOURNEY_ASSIGNED"
  );
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyContent, setBodyContent] = useState(template?.bodyContent ?? "");
  const [conditionRows, setConditionRows] = useState<ConditionRow[]>(
    conditionsToRows(template?.conditions ?? null)
  );
  const [nextRowId, setNextRowId] = useState(
    conditionRows.length > 0
      ? Math.max(...conditionRows.map((r) => r.id)) + 1
      : 1
  );
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "mobile"
  );

  // Test send
  const [testRecipient, setTestRecipient] = useState("");

  // Transitions
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Click-to-insert variable at cursor
  // ---------------------------------------------------------------------------

  const insertVariable = useCallback(
    (variable: string) => {
      const textarea = bodyRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = bodyContent.slice(0, start);
      const after = bodyContent.slice(end);
      const updated = before + variable + after;

      setBodyContent(updated);

      // Restore cursor position after the inserted variable
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + variable.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [bodyContent]
  );

  if (!mounted) return null;

  // ---------------------------------------------------------------------------
  // Condition row handlers
  // ---------------------------------------------------------------------------

  function addConditionRow() {
    setConditionRows((prev) => [
      ...prev,
      { id: nextRowId, key: "country", value: "" },
    ]);
    setNextRowId((n) => n + 1);
  }

  function removeConditionRow(id: number) {
    setConditionRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateConditionRow(
    id: number,
    field: "key" | "value",
    val: string
  ) {
    setConditionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSave() {
    if (!name.trim() || !bodyContent.trim()) {
      toast.error("Nombre y contenido son requeridos");
      return;
    }

    const parsedConditions = rowsToConditions(conditionRows);

    startSaveTransition(async () => {
      const result = await saveCommunicationTemplate({
        id: template?.id,
        name: name.trim(),
        channel,
        trigger,
        subject: channel === "EMAIL" ? subject.trim() || null : null,
        bodyContent,
        conditions: parsedConditions,
      });

      toast.success(isNew ? "Plantilla creada" : "Plantilla guardada");

      if (isNew) {
        router.push(`/admin/communications/${result.id}`);
      }
    });
  }

  function handleDelete() {
    if (!template) return;
    startDeleteTransition(async () => {
      await deleteCommunicationTemplate(template.id);
      toast.success("Plantilla eliminada");
      router.push("/admin/communications");
    });
  }

  function handleTestSend() {
    if (!template) {
      toast.error("Guarda la plantilla primero");
      return;
    }
    if (!testRecipient.trim()) {
      toast.error("Ingresa un destinatario de prueba");
      return;
    }
    startTestTransition(async () => {
      const result = await testCommunicationTemplate(
        template.id,
        testRecipient.trim()
      );
      toast.success(`[MOCK] ${result.channel} enviado a ${result.recipient}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Preview interpolation (live)
  // ---------------------------------------------------------------------------

  const previewVars: Record<string, string> = {
    "user.firstName": "Juan",
    "user.lastName": "Pérez",
    "user.email": "juan.perez@gmail.com",
    "user.corporateEmail": "juan.perez@farmatodo.com",
  };

  function liveInterpolate(text: string) {
    return text.replace(
      /\{\{(\w+(?:\.\w+)*)\}\}/g,
      (_m, key: string) => previewVars[key] ?? `{{${key}}}`
    );
  }

  const previewBody = liveInterpolate(bodyContent);
  const previewSubject = liveInterpolate(subject);

  // Character count for SMS/WA
  const charCount = bodyContent.length;
  const charMax = channel === "SMS" ? SMS_MAX_CHARS : WA_MAX_CHARS;
  const isOverLimit = channel !== "EMAIL" && charCount > charMax;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/communications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {isNew ? "Nueva Plantilla" : "Editar Plantilla"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Configura el canal, momento de envío y contenido"
                : template.name}
            </p>
          </div>
        </div>
        {!isNew && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Eliminar
          </Button>
        )}
      </div>

      {/* Split Screen */}
      <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-[5fr_7fr]">
        {/* LEFT — Configuration Form */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Nombre de la plantilla
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bienvenida — Email inicial"
              className="text-sm"
            />
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label className="text-xs">Canal</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as Channel)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label className="text-xs">Momento de Envío (Trigger)</Label>
            <Select
              value={trigger}
              onValueChange={(v) => setTrigger(v as Trigger)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject (email only) */}
          {channel === "EMAIL" && (
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs">
                Asunto del correo
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Bienvenido a Farmatodo, {{user.firstName}}"
                className="text-sm"
              />
            </div>
          )}

          {/* Body Content */}
          <div className="space-y-1.5">
            <Label htmlFor="body" className="text-xs">
              {channel === "EMAIL" ? "Contenido HTML" : "Mensaje de Texto"}
            </Label>
            <Textarea
              ref={bodyRef}
              id="body"
              value={bodyContent}
              onChange={(e) => setBodyContent(e.target.value)}
              placeholder={
                channel === "EMAIL"
                  ? "<html>\n  <body>\n    <h1>Hola {{user.firstName}}</h1>\n  </body>\n</html>"
                  : "Hola {{user.firstName}}, bienvenido a Farmatodo."
              }
              className={`resize-none font-mono text-sm ${
                channel === "EMAIL"
                  ? "h-[500px] overflow-y-auto"
                  : "min-h-[120px]"
              }`}
            />
            {channel !== "EMAIL" && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {channel === "SMS"
                    ? "Los SMS se segmentan cada 160 caracteres."
                    : "Límite de WhatsApp: 4,096 caracteres."}
                </p>
                <span
                  className={`text-[10px] font-medium ${
                    isOverLimit ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {charCount} / {charMax.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Click-to-Insert Variables */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Variable className="h-3.5 w-3.5" />
                Variables — clic para insertar
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <code className="text-[10px] font-semibold text-primary">
                      {v.key}
                    </code>
                    <span className="text-[10px] text-muted-foreground">
                      {v.desc}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Visual Condition Builder */}
          <div className="space-y-2">
            <Label className="text-xs">
              Condiciones de envío{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>

            {conditionRows.length > 0 && (
              <div className="space-y-2">
                {conditionRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <Select
                      value={row.key}
                      onValueChange={(v) =>
                        updateConditionRow(row.id, "key", v)
                      }
                    >
                      <SelectTrigger className="w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_KEY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) =>
                        updateConditionRow(row.id, "value", e.target.value)
                      }
                      placeholder={
                        row.key === "country"
                          ? "VE, CO, AR"
                          : row.key === "userStatus"
                            ? "PRE_HIRE, ACTIVE"
                            : "Valor"
                      }
                      className="flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeConditionRow(row.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={addConditionRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar Condición
            </Button>

            {conditionRows.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Condiciones con la misma clave se evalúan con lógica OR (ej.
                País = VE o CO). Claves distintas se evalúan con lógica AND.
              </p>
            )}
          </div>

          {/* Submit — bottom of form */}
          <div className="flex justify-end border-t pt-4">
            <Button
              className="gap-1.5 px-8"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isNew ? "Crear Plantilla" : "Guardar Cambios"}
            </Button>
          </div>
        </div>

        {/* RIGHT — Live Preview Panel */}
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          {/* Preview toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Vista Previa
            </span>
            {channel === "EMAIL" && (
              <div className="flex items-center gap-1 rounded-lg border bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    previewDevice === "desktop"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-3 w-3" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    previewDevice === "mobile"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="h-3 w-3" />
                  Mobile
                </button>
              </div>
            )}
          </div>

          {/* Preview container */}
          <div className="w-full overflow-hidden rounded-2xl border-2 border-muted shadow-sm">
            {channel === "EMAIL" ? (
              <EmailPreview
                subject={previewSubject}
                body={previewBody}
                device={previewDevice}
              />
            ) : (
              <MessagingPreview body={previewBody} channel={channel} />
            )}
          </div>

          {/* Test Send */}
          {!isNew && (
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Send className="h-3.5 w-3.5" />
                Envío de prueba
              </p>
              <div className="flex gap-2">
                <Input
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder={
                    channel === "EMAIL"
                      ? "test@example.com"
                      : "+584141234567"
                  }
                  className="text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 text-xs"
                  onClick={handleTestSend}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Enviar test
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Envío mock — se registrará en la consola del servidor.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Email Preview (iframe)
// ---------------------------------------------------------------------------

function EmailPreview({
  subject,
  body,
  device,
}: {
  subject: string;
  body: string;
  device: "desktop" | "mobile";
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Email chrome bar */}
      <div className="border-b bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        {subject && <p className="mt-2 text-xs font-medium">{subject}</p>}
        <p className="text-[10px] text-muted-foreground">
          De: onboarding@farmatodo.com
        </p>
      </div>
      {/* iframe body */}
      <div className="bg-[#f5f5f7] p-4">
        <iframe
          srcDoc={
            body ||
            "<p style='color:#999;font-family:sans-serif;text-align:center;padding:40px'>Vista previa del HTML aquí...</p>"
          }
          title="Email preview"
          sandbox="allow-same-origin"
          className={`h-[700px] border-none bg-white ${
            device === "mobile" ? "mx-auto w-[375px] max-w-full" : "w-full"
          }`}
          style={{
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMS / WhatsApp Chat Bubble Preview
// ---------------------------------------------------------------------------

function MessagingPreview({
  body,
  channel,
}: {
  body: string;
  channel: "SMS" | "WHATSAPP";
}) {
  const isWA = channel === "WHATSAPP";

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Phone chrome */}
      <div
        className={`px-4 py-2.5 text-xs font-medium text-white ${
          isWA ? "bg-[#075E54]" : "bg-[#007AFF]"
        }`}
      >
        <div className="flex items-center justify-between">
          <span>{isWA ? "WhatsApp" : "Mensajes"}</span>
          <Badge variant="secondary" className="text-[10px]">
            {channel}
          </Badge>
        </div>
      </div>
      {/* Chat area */}
      <div
        className={`min-h-[300px] p-4 ${
          isWA ? "bg-[#ECE5DD]" : "bg-[#f5f5f7]"
        }`}
      >
        {body ? (
          <div className="flex justify-end">
            <div
              className={`max-w-[280px] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                isWA
                  ? "rounded-tr-sm bg-[#DCF8C6] text-gray-900"
                  : "rounded-tr-sm bg-[#007AFF] text-white"
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                {body}
              </p>
              <p
                className={`mt-1 text-right text-[10px] ${
                  isWA ? "text-gray-500" : "text-blue-100"
                }`}
              >
                {new Date().toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Escribe un mensaje para ver la vista previa...
          </p>
        )}
      </div>
    </div>
  );
}
