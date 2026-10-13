import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function ReportsPage() {
  return <ResourcePage resource={resourceByPath["/reports"]} />;
}
