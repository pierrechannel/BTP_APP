import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function ResourcesPage() {
  return <ResourcePage resource={resourceByPath["/resources"]} />;
}
