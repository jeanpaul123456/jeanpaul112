export const stageLabels = {
  Submitted: "Submitted",
  Assigned: "Accepted",
  "In Progress": "In progress",
  Completed: "Completed",
  Rejected: "Rejected",
};

export function progressSteps(request) {
  return ["Submitted", "Assigned", "In Progress", "Completed"].map((status) => {
    const event = request.history.find((entry) => entry.status === status);
    return {
      status,
      label: stageLabels[status],
      event,
      state:
        request.status === status
          ? "current"
          : event
            ? "done"
            : request.status === "Rejected"
              ? "stopped"
              : "pending",
    };
  });
}

export function nextStepText(request) {
  const department = request.department.name;
  return {
    Submitted: `Sent to ${department}. Waiting for the team to review and accept your request.`,
    Assigned: `${department} has accepted your request. The next step is to start work.`,
    "In Progress": `${department} is working on your request. Check the activity below for updates.`,
    Completed: `${department} marked this request as completed. Review the activity below for the resolution details.`,
    Rejected: `${department} rejected this request. Read the reason in the activity below before submitting a new request.`,
  }[request.status];
}
