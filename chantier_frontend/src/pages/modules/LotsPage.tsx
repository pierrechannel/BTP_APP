import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function LotsPage() {
  return <ResourcePage resource={resourceByPath["/lots"]} />;
}
