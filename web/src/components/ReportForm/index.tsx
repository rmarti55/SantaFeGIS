"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import StepProblemType from "./StepProblemType";
import StepDetails from "./StepDetails";
import StepContact from "./StepContact";
import StepConfirm from "./StepConfirm";

const StepLocation = dynamic(() => import("./StepLocation"), { ssr: false });

type Step = "problem-type" | "details" | "location" | "contact" | "confirm" | "success";

const STEP_LABELS: Record<Exclude<Step, "success">, string> = {
  "problem-type": "Category",
  details: "Details",
  location: "Location",
  contact: "Contact",
  confirm: "Review",
};

const STEP_ORDER: Exclude<Step, "success">[] = [
  "problem-type",
  "details",
  "location",
  "contact",
  "confirm",
];

interface FormState {
  step: Step;
  problemtype: string;
  details: Record<string, string>;
  description: string;
  lng: number | null;
  lat: number | null;
  addressText: string;
  name: string;
  email: string;
  phone: string;
}

const INITIAL_STATE: FormState = {
  step: "problem-type",
  problemtype: "",
  details: {},
  description: "",
  lng: null,
  lat: null,
  addressText: "",
  name: "",
  email: "",
  phone: "",
};

export default function ReportForm() {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [objectId, setObjectId] = useState<number | null>(null);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setState((s) => ({ ...s, [key]: val }));
  }, []);

  const stepIndex = STEP_ORDER.indexOf(state.step as Exclude<Step, "success">);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemtype: state.problemtype,
          description: state.description,
          details: state.details,
          lng: state.lng,
          lat: state.lat,
          addressText: state.addressText,
          name: state.name,
          email: state.email,
          phone: state.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setObjectId(data.objectId);
        setState((s) => ({ ...s, step: "success" }));
      } else {
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.step === "success") {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mb-6">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Report submitted!</h2>
        <p className="text-gray-500 text-sm mb-2">
          Your report has been sent to the City of Santa Fe Constituent Services.
        </p>
        {objectId && (
          <p className="text-xs text-gray-400 mb-6">
            Reference ID: <span className="font-mono font-semibold">{objectId}</span>
          </p>
        )}
        {state.email && (
          <p className="text-sm text-gray-600 mb-6">
            You&apos;ll receive email updates at <strong>{state.email}</strong> as the city processes your report.
          </p>
        )}
        <a
          href="https://www.arcgis.com/apps/dashboards/2f65e37d28ec4f97a32dfb9a05f0bace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline mb-8"
        >
          View the city&apos;s CRM public dashboard →
        </a>
        <button
          onClick={() => {
            setState(INITIAL_STATE);
            setObjectId(null);
            setSubmitError(null);
          }}
          className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
        >
          Report another issue
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Progress bar */}
      {stepIndex >= 0 && (
        <div className="flex-shrink-0 px-6 pt-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Step {stepIndex + 1} of {STEP_ORDER.length} —{" "}
            <span className="font-medium text-gray-600">
              {STEP_LABELS[state.step as Exclude<Step, "success">]}
            </span>
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {state.step === "problem-type" && (
          <StepProblemType
            onSelect={(type) => {
              set("problemtype", type);
              set("details", {});
              set("step", "details");
            }}
          />
        )}

        {state.step === "details" && (
          <StepDetails
            problemtype={state.problemtype}
            details={state.details}
            description={state.description}
            onDetailsChange={(key, val) =>
              setState((s) => ({ ...s, details: { ...s.details, [key]: val } }))
            }
            onDescriptionChange={(val) => set("description", val)}
            onNext={() => set("step", "location")}
            onBack={() => set("step", "problem-type")}
          />
        )}

        {state.step === "location" && (
          <StepLocation
            lng={state.lng}
            lat={state.lat}
            addressText={state.addressText}
            onLocationChange={(lng, lat) =>
              setState((s) => ({ ...s, lng, lat }))
            }
            onAddressChange={(val) => set("addressText", val)}
            onNext={() => set("step", "contact")}
            onBack={() => set("step", "details")}
          />
        )}

        {state.step === "contact" && (
          <StepContact
            name={state.name}
            email={state.email}
            phone={state.phone}
            onNameChange={(v) => set("name", v)}
            onEmailChange={(v) => set("email", v)}
            onPhoneChange={(v) => set("phone", v)}
            onNext={() => set("step", "confirm")}
            onBack={() => set("step", "location")}
          />
        )}

        {state.step === "confirm" && (
          <StepConfirm
            problemtype={state.problemtype}
            description={state.description}
            details={state.details}
            lng={state.lng}
            lat={state.lat}
            addressText={state.addressText}
            name={state.name}
            email={state.email}
            phone={state.phone}
            submitting={submitting}
            error={submitError}
            onSubmit={handleSubmit}
            onBack={() => set("step", "contact")}
          />
        )}
      </div>
    </div>
  );
}
