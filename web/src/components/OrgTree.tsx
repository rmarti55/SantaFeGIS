"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import orgStructure from "@/data/org-structure.json";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Role = "elected" | "appointed" | "director" | "division" | "position" | "employee";

interface OrgNode {
  id: string;
  label: string;
  role: Role;
  title?: string;
  note?: string;
  salary?: number;
  hourlyRate?: number;
  employeeCount?: number;
  avgSalary?: number;
  minSalary?: number;
  maxSalary?: number;
  children?: OrgNode[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ROLE_COLORS: Record<Role, { bg: string; border: string; text: string; badge: string }> = {
  elected:   { bg: "bg-amber-50",   border: "border-amber-300", text: "text-amber-900", badge: "bg-amber-200 text-amber-800" },
  appointed: { bg: "bg-purple-50",  border: "border-purple-300", text: "text-purple-900", badge: "bg-purple-200 text-purple-800" },
  director:  { bg: "bg-blue-50",    border: "border-blue-300",  text: "text-blue-900",  badge: "bg-blue-200 text-blue-800" },
  division:  { bg: "bg-teal-50",    border: "border-teal-300",  text: "text-teal-900",  badge: "bg-teal-200 text-teal-800" },
  position:  { bg: "bg-gray-50",    border: "border-gray-300",  text: "text-gray-800",  badge: "bg-gray-200 text-gray-700" },
  employee:  { bg: "bg-white",      border: "border-gray-200",  text: "text-gray-700",  badge: "bg-gray-100 text-gray-600" },
};

const ROLE_LABELS: Record<Role, string> = {
  elected: "Elected",
  appointed: "Appointed",
  director: "Department",
  division: "Division",
  position: "Position",
  employee: "Employee",
};

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString();
}

function countAllEmployees(node: OrgNode): number {
  if (node.role === "employee") return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countAllEmployees(child), 0);
}

function nodeMatchesSearch(node: OrgNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.title?.toLowerCase().includes(q)) return true;
  return false;
}

function treeHasMatch(node: OrgNode, query: string): boolean {
  if (nodeMatchesSearch(node, query)) return true;
  if (!node.children) return false;
  return node.children.some((child) => treeHasMatch(child, query));
}

function collectMatchIds(node: OrgNode, query: string, ids: Set<string>) {
  if (treeHasMatch(node, query)) {
    ids.add(node.id);
  }
  if (node.children) {
    for (const child of node.children) {
      collectMatchIds(child, query, ids);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Governance top nodes (Mayor, Council, City Manager)                */
/* ------------------------------------------------------------------ */

function buildGovernanceNodes(): OrgNode[] {
  const { elected, appointed } = orgStructure;

  const councilChildren: OrgNode[] = elected.council.map((c, i) => ({
    id: `council-d${c.district}-${i}`.toLowerCase(),
    label: c.name,
    role: "elected" as Role,
    title: `District ${c.district}${"role" in c ? ` — ${(c as { role: string }).role}` : ""}`,
    note: `Term: ${c.term}`,
  }));

  const councilNode: OrgNode = {
    id: "council",
    label: "City Council (Governing Body)",
    role: "elected",
    title: "8 members, 4 districts, staggered 4-year terms",
    employeeCount: 8,
    children: councilChildren,
  };

  const mayorNode: OrgNode = {
    id: "mayor",
    label: elected.mayor.name,
    role: "elected",
    title: elected.mayor.title,
    note: elected.mayor.note,
  };

  const cityManagerNode: OrgNode = {
    id: "city-manager",
    label: appointed.cityManager.name,
    role: "appointed",
    title: appointed.cityManager.title,
    note: appointed.cityManager.note,
  };

  const cityAttorneyNode: OrgNode = {
    id: "city-attorney",
    label: appointed.cityAttorney.name,
    role: "appointed",
    title: appointed.cityAttorney.title,
    note: appointed.cityAttorney.note,
  };

  const cityClerkNode: OrgNode = {
    id: "city-clerk",
    label: appointed.cityClerk.name,
    role: "appointed",
    title: appointed.cityClerk.title,
    note: appointed.cityClerk.note,
  };

  return [mayorNode, councilNode, cityManagerNode, cityAttorneyNode, cityClerkNode];
}

/* ------------------------------------------------------------------ */
/*  TreeNode component                                                 */
/* ------------------------------------------------------------------ */

function TreeNodeCard({
  node,
  depth,
  expanded,
  onToggle,
  search,
  expandedIds,
  selectedId,
  onSelect,
}: {
  node: OrgNode;
  depth: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  search: string;
  expandedIds: Set<string>;
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const colors = ROLE_COLORS[node.role];
  const isMatch = search && nodeMatchesSearch(node, search);
  const isSelected = selectedId === node.id;

  const highlight = isMatch ? "ring-2 ring-yellow-400 shadow-md" : "";
  const selectedStyle = isSelected ? "ring-2 ring-blue-500 shadow-lg" : "";

  return (
    <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      <div
        className={`flex items-start gap-2 my-1 rounded-lg border px-3 py-2 cursor-pointer transition-all duration-150 hover:shadow-sm ${colors.bg} ${colors.border} ${highlight} ${selectedStyle}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
      >
        {/* Expand/collapse indicator */}
        <div className="mt-0.5 w-5 h-5 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <span className={`text-sm font-bold ${colors.text} select-none`}>
              {expanded ? "\u25BC" : "\u25B6"}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">&bull;</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${colors.text} truncate`}>
              {node.label}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors.badge}`}>
              {ROLE_LABELS[node.role]}
            </span>
            {node.employeeCount != null && node.role !== "employee" && (
              <span className="text-[10px] text-gray-500">
                {node.employeeCount.toLocaleString()} {node.employeeCount === 1 ? "person" : "people"}
              </span>
            )}
          </div>

          {node.title && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">{node.title}</div>
          )}

          {node.role === "employee" && node.salary != null && (
            <div className="text-xs text-gray-500 mt-0.5">
              {fmtCurrency(node.salary)}/yr
              {node.hourlyRate != null && (
                <span className="ml-2 text-gray-400">
                  (${node.hourlyRate.toFixed(2)}/hr)
                </span>
              )}
            </div>
          )}

          {node.role !== "employee" && node.avgSalary != null && (
            <div className="text-xs text-gray-400 mt-0.5">
              Avg {fmtCurrency(node.avgSalary)}/yr
              {node.minSalary != null && node.maxSalary != null && (
                <span className="ml-1">
                  &middot; Range {fmtCurrency(node.minSalary)} &ndash; {fmtCurrency(node.maxSalary)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="border-l-2 border-gray-200 ml-4">
          {node.children!.map((child) => (
            <TreeNodeCard
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expandedIds.has(child.id)}
              onToggle={onToggle}
              search={search}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                       */
/* ------------------------------------------------------------------ */

function DetailPanel({ node }: { node: OrgNode | null }) {
  if (!node) {
    return (
      <div className="text-gray-400 text-sm p-4 text-center">
        Click any node to see details
      </div>
    );
  }

  const colors = ROLE_COLORS[node.role];
  const totalEmployees = countAllEmployees(node);

  return (
    <div className="p-4 space-y-3">
      <div className={`rounded-lg border p-3 ${colors.bg} ${colors.border}`}>
        <h3 className={`font-bold text-base ${colors.text}`}>{node.label}</h3>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-block mt-1 ${colors.badge}`}>
          {ROLE_LABELS[node.role]}
        </span>
        {node.title && <p className="text-sm text-gray-600 mt-1">{node.title}</p>}
        {node.note && <p className="text-xs text-gray-500 mt-1 italic">{node.note}</p>}
      </div>

      {node.role === "employee" && node.salary != null && (
        <div className="bg-white rounded-lg border p-3 space-y-1">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Compensation</div>
          <div className="text-lg font-bold text-gray-900">{fmtCurrency(node.salary)}/yr</div>
          {node.hourlyRate != null && (
            <div className="text-sm text-gray-500">${node.hourlyRate.toFixed(2)}/hr</div>
          )}
        </div>
      )}

      {node.role !== "employee" && totalEmployees > 0 && (
        <div className="bg-white rounded-lg border p-3 space-y-1">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Staff Count</div>
          <div className="text-lg font-bold text-gray-900">
            {totalEmployees.toLocaleString()} {totalEmployees === 1 ? "employee" : "employees"}
          </div>
        </div>
      )}

      {node.avgSalary != null && node.role !== "employee" && (
        <div className="bg-white rounded-lg border p-3 space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Salary Stats</div>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <div className="text-xs text-gray-400">Average</div>
              <div className="text-sm font-semibold text-gray-800">{fmtCurrency(node.avgSalary)}/yr</div>
            </div>
            {node.minSalary != null && (
              <div>
                <div className="text-xs text-gray-400">Minimum</div>
                <div className="text-sm font-semibold text-gray-800">{fmtCurrency(node.minSalary)}/yr</div>
              </div>
            )}
            {node.maxSalary != null && (
              <div>
                <div className="text-xs text-gray-400">Maximum</div>
                <div className="text-sm font-semibold text-gray-800">{fmtCurrency(node.maxSalary)}/yr</div>
              </div>
            )}
          </div>
        </div>
      )}

      {node.children && node.children.length > 0 && (
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Direct Reports ({node.children.length})
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {node.children.map((child) => (
              <div key={child.id} className="text-sm text-gray-700 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${ROLE_COLORS[child.role].border.replace("border-", "bg-")}`} />
                <span className="truncate">{child.label}</span>
                {child.employeeCount != null && child.role !== "employee" && (
                  <span className="text-xs text-gray-400 shrink-0">({child.employeeCount})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OrgTree() {
  const [treeData, setTreeData] = useState<OrgNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/salaries");
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const json = await resp.json();

      const govNodes = buildGovernanceNodes();
      const directorMap: Record<string, string> = orgStructure.departmentDirectorMap;

      const deptGroups = new Map<string, typeof json.employees>();
      for (const emp of json.employees) {
        const dept = emp.department || "Unassigned";
        if (!deptGroups.has(dept)) deptGroups.set(dept, []);
        deptGroups.get(dept)!.push(emp);
      }

      const departmentNodes: OrgNode[] = [];
      const sortedDepts = Array.from(deptGroups.entries()).sort(
        (a: [string, unknown[]], b: [string, unknown[]]) => b[1].length - a[1].length
      );

      for (const [deptName, deptEmps] of sortedDepts) {
        const salaries = deptEmps.map((e: { annualSalary: number }) => e.annualSalary);
        const directorName = findDirector(deptName, directorMap);

        const divGroups = new Map<string, typeof deptEmps>();
        for (const emp of deptEmps) {
          const div = emp.division || "General";
          if (!divGroups.has(div)) divGroups.set(div, []);
          divGroups.get(div)!.push(emp);
        }

        const divisionNodes: OrgNode[] = [];
        const sortedDivs = Array.from(divGroups.entries()).sort(
          (a: [string, unknown[]], b: [string, unknown[]]) => b[1].length - a[1].length
        );

        for (const [divName, divEmps] of sortedDivs) {
          const divSalaries = divEmps.map((e: { annualSalary: number }) => e.annualSalary);

          const posGroups = new Map<string, typeof divEmps>();
          for (const emp of divEmps) {
            const pos = emp.position || "Unknown";
            if (!posGroups.has(pos)) posGroups.set(pos, []);
            posGroups.get(pos)!.push(emp);
          }

          const positionNodes: OrgNode[] = [];
          const sortedPositions = Array.from(posGroups.entries()).sort(
            (a: [string, unknown[]], b: [string, unknown[]]) => b[1].length - a[1].length
          );

          for (const [posName, posEmps] of sortedPositions) {
            const posSalaries = posEmps.map((e: { annualSalary: number }) => e.annualSalary);
            const employeeNodes: OrgNode[] = posEmps
              .sort((a: { annualSalary: number }, b: { annualSalary: number }) => b.annualSalary - a.annualSalary)
              .map((emp: { lastName: string; firstName: string; position: string; annualSalary: number; hourlyRate: number }, idx: number) => ({
                id: `emp-${deptName}-${divName}-${emp.lastName}-${emp.firstName}-${idx}`.replace(/\s+/g, "-").toLowerCase(),
                label:
                  emp.firstName && emp.lastName
                    ? `${emp.firstName} ${emp.lastName}`
                    : emp.firstName || emp.lastName || "Name Withheld",
                role: "employee" as Role,
                title: emp.position,
                salary: emp.annualSalary,
                hourlyRate: emp.hourlyRate,
              }));

            positionNodes.push({
              id: `pos-${deptName}-${divName}-${posName}`.replace(/\s+/g, "-").toLowerCase(),
              label: posName,
              role: "position",
              employeeCount: posEmps.length,
              avgSalary: Math.round(posSalaries.reduce((a: number, b: number) => a + b, 0) / posSalaries.length),
              minSalary: Math.min(...posSalaries),
              maxSalary: Math.max(...posSalaries),
              children: employeeNodes,
            });
          }

          divisionNodes.push({
            id: `div-${deptName}-${divName}`.replace(/\s+/g, "-").toLowerCase(),
            label: divName,
            role: "division",
            employeeCount: divEmps.length,
            avgSalary: Math.round(divSalaries.reduce((a: number, b: number) => a + b, 0) / divSalaries.length),
            minSalary: Math.min(...divSalaries),
            maxSalary: Math.max(...divSalaries),
            children: positionNodes,
          });
        }

        departmentNodes.push({
          id: `dept-${deptName}`.replace(/\s+/g, "-").toLowerCase(),
          label: deptName,
          role: "director",
          title: directorName ? `Director: ${directorName}` : undefined,
          employeeCount: deptEmps.length,
          avgSalary: Math.round(salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length),
          minSalary: Math.min(...salaries),
          maxSalary: Math.max(...salaries),
          children: divisionNodes,
        });
      }

      const [mayorNode, councilNode, cityManagerNode, cityAttorneyNode, cityClerkNode] = govNodes;

      cityManagerNode.children = departmentNodes;
      cityManagerNode.employeeCount = json.employees.length;

      const root: OrgNode = {
        id: "root",
        label: "City of Santa Fe",
        role: "elected",
        title: "Municipal Government",
        employeeCount: json.employees.length,
        children: [mayorNode, councilNode, cityManagerNode, cityAttorneyNode, cityClerkNode],
      };

      setTreeData(root);
      setExpandedIds(new Set(["root", "mayor", "council", "city-manager"]));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    if (!searchInput || !treeData) return;

    const matchIds = new Set<string>();
    collectMatchIds(treeData, searchInput, matchIds);
    setExpandedIds((prev) => new Set([...prev, ...matchIds]));
  }, [searchInput, treeData]);

  const handleExpandAll = useCallback(() => {
    if (!treeData) return;
    const all = new Set<string>();
    function collect(node: OrgNode) {
      all.add(node.id);
      node.children?.forEach(collect);
    }
    collect(treeData);
    setExpandedIds(all);
  }, [treeData]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set(["root"]));
  }, []);

  const handleExpandDepts = useCallback(() => {
    setExpandedIds(new Set(["root", "mayor", "council", "city-manager"]));
  }, []);

  const stats = useMemo(() => {
    if (!treeData) return null;
    const cmNode = treeData.children?.find((c) => c.id === "city-manager");
    const deptCount = cmNode?.children?.length ?? 0;
    const totalEmployees = treeData.employeeCount ?? 0;
    return { deptCount, totalEmployees };
  }, [treeData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-3" />
          <p>Building organizational tree...</p>
          <p className="text-xs mt-1">Fetching salary data from santafenm.gov</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <div className="text-center">
          <p className="font-medium">Failed to load org tree</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!treeData) return null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left: Tree */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm shrink-0">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search by name, title, department..."
              className="border rounded px-2 py-1 w-72 text-gray-800 bg-white"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                }}
                className="text-gray-400 hover:text-gray-600 px-2"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExpandDepts}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600"
            >
              Departments
            </button>
            <button
              onClick={handleExpandAll}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600"
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600"
            >
              Collapse
            </button>
          </div>

          {stats && (
            <div className="text-xs text-gray-400 ml-2">
              {stats.deptCount} departments &middot; {stats.totalEmployees.toLocaleString()} employees
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-3 text-[10px] shrink-0">
          {(["elected", "appointed", "director", "division", "position", "employee"] as Role[]).map((role) => (
            <span key={role} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded border ${ROLE_COLORS[role].bg} ${ROLE_COLORS[role].border}`} />
              <span className="text-gray-500">{ROLE_LABELS[role]}</span>
            </span>
          ))}
        </div>

        {/* Tree area */}
        <div ref={treeRef} className="flex-1 overflow-auto px-4 py-3">
          <TreeNodeCard
            node={treeData}
            depth={0}
            expanded={expandedIds.has(treeData.id)}
            onToggle={handleToggle}
            search={search}
            expandedIds={expandedIds}
            selectedId={selectedNode?.id ?? null}
            onSelect={setSelectedNode}
          />
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t px-4 py-2 text-[11px] text-gray-400 shrink-0">
          Source:{" "}
          <a
            href="https://santafenm.gov/human-resources/employee-salaries-positions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            santafenm.gov employee salaries
          </a>
          {" "}&amp;{" "}
          <a
            href="https://santafenm.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            FY26 departmental KPIs
          </a>
          . Hierarchy inferred from department/division/position data. Annual salary = hourly &times; 2,080.
        </div>
      </div>

      {/* Right: Detail panel */}
      <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto shrink-0 hidden md:block">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Details</h3>
        </div>
        <DetailPanel node={selectedNode} />
      </div>
    </div>
  );
}

function findDirector(deptName: string, directorMap: Record<string, string>): string | null {
  if (directorMap[deptName]) return directorMap[deptName];
  const deptLower = deptName.toLowerCase();
  for (const [key, value] of Object.entries(directorMap)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes(deptLower) || deptLower.includes(keyLower)) return value;
    const deptWords = deptLower.split(/\s+/);
    const keyWords = keyLower.split(/\s+/);
    const overlap = deptWords.filter((w) => keyWords.includes(w) && w.length > 3);
    if (overlap.length >= 1) return value;
  }
  return null;
}
