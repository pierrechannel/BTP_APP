import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function SyncPage() {
  return <ResourcePage resource={resourceByPath["/sync"]} />;
}
