import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { PmPackage } from "@prisma/client";
import { serviceDateToMonthRef } from "@/lib/pmCycleRef";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import {
  canAccessClientId,
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from "@/lib/clientScope";
import { recordAudit } from "@/lib/auditServer";
import {
  genTicketCode,
  isStaffUser,
  supportTicketUserDisplayName,
} from "@/lib/supportTickets";

export const dynamic = "force-dynamic";

function serializeTicketListItem(ticket: {
  id: string;
  code: string;
  subject: string;
  status: string;
  priority: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  assignedToId: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  rating: number | null;
  _count: { messages: number };
}) {
  return {
    id: ticket.id,
    code: ticket.code,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    requesterName: ticket.requesterName,
    requesterEmail: ticket.requesterEmail,
    assignedToId: ticket.assignedToId,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
    rating: ticket.rating ?? null,
    messageCount: ticket._count.messages,
  };
}

function serializeTicket(ticket: {
  id: string;
  code: string;
  subject: string;
  category: string | null;
  status: string;
  priority: string | null;
  requesterId: string;
  requesterName: string | null;
  requesterRole: string | null;
  requesterEmail: string | null;
  assignedToId: string | null;
  propertyId: string | null;
  clientId: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}) {
  return {
    ...ticket,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
  };
}

/** GET /api/support-tickets — list tickets (staff: all in scope; portal: own only) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const scope = getClientScopeWhere(scopeUser);
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const where: Prisma.SupportTicketWhereInput = {
      ...scope,
      ...(isStaffUser(user) ? {} : { requesterId: user.id }),
      ...(statusFilter && String(statusFilter).trim() !== ""
        ? { status: String(statusFilter).trim() }
        : {}),
    };

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        code: true,
        subject: true,
        status: true,
        priority: true,
        requesterName: true,
        requesterEmail: true,
        assignedToId: true,
        lastMessageAt: true,
        createdAt: true,
        rating: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      tickets: tickets.map(serializeTicketListItem),
    });
  } catch (e) {
    console.error("[GET /api/support-tickets]", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

/** POST /api/support-tickets — open ticket + first message */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const subject = body.subject;
    const messageBody = body.body;
    const category = body.category;
    const priority = body.priority;
    const propertyId = body.propertyId;
    const attachments = body.attachments;
    const bodyClientId = body.clientId;

    if (subject == null || String(subject).trim() === "") {
      return NextResponse.json(
        { ok: false, error: "subject required" },
        { status: 400 },
      );
    }
    if (messageBody == null || String(messageBody).trim() === "") {
      return NextResponse.json(
        { ok: false, error: "body required" },
        { status: 400 },
      );
    }

    const scopeUser = toClientScopeUser(user);
    const scopedCreate = getClientScopeForCreate(scopeUser);
    let clientId: string | null = scopedCreate;
    if (scopedCreate === null && user.role === "super_admin") {
      const raw =
        bodyClientId != null && String(bodyClientId).trim() !== ""
          ? String(bodyClientId).trim()
          : user.clientId;
      clientId = raw;
    }

    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: "clientId required" },
        { status: 400 },
      );
    }

    if (!canAccessClientId(scopeUser, clientId)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const now = new Date();
    const requesterName = supportTicketUserDisplayName(user);
    const trimmedSubject = String(subject).trim();
    const trimmedBody = String(messageBody).trim();
    const staff = isStaffUser(user);

    const ticket = await prisma.$transaction(async (tx) => {
      let created: Awaited<ReturnType<typeof tx.supportTicket.create>> | null =
        null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const code = await genTicketCode(tx, now);
        try {
          created = await tx.supportTicket.create({
            data: {
              code,
              subject: trimmedSubject,
              category:
                category != null && String(category).trim() !== ""
                  ? String(category).trim()
                  : null,
              status: "open",
              priority:
                priority != null && String(priority).trim() !== ""
                  ? String(priority).trim()
                  : "normal",
              requesterId: user.id,
              requesterName,
              requesterRole: user.role,
              requesterEmail: user.email,
              propertyId:
                propertyId != null && String(propertyId).trim() !== ""
                  ? String(propertyId).trim()
                  : null,
              clientId,
              lastMessageAt: now,
            },
          });
          break;
        } catch (err) {
          const codeErr = err as { code?: string };
          if (codeErr?.code === "P2002" && attempt < 4) continue;
          throw err;
        }
      }

      if (!created) {
        throw new Error("Failed to create support ticket");
      }

      await tx.supportTicketMessage.create({
        data: {
          ticketId: created.id,
          authorId: user.id,
          authorName: requesterName,
          authorRole: user.role,
          body: trimmedBody,
          attachments:
            attachments === undefined
              ? undefined
              : attachments === null
                ? Prisma.JsonNull
                : (attachments as Prisma.InputJsonValue),
          isStaff: staff,
          authorClientId: user.clientId ?? null,
          clientId,
        },
      });

      return created;
    });

    // Chamado aberto por um inquilino (tenant) com imóvel definido entra na fila de
    // manutenção como job PENDING (preço 0 — os autorizados definem depois via MGR).
    // Rastreável por metadata.fromTicketId; falha aqui NÃO quebra o chamado.
    let linkedJobNumber: number | null = null;
    if (String(user.role || "").toLowerCase() === "tenant") {
      // Imóvel do job: o do chamado, ou o do próprio inquilino (fallback).
      let jobPropertyId: string | null = ticket.propertyId;
      if (!jobPropertyId && user.tenantId) {
        const t = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: { propertyId: true },
        });
        jobPropertyId = t?.propertyId ?? null;
      }
      if (jobPropertyId)
        try {
          const svcDate = now;
          const monthRef =
            serviceDateToMonthRef(svcDate.toISOString().slice(0, 10)) ||
            svcDate.toISOString().slice(0, 7);
          await prisma.$transaction(async (tx) => {
            let jobNumber: number | null = null;
            if (clientId) {
              const c = await tx.client.update({
                where: { id: clientId },
                data: { lastJobNumber: { increment: 1 } },
                select: { lastJobNumber: true },
              });
              jobNumber = c.lastJobNumber;
            }
            await tx.pmExpense.create({
              data: {
                propertyId: jobPropertyId,
                clientId,
                serviceType: "Manutenção",
                packageApplied: "PACOTE_4" as PmPackage,
                vendorCost: 0,
                ownerCharged: 0,
                serviceDate: svcDate,
                monthRef,
                status: "PENDING",
                description: trimmedSubject,
                metadata: {
                  fromTicketId: ticket.id,
                  fromTicketCode: ticket.code,
                },
                ...(jobNumber != null ? { jobNumber } : {}),
              },
            });
            linkedJobNumber = jobNumber;
          });
        } catch (jobErr) {
          console.error(
            "[support-tickets] falha ao criar job do chamado",
            jobErr,
          );
        }
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: "ticket.create",
      entity: "support_ticket",
      entityId: ticket.id,
      clientId,
      details: JSON.stringify({
        code: ticket.code,
        subject: trimmedSubject,
        category: category ?? null,
        linkedJobNumber,
      }),
    });

    return NextResponse.json({
      ok: true,
      ticket: serializeTicket(ticket),
      linkedJobNumber,
    });
  } catch (e) {
    console.error("[POST /api/support-tickets]", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
