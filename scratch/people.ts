// Example scratch file: a named operation with query params, then save the result.
//
//   npm run scratch -- scratch/people.ts

import { x, pp } from "./lib.ts";

// GET /people?ws.op=getByEmail&email=...
const person = await x.get("/people", {
  "ws.op": "getByEmail",
  email: "noreply@launchpad.net",
});

console.log("# people?ws.op=getByEmail");
pp(person);
console.log("\n# links");
pp(x.links(person));

// Persist for later (writes under data/, git-ignored):
// await x.save(person, "person.json");
