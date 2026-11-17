# Context: Software Project Workspace

## Session Checkpoint & State Protocol (Mandatory)
- **Session Initialization (Check In):** At the beginning of EVERY session, perform the following check-in sequence before executing tasks:
  1. Inspect `CHECKPOINT.md` to review current Subsystem Health Matrix, past achievements, proven commands, and active environment nuances. If the file does not exist, create it with this minimum content:
    ```
    # Evolutionary Agent Permissions & Access Requests Ledger

    **Notice**: This file serves as the official, audited communication channel for privilege elevation, system-level packages, kernel capabilities, and out-of-workspace resource requests between non-privileged AI agents and human administrators.

    ---
    ```
  2. Inspect `permissions.md` to review the status of privilege requests. Check if any previously `PENDING` items were `GRANTED` or `REJECTED` by human administrators. If the file does not exist, create it with this minimum content:
    ```
    # Project Checkpoint & Session Ledger
    **Note for AI Agents & Engineers**:
    Read this file at the **beginning** of each session to understand current system status, verified environments, and available capabilities.
    Update this file at the **end** of each session to record new achievements, configuration advances, and the latest checkpoint state.

    ---
    ```
  3. Run `make infra-status` to verify live infrastructure readiness (KinD cluster, PostgreSQL, Mock Proxy).
- **Session Conclusion (Check Out):** At the end of EVERY session, update both ledgers:
  1. Update `CHECKPOINT.md` with new achievements, updated subsystem statuses, newly verified recipes, and append an entry to the Session Activity Log with timestamp and summary.
  2. Update `permissions.md` to ensure any new privilege requests opened during the session are properly logged with status `PENDING`, or marked appropriately if resolved.

## Permissions & Privilege Elevation Protocol (`permissions.md`)
- **Execution Boundary:** The agent executes as a non-privileged user (`teto`, UID 2001) inside the VM. `sudo` access is not permitted.
- **Handling Privilege Boundaries:** Whenever a task requires elevated access (e.g., system-wide `apt` packages, kernel capabilities, privileged container mounts, host network modifications, or access outside the workspace):
  1. **Do NOT Attempt Unauthorized Escalations:** Avoid attempting brute-force sudo commands or getting stuck.
  2. **Log to `permissions.md`:** Append a structured request under Section 2 of `permissions.md` specifying:
     * Request ID (`REQ-XXX`), Timestamp, and Requested Capability.
     * Target Subsystem, Context, and Technical Rationale.
     * Security evaluation and blast radius.
     * Initial Status: `PENDING`.
  3. **Action Based on Status:**
     * **`GRANTED`**: Proceed with the task using the granted resource or configuration instructions.
     * **`REJECTED`**: Acknowledge the rejection; develop an alternative non-privileged workaround or inform the user.
     * **`PENDING`**: Inform the user if the task is blocked, or proceed with independent non-blocked tasks.

## Tech Stack & Guardrails
- **Task Automation:** Use the master `Makefile` for all builds, cluster management, testing, and lifecycle tasks (`make help` to inspect available targets).
- **Dependencies:** Adhere strictly to package versions defined in local configuration manifests (`requirements.txt`, etc.).
- **Testing:** Write or update unit tests alongside any functional code changes where applicable (`tests/`, `make test`).

## Agent Behavior
- **File Integrity:** Inspect surrounding code context thoroughly before writing updates.
- **Error Prevention:** Validate variable scopes, handle explicit exceptions, and avoid hardcoding environment secrets or credentials.
