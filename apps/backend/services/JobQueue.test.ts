import { JobQueue, type JobData } from "./JobQueue";

describe("JobQueue.sortJobsChronologically", () => {
  it("should sort jobs by most recent activity first", () => {
    const jobs: JobData[] = [
      {
        id: "job1",
        type: "test",
        status: "completed",
        created: "2024-01-01T10:00:00Z",
        updated: "2024-01-01T12:00:00Z",
        data: { creatorId: "user1" },
      },
      {
        id: "job2",
        type: "test",
        status: "processing",
        created: "2024-01-01T11:00:00Z",
        updated: "2024-01-01T13:00:00Z",
        data: { creatorId: "user1" },
      },
      {
        id: "job3",
        type: "test",
        status: "pending",
        created: "2024-01-01T09:00:00Z",
        data: { creatorId: "user1" },
      },
    ];

    const sorted = JobQueue.sortJobsChronologically(jobs);

    expect(sorted[0].id).toBe("job2"); // Most recent updated
    expect(sorted[1].id).toBe("job1"); // Second most recent updated
    expect(sorted[2].id).toBe("job3"); // No updated timestamp, uses created
  });

  it("should sort by created date when updated timestamps are equal", () => {
    const jobs: JobData[] = [
      {
        id: "job1",
        type: "test",
        status: "completed",
        created: "2024-01-01T10:00:00Z",
        updated: "2024-01-01T12:00:00Z",
        data: { creatorId: "user1" },
      },
      {
        id: "job2",
        type: "test",
        status: "completed",
        created: "2024-01-01T11:00:00Z",
        updated: "2024-01-01T12:00:00Z",
        data: { creatorId: "user1" },
      },
    ];

    const sorted = JobQueue.sortJobsChronologically(jobs);

    expect(sorted[0].id).toBe("job2"); // Newer created date
    expect(sorted[1].id).toBe("job1"); // Older created date
  });

  it("should sort by job ID when timestamps are identical", () => {
    const jobs: JobData[] = [
      {
        id: "job1",
        type: "test",
        status: "completed",
        created: "2024-01-01T10:00:00Z",
        updated: "2024-01-01T12:00:00Z",
        data: { creatorId: "user1" },
      },
      {
        id: "job2",
        type: "test",
        status: "completed",
        created: "2024-01-01T10:00:00Z",
        updated: "2024-01-01T12:00:00Z",
        data: { creatorId: "user1" },
      },
    ];

    const sorted = JobQueue.sortJobsChronologically(jobs);

    expect(sorted[0].id).toBe("job2"); // Higher job ID
    expect(sorted[1].id).toBe("job1"); // Lower job ID
  });

  it("should handle jobs without updated timestamps", () => {
    const jobs: JobData[] = [
      {
        id: "job1",
        type: "test",
        status: "pending",
        created: "2024-01-01T10:00:00Z",
        data: { creatorId: "user1" },
      },
      {
        id: "job2",
        type: "test",
        status: "pending",
        created: "2024-01-01T11:00:00Z",
        data: { creatorId: "user1" },
      },
    ];

    const sorted = JobQueue.sortJobsChronologically(jobs);

    expect(sorted[0].id).toBe("job2"); // Newer created
    expect(sorted[1].id).toBe("job1"); // Older created
  });
});
