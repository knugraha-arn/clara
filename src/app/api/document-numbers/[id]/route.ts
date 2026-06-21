import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

const ROMAN = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

// PATCH — approve, revisi, reject, void, link dokumen, edit draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, full_name").eq("id", user.id).single();

  const { id } = await params;
  const { action, note, documentId, description, approval_consent } = await request.json();

  const { data: docNum } = await supabase
    .from("document_numbers").select("*").eq("id", id).single();

  if (!docNum) return NextResponse.json({ error: "Nomor tidak ditemukan" }, { status: 404 });

  const isAdmin = ["admin", "super_admin"].includes(profile?.role || "");
  const isOwner = docNum.created_by === user.id;
  const docNumLabel = `${docNum.number} — ${docNum.description}`;

  const now = new Date().toISOString();

  // APPROVE
  if (action === "approve") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (docNum.status !== "pending") return NextResponse.json({ error: "Hanya bisa approve status Pending" }, { status: 400 });
    if (!note?.trim()) return NextResponse.json({ error: "Catatan approval wajib diisi" }, { status: 400 });
    if (!approval_consent) return NextResponse.json({ error: "Consent wajib dicentang" }, { status: 400 });

    await supabase.from("document_numbers").update({
      status: "issued",
      reviewed_by: user.id,
      reviewed_by_name: profile?.full_name || user.email,
      reviewed_at: now,
      review_action: "approved",
      review_note: note || null,
      approval_note: note || null,
      approval_consent: true,
      updated_at: now,
    }).eq("id", id);

    await logEvent({
      supabase: adminSupabase,
      documentTitle: docNumLabel,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "number_approved",
      metadata: { number_id: id, number: docNum.number, note },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // REQUEST REVISION
  if (action === "revision") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!note?.trim()) return NextResponse.json({ error: "Catatan revisi wajib diisi" }, { status: 400 });
    if (docNum.status !== "pending") return NextResponse.json({ error: "Hanya bisa revisi status Pending" }, { status: 400 });

    await supabase.from("document_numbers").update({
      status: "draft",
      reviewed_by: user.id,
      reviewed_by_name: profile?.full_name || user.email,
      reviewed_at: now,
      review_action: "revision",
      review_note: note,
      updated_at: now,
    }).eq("id", id);

    await logEvent({
      supabase: adminSupabase,
      documentTitle: docNumLabel,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "number_revision_requested",
      metadata: { number_id: id, number: docNum.number, note },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // REJECT
  if (action === "reject") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!note?.trim()) return NextResponse.json({ error: "Alasan reject wajib diisi" }, { status: 400 });
    if (!["pending"].includes(docNum.status)) return NextResponse.json({ error: "Hanya bisa reject status Pending" }, { status: 400 });

    // Geser sequence nomor yang lebih baru -1
    const { data: afterNums } = await supabase
      .from("document_numbers")
      .select("id, sequence, number, party_name, month, year")
      .eq("year", docNum.year)
      .gt("sequence", docNum.sequence)
      .not("status", "eq", "rejected")
      .not("status", "eq", "void")
      .order("sequence", { ascending: true });

    if (afterNums && afterNums.length > 0) {
      for (const num of afterNums) {
        const newSeq = num.sequence - 1;
        const newNumber = String(newSeq).padStart(3, "0") + "/" + num.party_name + "/" + ROMAN[num.month] + "/" + num.year;
        await adminSupabase.from("document_numbers")
          .update({ sequence: newSeq, number: newNumber, updated_at: now })
          .eq("id", num.id);
      }
    }

    await supabase.from("document_numbers").update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_by_name: profile?.full_name || user.email,
      reviewed_at: now,
      review_action: "rejected",
      review_note: note,
      updated_at: now,
    }).eq("id", id);

    await logEvent({
      supabase: adminSupabase,
      documentTitle: docNumLabel,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "number_rejected",
      metadata: {
        number_id: id,
        number: docNum.number,
        note,
        renumbered_count: afterNums?.length || 0,
        renumbered_ids: afterNums?.map(n => n.id) || [],
      },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // VOID
  if (action === "void") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!note?.trim()) return NextResponse.json({ error: "Alasan void wajib diisi" }, { status: 400 });
    if (["rejected", "void"].includes(docNum.status)) return NextResponse.json({ error: "Tidak bisa void status ini" }, { status: 400 });

    await supabase.from("document_numbers").update({
      status: "void",
      voided_by: user.id,
      voided_by_name: profile?.full_name || user.email,
      voided_at: now,
      void_reason: note,
      updated_at: now,
    }).eq("id", id);

    await logEvent({
      supabase: adminSupabase,
      documentTitle: docNumLabel,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "number_voided",
      metadata: {
        number_id: id,
        number: docNum.number,
        reason: note,
        prior_status: docNum.status,
        was_linked_to_document: docNum.document_id || null,
      },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // RESUBMIT (draft → pending)
  if (action === "resubmit") {
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (docNum.status !== "draft") return NextResponse.json({ error: "Hanya bisa resubmit status Draft" }, { status: 400 });

    await supabase.from("document_numbers").update({
      status: "pending",
      updated_at: now,
    }).eq("id", id);

    await logEvent({
      supabase: adminSupabase,
      documentTitle: docNumLabel,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "number_resubmitted",
      metadata: {
        number_id: id,
        number: docNum.number,
        prior_revision_note: docNum.review_note || null,
      },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // LINK DOKUMEN
  if (action === "link_document") {
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Hanya pembuat nomor surat atau admin yang bisa menautkan dokumen ke nomor ini" }, { status: 403 });
    if (!documentId) return NextResponse.json({ error: "documentId diperlukan" }, { status: 400 });
    if (docNum.status !== "issued") return NextResponse.json({ error: "Hanya bisa link dokumen ke nomor Issued" }, { status: 400 });

    await supabase.from("document_numbers").update({
      document_id: documentId,
      status: "linked",
      updated_at: now,
    }).eq("id", id);

    await logEvent({
      supabase: adminSupabase,
      documentId,
      documentTitle: docNumLabel,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "number_linked",
      metadata: { number_id: id, number: docNum.number },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // EDIT DESCRIPTION (tidak untuk status final: linked, void, rejected)
  if (action === "edit_description") {
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (["linked", "void", "rejected"].includes(docNum.status)) {
      return NextResponse.json({ error: "Tidak bisa edit nomor dengan status final (linked/void/rejected)" }, { status: 400 });
    }

    const oldDescription = docNum.description;
    const newDescription = description || docNum.description;

    await supabase.from("document_numbers").update({
      description: newDescription,
      updated_at: now,
    }).eq("id", id);

    if (newDescription !== oldDescription) {
      await logEvent({
        supabase: adminSupabase,
        documentTitle: `${docNum.number} — ${newDescription}`,
        userId: user.id,
        userEmail: user.email || "",
        userName: profile?.full_name || undefined,
        eventType: "number_description_edited",
        metadata: { number_id: id, number: docNum.number, from: oldDescription, to: newDescription },
        request,
      });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 });
}
