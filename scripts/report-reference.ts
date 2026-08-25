import { resolve } from "node:path";

import {
  createFilesystemReferenceCatalog,
  createReferenceCoverageReport,
} from "@cpp-learn/reference";

const reference = createFilesystemReferenceCatalog({
  catalogPath: resolve("reference", "catalog.json"),
});
const report = await createReferenceCoverageReport(reference);

console.log(JSON.stringify(report, undefined, 2));
