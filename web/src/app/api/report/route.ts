import { NextRequest, NextResponse } from "next/server";

const ARCGIS_SUBMIT_URL =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/service_a0c6213989ba4519a712df58cf9201d6_form/FeatureServer/0/addFeatures";

// Santa Fe bounding box
const SF_BOUNDS = { minLng: -106.2, maxLng: -105.7, minLat: 35.5, maxLat: 35.9 };

// In-memory rate limit: IP -> [timestamps]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (hits.length >= RATE_LIMIT) return false;
  hits.push(now);
  rateLimitMap.set(ip, hits);
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { problemtype, description, details, lng, lat, addressText, name, email, phone } =
    body as {
      problemtype: string;
      description: string;
      details: Record<string, string>;
      lng: number | null;
      lat: number | null;
      addressText: string;
      name: string;
      email: string;
      phone: string;
    };

  if (!problemtype) {
    return NextResponse.json({ error: "Problem type is required." }, { status: 400 });
  }

  if (lng == null || lat == null) {
    return NextResponse.json({ error: "Location is required." }, { status: 400 });
  }

  if (
    lng < SF_BOUNDS.minLng || lng > SF_BOUNDS.maxLng ||
    lat < SF_BOUNDS.minLat || lat > SF_BOUNDS.maxLat
  ) {
    return NextResponse.json(
      { error: "Location must be within Santa Fe city limits." },
      { status: 400 }
    );
  }

  const attributes: Record<string, string | number | null> = {
    problemtype,
    please_describe_the_problem: description || null,
    X_Longitude: lng,
    Y_Latitude: lat,
    name: name || null,
    email: email || null,
    phone_number: phone || null,
    // Spread conditional sub-fields
    ...Object.fromEntries(
      Object.entries(details ?? {}).map(([k, v]) => [k, v || null])
    ),
  };

  // Address text goes into description if no description given
  if (!description && addressText) {
    attributes.please_describe_the_problem = addressText;
  } else if (addressText) {
    attributes.please_describe_the_problem = `${description}\n\nAddress: ${addressText}`;
  }

  const features = [{ attributes, geometry: { x: lng, y: lat, spatialReference: { wkid: 4326 } } }];

  const formData = new URLSearchParams();
  formData.set("features", JSON.stringify(features));
  formData.set("f", "json");

  try {
    const arcgisRes = await fetch(ARCGIS_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await arcgisRes.json();

    if (data.addResults?.[0]?.success) {
      return NextResponse.json({
        success: true,
        objectId: data.addResults[0].objectId,
        globalId: data.addResults[0].globalId,
      });
    }

    const errMsg = data.addResults?.[0]?.error?.description ?? "Submission failed.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  } catch (err) {
    console.error("ArcGIS submit error:", err);
    return NextResponse.json(
      { error: "Could not reach the city's reporting system. Please try again." },
      { status: 502 }
    );
  }
}
