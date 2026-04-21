import { NextRequest, NextResponse } from "next/server";
import { reclassifyProblemType, STATUS_LABELS } from "@/lib/arcgis";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recordId = parseInt(id, 10);

  if (isNaN(recordId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const query = `
      SELECT
        id, objectid, globalid, problemtype_from_extra, status_from_extra,
        "What_is_the_problem_you_are_reporting_" AS problem,
        "Please_describe_details_of_your_concern_as_much_as_possible_to_help_our_team_understand_and_get_it_addressed" AS description,
        "Assigned_to" AS assigned_to,
        "Resolution" AS resolution,
        "Field_Notes" AS field_notes,
        "responsecomments",
        "responsenotes",
        "WorkOrderNumber" AS work_order_number,
        "On_behalf_of_Councilor" AS councilor,
        "CreationDate",
        "Resolved_on",
        "Days_to_Resolve" AS days_to_resolve,
        x, y,
        "Where_is_the_encampment_located_",
        "How_many_people_are_at_the_encampment__estimate__",
        "Can_you_identify_any_of_the_following_at_the_encampment_",
        "Is_the_Encampment_Active_or_Abandoned_",
        "Where_is_the_vehicle_located_",
        "What_is_the_license_plate_number_of_the_vehicle_",
        "What_is_the_make_and_model_of_the_vehicle_",
        "What_color_is_the_vehicle_",
        "Approximately_how_large_is_the_pothole_",
        "What_type_of_objects_are_illegally_dumped_",
        "What_is_the_graffiti_located_on_",
        "Is_the_property_residential__commercial__or_public_",
        "What_is_the_main_type_of_item_that_make_this_property__unsightly__"
      FROM crm_full
      WHERE id = $1
    `;

    const rows = await db.query(query, [recordId]) as Array<any>;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = rows[0];
    const rawProblemtype = row.problemtype_from_extra || "other";
    const reclassified = reclassifyProblemType(rawProblemtype, row.problem || "");

    // Build response with proper type conversions
    const response = {
      id: row.id,
      objectid: row.objectid,
      globalid: row.globalid,
      problemtype: reclassified,
      problemtype_original: rawProblemtype,
      status: row.status_from_extra,
      status_label: STATUS_LABELS[row.status_from_extra as keyof typeof STATUS_LABELS] || row.status_from_extra,
      problem: row.problem,
      description: row.description,
      assigned_to: row.assigned_to,
      resolution: row.resolution,
      field_notes: row.field_notes,
      response_comments: row.responsecomments,
      response_notes: row.responsenotes,
      work_order_number: row.work_order_number,
      councilor: row.councilor,
      created: Number(row.CreationDate),
      resolved: row.Resolved_on != null ? Number(row.Resolved_on) : null,
      days_to_resolve: row.days_to_resolve != null ? Number(row.days_to_resolve) : null,
      geometry: {
        x: Number(row.x),
        y: Number(row.y),
      },
      // Type-specific fields
      encampment: {
        location: row["Where_is_the_encampment_located_"],
        people_estimate: row["How_many_people_are_at_the_encampment__estimate__"],
        items_identified: row["Can_you_identify_any_of_the_following_at_the_encampment_"],
        active_or_abandoned: row["Is_the_Encampment_Active_or_Abandoned_"],
      },
      vehicle: {
        location: row["Where_is_the_vehicle_located_"],
        license_plate: row["What_is_the_license_plate_number_of_the_vehicle_"],
        make_model: row["What_is_the_make_and_model_of_the_vehicle_"],
        color: row["What_color_is_the_vehicle_"],
      },
      pothole: {
        approximate_size: row["Approximately_how_large_is_the_pothole_"],
      },
      dumping: {
        objects_dumped: row["What_type_of_objects_are_illegally_dumped_"],
      },
      graffiti: {
        located_on: row["What_is_the_graffiti_located_on_"],
      },
      property: {
        type: row["Is_the_property_residential__commercial__or_public_"],
        unsightliness_items: row["What_is_the_main_type_of_item_that_make_this_property__unsightly__"],
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
