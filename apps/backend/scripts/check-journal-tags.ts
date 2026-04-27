import "reflect-metadata";
import Redis from "ioredis";
import AppDataSource from "../data-source";
import { OpenAIService } from "../services/shared/OpenAIService";
import { RedisService } from "../services/shared/RedisService";
import { analyzeJournalReflection } from "../services/ResonanceService";

const cases: { name: string; journal: string; expect: string[] }[] = [
  {
    name: "clear coverage_complaint",
    journal:
      "I keep going to these coffee shops alone and rating them well, but honestly this isn't getting me any closer to actually dating someone. I want the app to give me something that's actually about meeting people, not just sitting in rooms.",
    expect: ["coverage_complaint"],
  },
  {
    name: "clear readiness_mismatch",
    journal:
      "I literally go to bookstores alone every weekend, this is just my normal Saturday. I was hoping for something that would actually push me past where I already am.",
    expect: ["readiness_mismatch"],
  },
  {
    name: "both signals together",
    journal:
      "I've been going out alone for years already, this isn't anywhere near my level. Honestly, none of this is moving me toward dating at all. I want the actual reps, not the warm-up.",
    expect: ["coverage_complaint", "readiness_mismatch"],
  },
  {
    name: "negative venting (NOT a complaint about coverage)",
    journal:
      "Today was really hard. I felt anxious the whole time and almost left twice. I kept thinking everyone was watching me. It was a small win to stay but I'm exhausted.",
    expect: [],
  },
  {
    name: "positive growth (control — should NOT trigger new tags)",
    journal:
      "Today at the cafe felt way better than I expected — like I could be in a public place without it feeling performative. Genuinely surprised by how good it felt to just exist there for a bit.",
    expect: [],
  },
];

await AppDataSource.initialize();
const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379");
const redisService = new RedisService(redis);
const openAIService = new OpenAIService({
  redisService,
  dataSource: AppDataSource,
});

let pass = 0;
let fail = 0;

for (const c of cases) {
  const result = await analyzeJournalReflection(openAIService, c.journal);
  const expected = new Set(c.expect);
  const actual = new Set(result.tags);
  const wantedFired = c.expect.every((t) => actual.has(t));
  const newTagsFiredUnexpectedly = ["coverage_complaint", "readiness_mismatch"]
    .filter((t) => actual.has(t) && !expected.has(t));
  const ok = wantedFired && newTagsFiredUnexpectedly.length === 0;

  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${c.name}`);
  console.log(`  expected: ${c.expect.length ? c.expect.join(", ") : "(no acceleration tags)"}`);
  console.log(`  actual:   ${result.tags.length ? result.tags.join(", ") : "(none)"}`);
  console.log(`  depth=${result.depth.toFixed(2)} sentiment=${result.sentiment.toFixed(2)}`);
  if (ok) pass++; else fail++;
}

console.log(`\n=== ${pass}/${cases.length} cases pass ===`);
process.exit(fail > 0 ? 1 : 0);
