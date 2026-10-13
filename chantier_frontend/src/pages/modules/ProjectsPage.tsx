import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function ProjectsPage() {
  return <ResourcePage resource={resourceByPath["/projects"]} />;
}
