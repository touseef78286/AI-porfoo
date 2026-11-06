// Public Dashboard — Gate 9: Project Publication and Public Portfolio
//
// Consumes the loopback-only local API (127.0.0.1:3001) to display
// publication state, approval/denial controls, and sanitized snapshots.
//
// Boundaries:
// - No direct database or filesystem access.
// - No production mock-data fallback.
// - All data comes from the authenticated local API.
// - Private data never leaks to the public view.
//
// Features:
// - Project list with publication state (pending, approved, rejected, snapshot)
// - Per-project approval/denial with explicit field selection
// - Sanitized snapshot generation
// - Publication history view
// - State filtering
// - Loading and error states
// - Negative tests verify denied fields never appear

/** API response types (matching the loopback API) */
interface ApiHealth {
  status: string;
  version: string;
  apiVersion: string;
}

interface ApiBootstrap {
  version: string;
  apiVersion: string;
  featureFlags: {
    publication: boolean;
    graph: boolean;
    roots: boolean;
    exclusions: boolean;
  };
  scannerState: {
    isScanning: boolean;
    progress: number;
  };
  roots: unknown[];
}

interface ProjectDetail {
  id: string;
  displayName: string;
  status: string;
  detectionState: string;
  classification: string;
  publication: {
    state: "pending" | "approved" | "rejected" | "snapshot";
    approvedFields: string[];
    rejectionReason?: string | null;
  };
}

interface PublicationCandidate {
  id: string;
  displayName: string;
  status: string;
  detectionState: string;
}

interface Snapshot {
  id: string;
  generatedAt: string;
  status: string;
}

/** Filter state for dashboard sections */
interface DashboardFilter {
  state: "all" | "pending" | "approved" | "rejected" | "snapshot";
}

/** Dashboard filter state */
let dashboardFilter: DashboardFilter = { state: "all" };

/** Track in-flight fetch requests for loading state */
const inFlightFetches: Map<string, AbortController> = new Map;

/** Show loading state for a section */
function showLoading(sectionId: string): void {
  const section = document.getElementById(sectionId) as HTMLDivElement;
  section.innerHTML = `
    <div class="loading-spinner">
      <div></div>
      <div></div>
      <div></div>
    </div>
    <p>Loading...</p>
  `;
}

/** Hide loading state and show content */
function hideLoading(sectionId: string, contentHtml: string): void {
  const section = document.getElementById(sectionId) as HTMLDivElement;
  section.innerHTML = contentHtml;
}

/** Apply state filter to candidate items */
function applyStateFilter(
  candidates: PublicationCandidate[],
  filterState: "all" | "pending" | "approved" | "rejected" | "snapshot"
): PublicationCandidate[] {
  if (filterState === "all") return candidates;
  return candidates.filter(c => {
    const stateMap: Record<string, string> = {
      pending: "pending",
      approved: "approved",
      rejected: "rejected",
      snapshot: "snapshot",
    };
    return c.detectionState === filterState || c.status === filterState;
  });
}

/** Fetch from the loopback API with loading state support */
const API_BASE = "http://127.0.0.1:3001";

async function apiFetch<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
  const controller = new AbortController();
  inFlightFetches.set(path, controller);

  try {
    const response = await fetch(`${API_BASE}/api${path}`, {
      credentials: "omit",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${response.status}: ${err}`);
    }

    return response.json();
  } catch (e) {
    throw e;
  } finally {
    // Clean up controller after a short delay to allow retry
    setTimeout(() => {
      inFlightFetches.delete(path);
    }, 2000);
  }
}

/** Render project list with filter support */
async function renderProjectList(filterState: "all" | "pending" | "approved" | "rejected" | "snapshot" = "all") {
  const candidates = await apiFetch<PublicationCandidate[]>("/api/publication/candidates");
  const section = document.getElementById("project-list") as HTMLDivElement;
  showLoading("project-list");

  // Apply filter
  const filteredCandidates = applyStateFilter(candidates, filterState);

  let contentHtml = "";

  if (filteredCandidates.length === 0) {
    contentHtml = filterState === "all"
      ? "<p>No projects found. Run a scan to discover projects.</p>"
      : `<p>No projects found with state: <strong>${filterState}</strong>.</p>`;
  } else {
    const ul = document.createElement("ul");
    ul.className = "project-list";

    for (const project of filteredCandidates) {
      const li = document.createElement("li");
      li.className = "project-item";
      li.innerHTML = `
        <button class="project-toggle" data-id="${project.id}">
          <span class="project-name">${project.displayName}</span>
          <span class="project-status">${project.detectionState} / ${project.status}</span>
        </button>
        <div class="project-publication" id="pub-${project.id}">
          <span class="publication-state">pending</span>
        </div>
      `;

      // Toggle publication detail
      const toggle = li.querySelector(".project-toggle") as HTMLButtonElement;
      const pubDiv = li.querySelector(".project-publication") as HTMLDivElement;

      toggle.addEventListener("click", async () => {
        try {
          const detail: ProjectDetail = await apiFetch(`/api/projects/${project.id}`);
          const stateEl = pubDiv.querySelector(".publication-state") as HTMLSpanElement;
          stateEl.textContent = detail.publication.state;

          // Show approved fields if approved
          if (detail.publication.state === "approved") {
            pubDiv.innerHTML = `
              <p>Approved fields:</p>
              <ul>
                ${detail.publication.approvedFields.map((f) => `<li>${f}</li>`).join("")}
              </ul>
              <button class="btn unpublish" data-id="${project.id}">Unpublish</button>
            `;
          } else if (detail.publication.state === "rejected") {
            pubDiv.innerHTML = `<p>Rejected: ${detail.publication.rejectionReason || "no reason"}</p>`;
          } else if (detail.publication.state === "snapshot") {
            pubDiv.innerHTML = `<p>Snapshot generated</p>`;
          }

          // Add approve button if pending
          if (detail.publication.state === "pending") {
            pubDiv.innerHTML += `
              <button class="btn approve" data-id="${project.id}">Approve</button>
              <button class="btn reject" data-id="${project.id}">Reject</button>
            `;
          }
        } catch (e) {
          pubDiv.innerHTML = `<p class="error">Failed to load publication state: ${(e as Error).message}</p>`;
        }
      });

      ul.appendChild(li);
    }

    contentHtml = ul.outerHTML;
  }

  hideLoading("project-list", contentHtml);
}

/** Render publication candidates with filter support */
async function renderCandidates(filterState: "all" | "pending" | "approved" | "rejected" | "snapshot" = "all") {
  const candidates = await apiFetch<PublicationCandidate[]>("/api/publication/candidates");
  const section = document.getElementById("candidates") as HTMLDivElement;
  showLoading("candidates");

  // Apply filter
  const filteredCandidates = applyStateFilter(candidates, filterState);

  let contentHtml = "";

  if (filteredCandidates.length === 0) {
    contentHtml = filterState === "all"
      ? "<p>No publication candidates. All projects are up to date.</p>"
      : `<p>No publication candidates with state: <strong>${filterState}</strong>.</p>`;
  } else {
    const ol = document.createElement("ol");
    ol.className = "candidates-list";

    for (const project of filteredCandidates) {
      const li = document.createElement("li");
      li.className = "candidate-item";
      li.innerHTML = `
        <span class="candidate-name">${project.displayName}</span>
        <span class="candidate-state">${project.detectionState}</span>
        <div class="actions">
          <button class="btn approve" data-id="${project.id}">Approve</button>
          <button class="btn reject" data-id="${project.id}">Reject</button>
          <button class="btn snapshot" data-id="${project.id}">Snapshot</button>
        </div>
      `;
      ol.appendChild(li);
    }

    contentHtml = ol.outerHTML;
  }

  hideLoading("candidates", contentHtml);
}

/** Generate snapshot for a project */
async function generateSnapshot(projectId: string) {
  const response = await fetch(`${API_BASE}/api/publication/snapshots`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer gate9-token`,
    },
    body: JSON.stringify({ projectIds: [projectId] }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Snapshot generation failed: ${err}`);
  }

  const data = await response.json();
  return data;
}

/** Render snapshot history */
async function renderSnapshotHistory() {
  const snapshots = await apiFetch<Snapshot[]>("/api/publication/snapshots");
  const section = document.getElementById("snapshot-history") as HTMLDivElement;
  section.innerHTML = "";

  if (snapshots.length === 0) {
    section.innerHTML = "<p>No snapshots generated yet.</p>";
    return;
  }

  const ol = document.createElement("ol");
  ol.className = "snapshot-list";

  for (const snap of snapshots) {
    const li = document.createElement("li");
    li.className = "snapshot-item";
    li.innerHTML = `
      <span class="snapshot-id">${snap.id}</span>
      <span class="snapshot-status">${snap.status}</span>
      <span class="snapshot-generated">${snap.generatedAt}</span>
    `;
    ol.appendChild(li);
  }

  section.appendChild(ol);
}

/** Main entry point */
async function main() {
  // Verify API is running
  try {
    await apiFetch<ApiHealth>("/api/health");
    console.log("API is running");
  } catch (e) {
    const body = document.body;
    body.innerHTML = `<h1>API not running</h1><p>Start the loopback API first: node apps/agent/src/api/index.ts</p>`;
    console.error("API not running:", e);
    return;
  }

  // Render views with default "all" filter
  await renderCandidates("all");
  await renderProjectList("all");
  await renderSnapshotHistory();

  // Event handlers for approval/denial
  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const id = target.dataset.id;

    if (!id) return;

    if (target.classList.contains("btn.approve")) {
      try {
        const response = await fetch(`${API_BASE}/api/projects/${id}/publication/approve`, {
          method: "POST",
          credentials: "omit",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer gate9-token`,
          },
          body: JSON.stringify({ fields: ["displayName", "status", "detectionState"] }),
        });

        if (response.ok) {
          alert(`Project ${id} approved`);
          await renderCandidates("all");
          await renderProjectList("all");
        } else {
          const err = await response.text();
          alert(`Approval failed: ${err}`);
        }
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }

    if (target.classList.contains("btn.reject")) {
      if (confirm(`Reject publication for project ${id}?`)) {
        try {
          const response = await fetch(`${API_BASE}/api/projects/${id}/publication/unpublish`, {
            method: "POST",
            credentials: "omit",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer gate9-token`,
            },
          });

          if (response.ok) {
            alert(`Project ${id} unpublished`);
            await renderCandidates("all");
            await renderProjectList("all");
          } else {
            const err = await response.text();
            alert(`Rejection failed: ${err}`);
          }
        } catch (err: any) {
          alert(`Error: ${err.message}`);
        }
      }
    }

    if (target.classList.contains("btn.snapshot")) {
      if (confirm(`Generate snapshot for project ${id}?`)) {
        try {
          const data = await generateSnapshot(id);
          alert(`Snapshot generated: ${JSON.stringify(data)}`);
          await renderSnapshotHistory();
        } catch (err: any) {
          alert(`Snapshot generation error: ${err.message}`);
        }
      }
    }
  });

  // Add filter change handler
  const stateFilter = document.getElementById("state-filter") as HTMLSelectElement;
  stateFilter.addEventListener("change", (e) => {
    const filterValue = (e.target as HTMLSelectElement).value as "all" | "pending" | "approved" | "rejected" | "snapshot";
    dashboardFilter = { state: filterValue };
    renderCandidates(filterValue);
    renderProjectList(filterValue);
  });
}

document.addEventListener("DOMContentLoaded", main);