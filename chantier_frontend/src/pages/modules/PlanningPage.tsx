import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function PlanningPage() {
  return <ResourcePage resource={resourceByPath["/planning"]} />;
}
